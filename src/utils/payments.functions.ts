import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import type Stripe from "stripe";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

async function ensureMawmawPromoCode(
  stripe: ReturnType<typeof createStripeClient>,
): Promise<void> {
  const existing = await stripe.promotionCodes.list({ code: "mawmaw", limit: 1 });
  if (existing.data.length) return;
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: "forever",
    name: "Mawmaw — Free Forever",
  });
  await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: "mawmaw",
  } as Stripe.PromotionCodeCreateParams);
}

const CheckoutSchema = z.object({
  priceId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

export const createPremiumCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CheckoutSchema.parse(data))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const env = data.environment as StripeEnv;
      const stripe = createStripeClient(env);
      const { userId, supabase } = context;
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? undefined;

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      // Ensure the "mawmaw" 100%-off-forever promo code exists (idempotent).
      await ensureMawmawPromoCode(stripe);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        allow_promotion_codes: true,
        metadata: { userId },
        ...(isRecurring && {
          subscription_data: {
            metadata: { userId },
            trial_period_days: 30,
            // Don't require a payment method during the 30-day trial.
            trial_settings: {
              end_behavior: { missing_payment_method: "cancel" },
            },
          },
          payment_method_collection: "if_required",
        }),
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

const PortalSchema = z.object({
  returnUrl: z.string().url().optional(),
  environment: z.enum(["sandbox", "live"]),
});

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PortalSchema.parse(data))
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions" as never)
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (error || !customerId) return { error: "No subscription found" };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
