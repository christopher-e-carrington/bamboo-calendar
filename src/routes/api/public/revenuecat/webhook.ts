import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// RevenueCat webhook handler.
//
// Configure in the RevenueCat dashboard:
//   URL:  https://<your-project>.lovable.app/api/public/revenuecat/webhook
//   Authorization header value: matches env var REVENUECAT_WEBHOOK_AUTH
//
// Docs: https://www.revenuecat.com/docs/integrations/webhooks
//
// We treat RevenueCat as the source of truth for iOS/Android purchases and
// (optionally) for Stripe-web purchases if you also wire Stripe → RevenueCat.
// Rows land in the same `public.subscriptions` table used by Stripe, tagged
// with source='revenuecat' and platform='ios' | 'android' | 'stripe' | ...

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

type RCStore =
  | "APP_STORE"
  | "MAC_APP_STORE"
  | "PLAY_STORE"
  | "AMAZON"
  | "STRIPE"
  | "PROMOTIONAL";

function storeToPlatform(store?: RCStore | string): string {
  switch (store) {
    case "APP_STORE":
      return "ios";
    case "MAC_APP_STORE":
      return "mac_app_store";
    case "PLAY_STORE":
      return "android";
    case "AMAZON":
      return "amazon";
    case "STRIPE":
      return "stripe";
    case "PROMOTIONAL":
      return "promotional";
    default:
      return "web";
  }
}

// RC event types -> our subscription status
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
function eventToStatus(eventType: string, expiresAtMs: number | null): string {
  const nowMs = Date.now();
  const activeIfNotExpired = expiresAtMs && expiresAtMs > nowMs ? "active" : "canceled";
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return "active";
    case "TRIAL_STARTED":
      return "trialing";
    case "TRIAL_CONVERTED":
      return "active";
    case "TRIAL_CANCELLED":
    case "CANCELLATION":
      // User cancelled but access continues until expires_at
      return activeIfNotExpired;
    case "BILLING_ISSUE":
      return "past_due";
    case "EXPIRATION":
    case "SUBSCRIPTION_PAUSED":
      return "canceled";
    default:
      return activeIfNotExpired;
  }
}

async function handleEvent(body: any) {
  const event = body?.event;
  if (!event) {
    console.warn("[revenuecat] webhook missing event payload");
    return;
  }

  const eventType: string = event.type;

  // Ignore transfers/tests we don't need to persist
  if (eventType === "TEST") {
    console.log("[revenuecat] TEST event received");
    return;
  }

  // The user id you passed to RevenueCat when identifying the user.
  // Should be your Supabase auth user id (uuid).
  const appUserId: string | undefined =
    event.app_user_id || event.original_app_user_id;
  if (!appUserId) {
    console.warn("[revenuecat] event missing app_user_id");
    return;
  }

  // Validate uuid shape before writing
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(appUserId)) {
    console.warn("[revenuecat] app_user_id is not a uuid, skipping:", appUserId);
    return;
  }

  const entitlementIds: string[] = event.entitlement_ids || [];
  const entitlement = entitlementIds[0] || event.entitlement_id || "premium";

  const store: string | undefined = event.store;
  const platform = storeToPlatform(store);

  const environmentRc: string | undefined = event.environment; // "SANDBOX" | "PRODUCTION"
  const environment = environmentRc === "PRODUCTION" ? "live" : "sandbox";

  const productId: string | undefined = event.product_id;
  const expiresAtMs: number | null = event.expiration_at_ms ?? null;
  const purchasedAtMs: number | null = event.purchased_at_ms ?? null;
  const storeTxnId: string | undefined =
    event.transaction_id || event.original_transaction_id;

  const status = eventToStatus(eventType, expiresAtMs);

  const row = {
    user_id: appUserId,
    source: "revenuecat",
    platform,
    revenuecat_app_user_id: appUserId,
    entitlement,
    store_transaction_id: storeTxnId ?? null,
    product_id: productId ?? null,
    price_id: productId ?? null, // RC doesn't have a separate price concept for stores
    status,
    current_period_start: purchasedAtMs
      ? new Date(purchasedAtMs).toISOString()
      : null,
    current_period_end: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    cancel_at_period_end:
      eventType === "CANCELLATION" || eventType === "TRIAL_CANCELLED",
    environment,
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(row, {
      onConflict: "revenuecat_app_user_id,entitlement,environment",
    });

  if (error) {
    console.error("[revenuecat] upsert failed:", error);
    throw error;
  }

  console.log("[revenuecat] applied event", {
    eventType,
    appUserId,
    entitlement,
    platform,
    environment,
    status,
  });
}

export const Route = createFileRoute("/api/public/revenuecat/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
        if (!expected) {
          console.error("[revenuecat] REVENUECAT_WEBHOOK_AUTH not configured");
          return new Response("Server not configured", { status: 500 });
        }

        const provided = request.headers.get("authorization") ?? "";
        if (provided !== expected) {
          console.warn("[revenuecat] invalid authorization header");
          return new Response("Unauthorized", { status: 401 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch (e) {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          await handleEvent(body);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[revenuecat] handler error", e);
          // Return 500 so RevenueCat retries
          return new Response("Handler error", { status: 500 });
        }
      },
    },
  },
});
