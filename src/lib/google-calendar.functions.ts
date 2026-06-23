import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

async function householdIdFor(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  return (data?.[0]?.household_id as string | undefined) ?? userId;
}

// ---------- Token management ----------

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  return {
    access_token: json.access_token,
    expires_at: new Date(Date.now() + (json.expires_in - 60) * 1000).toISOString(),
  };
}

async function getValidToken(supabase: any, profileId: string) {
  const { data, error } = await supabase
    .from("profile_google_tokens")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const expiresMs = new Date(data.token_expires_at).getTime();
  if (expiresMs > Date.now() + 30_000) return data;
  const fresh = await refreshAccessToken(data.refresh_token);
  await supabase
    .from("profile_google_tokens")
    .update({ access_token: fresh.access_token, token_expires_at: fresh.expires_at })
    .eq("id", data.id);
  return { ...data, access_token: fresh.access_token, token_expires_at: fresh.expires_at };
}

async function gApi(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  if (res.status === 204 || res.status === 404 || res.status === 410) return null;
  return res.json();
}

function toGoogleEventBody(e: any) {
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

// ---------- Server functions called from the UI ----------

export const startProfileGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("Google OAuth not configured — missing GOOGLE_OAUTH_CLIENT_ID");
    const hid = await householdIdFor(context.supabase, context.userId);
    // Verify the profile belongs to this household
    const { data: prof, error } = await context.supabase
      .from("household_profiles")
      .select("id, owner_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (error) throw error;
    if (!prof || prof.owner_id !== hid) throw new Error("Profile not in your household");

    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const state = signOauthState({ profileId: data.profileId, householdId: hid, nonce });
    const redirectUri = getOauthRedirectUri(data.origin);
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

export const listProfileGoogleConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("profile_google_tokens")
      .select("id, profile_id, google_email, calendar_id, sync_enabled, updated_at")
      .eq("household_id", hid);
    if (error) throw error;
    return { connections: (data ?? []) as any[] };
  });

export const disconnectProfileGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => d)
  .handler(async ({ data, context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("profile_google_tokens")
      .delete()
      .eq("profile_id", data.profileId)
      .eq("household_id", hid);
    if (error) throw error;
    return { ok: true };
  });

export const updateProfileGoogleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string; calendarId?: string; syncEnabled?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.calendarId !== undefined) patch.calendar_id = data.calendarId;
    if (data.syncEnabled !== undefined) patch.sync_enabled = data.syncEnabled;
    const { error } = await context.supabase
      .from("profile_google_tokens")
      .update(patch)
      .eq("profile_id", data.profileId)
      .eq("household_id", hid);
    if (error) throw error;
    return { ok: true };
  });

export const listProfileGoogleCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => d)
  .handler(async ({ data, context }) => {
    const tok = await getValidToken(context.supabase, data.profileId);
    if (!tok) throw new Error("Profile not connected to Google");
    const list = await gApi(tok.access_token, `/users/me/calendarList?maxResults=100`);
    const items = (list?.items ?? []) as any[];
    return {
      calendars: items.map((c) => ({
        id: c.id as string,
        summary: (c.summaryOverride ?? c.summary ?? c.id) as string,
        primary: !!c.primary,
      })),
    };
  });

