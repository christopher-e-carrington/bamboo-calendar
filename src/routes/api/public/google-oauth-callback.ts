import { createFileRoute } from "@tanstack/react-router";
import { verifyOauthState, getOauthRedirectUri } from "@/lib/google-calendar.server";

function htmlPage(message: string, ok: boolean) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google Calendar</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f6f5f1;color:#2a2a2a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.card{background:#fff;border-radius:16px;padding:32px;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.08);text-align:center}
h1{margin:0 0 8px;font-size:20px}p{margin:0 0 20px;color:#666;font-size:14px;line-height:1.5}
a{display:inline-block;background:${ok ? "#7BA37A" : "#c66"};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;font-size:14px}</style>
</head><body><div class="card"><h1>${ok ? "Connected!" : "Couldn't connect"}</h1><p>${message}</p><a href="/">Back to Bamboo</a></div>
<script>setTimeout(()=>{window.location.href="/?google_connected=${ok ? "1" : "0"}"},1500);</script>
</body></html>`;
}

export const Route = createFileRoute("/api/public/google-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError) {
          return new Response(htmlPage(`Google reported: ${oauthError}`, false), {
            status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        if (!code || !state) {
          return new Response(htmlPage("Missing authorization code.", false), {
            status: 400, headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        try {
          const { profileId, householdId } = verifyOauthState(state);
          const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
          if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

          const redirectUri = getOauthRedirectUri(url.origin);
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });
          if (!tokenRes.ok) {
            const t = await tokenRes.text();
            throw new Error(`Token exchange failed (${tokenRes.status}): ${t.slice(0, 300)}`);
          }
          const tokens = await tokenRes.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
            scope?: string;
            id_token?: string;
          };

          // Fetch user email
          let email: string | null = null;
          try {
            const uiRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            if (uiRes.ok) {
              const ui = await uiRes.json() as { email?: string };
              email = ui.email ?? null;
            }
          } catch { /* non-fatal */ }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

          // If reconnecting, keep prior refresh token when Google omits it
          let refreshToken = tokens.refresh_token;
          if (!refreshToken) {
            const { data: prior } = await supabaseAdmin
              .from("profile_google_tokens")
              .select("refresh_token")
              .eq("profile_id", profileId)
              .maybeSingle();
            refreshToken = prior?.refresh_token;
          }
          if (!refreshToken) {
            throw new Error("Google did not return a refresh token. Remove app access at myaccount.google.com → Security → Third-party access, then reconnect.");
          }

          const { error } = await supabaseAdmin
            .from("profile_google_tokens")
            .upsert({
              profile_id: profileId,
              household_id: householdId,
              google_email: email,
              access_token: tokens.access_token,
              refresh_token: refreshToken,
              token_expires_at: expiresAt,
              scope: tokens.scope ?? null,
              sync_enabled: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: "profile_id" });
          if (error) throw error;

          return new Response(
            htmlPage(`Google Calendar connected${email ? ` as ${email}` : ""}.`, true),
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        } catch (e: any) {
          console.error("[google-oauth-callback]", e);
          return new Response(htmlPage(e?.message ?? "Connection failed.", false), {
            status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      },
    },
  },
});
