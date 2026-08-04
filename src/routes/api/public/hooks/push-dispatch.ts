import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { buildPushPayload } from "@block65/webcrypto-web-push";

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        if (!key || key !== process.env["SUPABASE_ANON_KEY"]) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const vapid = {
          subject: process.env["VAPID_SUBJECT"]!,
          publicKey: process.env["VAPID_PUBLIC_KEY"]!,
          privateKey: process.env["VAPID_PRIVATE_KEY"]!,
        };

        const subsCache = new Map<string, SubRow[]>();
        const subsFor = async (householdId: string) => {
          const hit = subsCache.get(householdId);
          if (hit) return hit;
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id,user_id,endpoint,p256dh,auth")
            .eq("household_id", householdId);
          const rows = (data ?? []) as SubRow[];
          subsCache.set(householdId, rows);
          return rows;
        };

        let sent = 0;
        const send = async (sub: SubRow, body: string, tag: string | null) => {
          try {
            const payload = await buildPushPayload(
              { data: JSON.stringify({ title: "Bamboo Calendar", body, tag }), options: { ttl: 3600 } },
              { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              vapid,
            );
            const res = await fetch(sub.endpoint, payload);
            if (res.status === 404 || res.status === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            } else if (res.ok) {
              sent += 1;
            }
          } catch {
            // ignore individual delivery failures
          }
        };

        // ---------- 1. Household activity outbox ----------
        const { data: outbox } = await supabase
          .from("push_outbox")
          .select("id,household_id,body,tag,actor_user_id")
          .is("sent_at", null)
          .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: true })
          .limit(100);

        for (const row of outbox ?? []) {
          const subs = await subsFor(row.household_id as string);
          await Promise.all(
            subs
              .filter((s) => s.user_id !== row.actor_user_id)
              .map((s) => send(s, row.body as string, row.tag as string | null)),
          );
        }
        const outboxIds = (outbox ?? []).map((r) => r.id as string);
        if (outboxIds.length) {
          await supabase
            .from("push_outbox")
            .update({ sent_at: new Date().toISOString() })
            .in("id", outboxIds);
        }
        // Drop anything older than the window so it never fires late.
        await supabase
          .from("push_outbox")
          .update({ sent_at: new Date().toISOString() })
          .is("sent_at", null)
          .lte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

        // ---------- 2. Reminders that are due ----------
        const { data: reminders } = await supabase
          .from("reminders")
          .select("id,owner_id,message,channels,recipient_profile_ids")
          .is("pushed_at", null)
          .lte("send_at", new Date().toISOString())
          .limit(100);

        for (const r of reminders ?? []) {
          const channels = (r.channels ?? []) as string[];
          if (channels.includes("app")) {
            const subs = await subsFor(r.owner_id as string);
            await Promise.all(
              subs.map((s) => send(s, `Reminder: ${r.message as string}`, `reminder:${r.id}`)),
            );
          }
          await supabase
            .from("reminders")
            .update({ pushed_at: new Date().toISOString() })
            .eq("id", r.id as string);
        }

        // ---------- 3. Events starting in about an hour ----------
        const now = Date.now();
        const { data: events } = await supabase
          .from("events")
          .select("id,owner_id,title,start_at")
          .gte("start_at", new Date(now).toISOString())
          .lte("start_at", new Date(now + 65 * 60 * 1000).toISOString())
          .limit(200);

        for (const ev of events ?? []) {
          const { error } = await supabase
            .from("event_push_log")
            .insert({ event_id: ev.id as string, kind: "1h" });
          if (error) continue; // already pushed
          const subs = await subsFor(ev.owner_id as string);
          await Promise.all(
            subs.map((s) =>
              send(s, `"${ev.title as string}" starts in about an hour`, `event:1h:${ev.id}`),
            ),
          );
        }

        return new Response(JSON.stringify({ ok: true, sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