// Push an event to all assigned profiles that have an active Google connection
export const pushEventToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => d)
  .handler(async ({ data, context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const { data: ev } = await context.supabase
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) return { skipped: true as const };
    const profileIds: string[] = (ev.profile_ids?.length ? ev.profile_ids : [ev.profile_id]).filter(Boolean);
    let pushed = 0;
    for (const pid of profileIds) {
      const tok = await getValidToken(context.supabase, pid);
      if (!tok || !tok.sync_enabled) continue;
      const { data: existing } = await context.supabase
        .from("profile_event_google_sync")
        .select("*")
        .eq("event_id", ev.id)
        .eq("profile_id", pid)
        .maybeSingle();
      const body = toGoogleEventBody(ev);
      try {
        if (existing) {
          await gApi(
            tok.access_token,
            `/calendars/${encodeURIComponent(existing.google_calendar_id)}/events/${encodeURIComponent(existing.google_event_id)}`,
            { method: "PATCH", body: JSON.stringify(body) },
          );
          await context.supabase
            .from("profile_event_google_sync")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          const created = await gApi(
            tok.access_token,
            `/calendars/${encodeURIComponent(tok.calendar_id)}/events`,
            { method: "POST", body: JSON.stringify(body) },
          );
          if (created?.id) {
            await context.supabase.from("profile_event_google_sync").insert({
              event_id: ev.id,
              profile_id: pid,
              household_id: hid,
              google_event_id: created.id,
              google_calendar_id: tok.calendar_id,
              direction: "push",
            });
          }
        }
        pushed += 1;
      } catch (e) {
        console.warn("[google-sync push]", pid, e);
      }
    }
    return { ok: true as const, pushed };
  });

export const deleteEventFromGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("profile_event_google_sync")
      .select("*")
      .eq("event_id", data.eventId);
    for (const m of rows ?? []) {
      const tok = await getValidToken(context.supabase, m.profile_id);
      if (!tok) continue;
      try {
        await gApi(
          tok.access_token,
          `/calendars/${encodeURIComponent(m.google_calendar_id)}/events/${encodeURIComponent(m.google_event_id)}`,
          { method: "DELETE" },
        );
      } catch (e) {
        console.warn("[google-sync delete]", e);
      }
    }
    return { ok: true as const };
  });

export const listUpcomingProfileGoogleEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => d)
  .handler(async ({ data, context }) => {
    const tok = await getValidToken(context.supabase, data.profileId);
    if (!tok) throw new Error("Profile not connected to Google");
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: "50",
      singleEvents: "true",
      orderBy: "startTime",
    });
    const list = await gApi(
      tok.access_token,
      `/calendars/${encodeURIComponent(tok.calendar_id)}/events?${params.toString()}`,
    );
    const { data: existing } = await context.supabase
      .from("profile_event_google_sync")
      .select("google_event_id")
      .eq("profile_id", data.profileId);
    const linked = new Set(((existing ?? []) as any[]).map((r) => r.google_event_id));
    const events = ((list?.items ?? []) as any[]).map((e) => ({
      id: e.id as string,
      title: (e.summary ?? "(no title)") as string,
      start: (e.start?.dateTime ?? e.start?.date) as string | null,
      end: (e.end?.dateTime ?? e.end?.date) as string | null,
      location: (e.location ?? null) as string | null,
      description: (e.description ?? null) as string | null,
      alreadyLinked: linked.has(e.id),
    }));
    return { events };
  });

export const importProfileGoogleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string; googleEventId: string }) => d)
  .handler(async ({ data, context }) => {
    const hid = await householdIdFor(context.supabase, context.userId);
    const tok = await getValidToken(context.supabase, data.profileId);
    if (!tok) throw new Error("Profile not connected to Google");
    const ge = await gApi(
      tok.access_token,
      `/calendars/${encodeURIComponent(tok.calendar_id)}/events/${encodeURIComponent(data.googleEventId)}`,
    );
    if (!ge) throw new Error("Event not found on Google");
    const start = ge.start?.dateTime ?? (ge.start?.date ? `${ge.start.date}T09:00:00.000Z` : null);
    const end = ge.end?.dateTime ?? (ge.end?.date ? `${ge.end.date}T10:00:00.000Z` : null);
    if (!start) throw new Error("Event has no start time");
    const { data: inserted, error } = await context.supabase
      .from("events")
      .insert({
        owner_id: hid,
        profile_id: data.profileId,
        profile_ids: [data.profileId],
        title: (ge.summary ?? "(no title)") as string,
        start_at: start,
        end_at: end,
        location: ge.location ?? null,
        notes: ge.description ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await context.supabase.from("profile_event_google_sync").insert({
      event_id: inserted!.id,
      profile_id: data.profileId,
      household_id: hid,
      google_event_id: ge.id,
      google_calendar_id: tok.calendar_id,
      direction: "import",
    });
    return { ok: true as const };
  });
