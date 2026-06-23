import { createHmac, timingSafeEqual } from "crypto";

export function signOauthState(payload: { profileId: string; householdId: string; nonce: string }) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for OAuth state signing");
  const body = `${payload.profileId}.${payload.householdId}.${payload.nonce}`;
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return Buffer.from(`${body}.${sig}`).toString("base64url");
}

export function verifyOauthState(state: string): { profileId: string; householdId: string } {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  const raw = Buffer.from(state, "base64url").toString("utf8");
  const parts = raw.split(".");
  if (parts.length !== 4) throw new Error("Bad state");
  const [profileId, householdId, nonce, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${profileId}.${householdId}.${nonce}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid state signature");
  return { profileId, householdId };
}

export function getOauthRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/google-oauth-callback`;
}
