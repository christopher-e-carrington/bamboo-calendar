import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

async function gw(path: string, init: RequestInit = {}) {
  const lk = process.env.LOVABLE_API_KEY;
  const ck = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lk || !ck) throw new Error("Google Calendar connector not configured");
  const res = await fetch(`${GW}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lk}`,
      "X-Connection-Api-Key": ck,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const t = await res.text();
    throw new Error(`Google Calendar ${res.status}: ${t.slice(0, 400)}`);
  }
  if (res.status === 204 || res.status === 404 || res.status === 410) return null;
  return res.json();
}

async function householdIdFor(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  return (data?.[0]?.household_id as string | undefined) ?? userId;
}

async function settingsFor(supabase: any, householdId: string) {
  const { data } = await supabase
    .from("google_calendar_settings")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  return data as { household_id: string; calendar_id: string; sync_enabled: boolean } | null;
}

function toGoogleBody(e: any) {
  const start = new Date(e.start_at);
  const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const body: any = {
    summary: e.title,
    description: e.notes ?? undefined,
    location: e.location ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
  if (e.recurrence === "yearly") body.recurrence = ["RRULE:FREQ=YEARLY"];
  return body;
}

export const listGoogleCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const data = await gw(`/users/me/calendarList?maxResults=100`);
    const items = (data?.items ?? []) as any[];
    return {
      calendars: items.map((c) => ({
        id: c.id as string,
        summary: (c.summaryOverride ?? c.summary ?? c.id) as string,
        primary: !!c.primary,
        accessRole: c.accessRole as string,
      })),
    };
  });

export const getGoogleSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const s = await settingsFor(context.supabase, hid);
    return { settings: s };
  });

export const saveGoogleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { calendarId: string; syncEnabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("google_calendar_settings")
      .upsert({
        household_id: hid,
        calendar_id: data.calendarId,
        sync_enabled: data.syncEnabled,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    return { ok: true };
  });

export const pushEventToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => d)
  .handler(async ({ data, context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const s = await settingsFor(context.supabase, hid);
    if (!s || !s.sync_enabled) return { skipped: true as const };
    const { data: ev } = await context.supabase
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) return { skipped: true as const };
    const { data: existing } = await (context.supabase as any)
      .from("event_google_sync")
      .select("*")
      .eq("event_id", ev.id)
      .maybeSingle();
    const body = toGoogleBody(ev);
    if (existing) {
      await gw(
        `/calendars/${encodeURIComponent(existing.google_calendar_id)}/events/${encodeURIComponent(existing.google_event_id)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      await (context.supabase as any)
        .from("event_google_sync")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("event_id", ev.id);
    } else {
      const created = await gw(
        `/calendars/${encodeURIComponent(s.calendar_id)}/events`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (created?.id) {
        await (context.supabase as any).from("event_google_sync").insert({
          event_id: ev.id,
          household_id: hid,
          google_event_id: created.id,
          google_calendar_id: s.calendar_id,
          direction: "push",
        });
      }
    }
    return { ok: true as const };
  });

export const deleteEventFromGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: m } = await (context.supabase as any)
      .from("event_google_sync")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (!m) return { skipped: true as const };
    try {
      await gw(
        `/calendars/${encodeURIComponent(m.google_calendar_id)}/events/${encodeURIComponent(m.google_event_id)}`,
        { method: "DELETE" },
      );
    } catch {
      // ignore — event may already be gone on Google's side
    }
    return { ok: true as const };
  });

export const listUpcomingGoogleEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const s = await settingsFor(context.supabase, hid);
    if (!s) return { events: [] as any[], settingsMissing: true as const };
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: "30",
      singleEvents: "true",
      orderBy: "startTime",
    });
    const data = await gw(
      `/calendars/${encodeURIComponent(s.calendar_id)}/events?${params.toString()}`,
    );
    const { data: existing } = await (context.supabase as any)
      .from("event_google_sync")
      .select("google_event_id")
      .eq("household_id", hid);
    const linked = new Set(((existing ?? []) as any[]).map((r) => r.google_event_id));
    const events = ((data?.items ?? []) as any[]).map((e) => ({
      id: e.id as string,
      title: (e.summary ?? "(no title)") as string,
      start: (e.start?.dateTime ?? e.start?.date) as string | null,
      end: (e.end?.dateTime ?? e.end?.date) as string | null,
      location: (e.location ?? null) as string | null,
      description: (e.description ?? null) as string | null,
      alreadyLinked: linked.has(e.id),
    }));
    return { events, settingsMissing: false as const };
  });

export const importGoogleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { googleEventId: string; profileIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    if (!data.profileIds.length) throw new Error("Assign at least one profile");
    const hid = await householdIdFor(context.supabase, context.userId);
    const s = await settingsFor(context.supabase, hid);
    if (!s) throw new Error("Google Calendar not configured");
    const ge = await gw(
      `/calendars/${encodeURIComponent(s.calendar_id)}/events/${encodeURIComponent(data.googleEventId)}`,
    );
    if (!ge) throw new Error("Event not found on Google");
    const start =
      ge.start?.dateTime ??
      (ge.start?.date ? `${ge.start.date}T09:00:00.000Z` : null);
    const end =
      ge.end?.dateTime ??
      (ge.end?.date ? `${ge.end.date}T10:00:00.000Z` : null);
    if (!start) throw new Error("Event has no start time");
    const { data: inserted, error } = await context.supabase
      .from("events")
      .insert({
        owner_id: hid,
        profile_id: data.profileIds[0],
        profile_ids: data.profileIds,
        title: (ge.summary ?? "(no title)") as string,
        start_at: start,
        end_at: end,
        location: ge.location ?? null,
        notes: ge.description ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await (context.supabase as any).from("event_google_sync").insert({
      event_id: inserted!.id,
      household_id: hid,
      google_event_id: ge.id,
      google_calendar_id: s.calendar_id,
      direction: "import",
    });
    return { ok: true as const };
  });
