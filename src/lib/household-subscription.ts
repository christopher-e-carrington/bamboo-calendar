import { z } from "zod";

export const householdSubscriptionSchema = z.object({
  householdId: z.string().uuid(),
  isOwner: z.boolean(),
  enforcementEnabled: z.boolean(),
  personalAccess: z.boolean(),
  store: z.enum(["apple", "google"]).nullable(),
  status: z.enum(["trialing", "active", "grace", "expired", "revoked"]).nullable(),
  expiresAt: z.string().nullable(),
  willRenew: z.boolean(),
  verifiedAt: z.string().nullable(),
  checkedAt: z.string(),
});

export type HouseholdSubscription = z.infer<typeof householdSubscriptionSchema>;
export type SubscriptionAccessReason = "personal_preview" | "store_subscription" | "preparation" | "subscription_required";

// Only evaluate authenticated, server-read records. Device state and legacy
// Stripe records must never be used as proof of a store subscription.
export function resolveHouseholdAccess(subscription: HouseholdSubscription): {
  canAccess: boolean;
  reason: SubscriptionAccessReason;
} {
  if (subscription.personalAccess) return { canAccess: true, reason: "personal_preview" };
  const checkedAt = Date.parse(subscription.checkedAt);
  const verifiedAt = subscription.verifiedAt ? Date.parse(subscription.verifiedAt) : NaN;
  const expiresAt = subscription.expiresAt ? Date.parse(subscription.expiresAt) : NaN;
  const storeActive = subscription.store !== null &&
    (subscription.status === "trialing" || subscription.status === "active" || subscription.status === "grace") &&
    Number.isFinite(checkedAt) && Number.isFinite(verifiedAt) && verifiedAt <= checkedAt && expiresAt > checkedAt;
  if (storeActive) return { canAccess: true, reason: "store_subscription" };
  if (!subscription.enforcementEnabled) return { canAccess: true, reason: "preparation" };
  return { canAccess: false, reason: "subscription_required" };
}