import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { householdSubscriptionSchema, resolveHouseholdAccess } from "@/lib/household-subscription";

export const getHouseholdSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // No caller-supplied household ID: the database resolves membership from
    // the authenticated identity, not the selected profile or an email.
    const { data, error } = await context.supabase.rpc("get_my_household_subscription");
    if (error) throw new Error("Could not check household subscription status");
    const subscription = householdSubscriptionSchema.parse(data);
    return { ...subscription, ...resolveHouseholdAccess(subscription) };
  });