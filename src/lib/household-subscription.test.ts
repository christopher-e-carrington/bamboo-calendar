import { describe, expect, it } from "vitest";
import { resolveHouseholdAccess, type HouseholdSubscription } from "./household-subscription";

const household: HouseholdSubscription = {
  householdId: "11111111-1111-4111-8111-111111111111",
  isOwner: true, enforcementEnabled: false, personalAccess: false,
  store: null, status: null, expiresAt: null, willRenew: false, verifiedAt: null,
  checkedAt: "2026-11-24T03:00:00Z",
};
const paid: HouseholdSubscription = {
  ...household, enforcementEnabled: true, store: "apple", status: "active",
  expiresAt: "2026-12-24T03:00:00Z", verifiedAt: "2026-11-24T02:00:00Z", willRenew: true,
};

describe("household subscription access", () => {
  it("preserves existing unpaid access while preparation restrictions are off", () => {
    expect(resolveHouseholdAccess(household)).toEqual({ canAccess: true, reason: "preparation" });
  });
  it("preserves personal household access even when future restrictions are enabled", () => {
    expect(resolveHouseholdAccess({ ...household, enforcementEnabled: true, personalAccess: true }))
      .toEqual({ canAccess: true, reason: "personal_preview" });
  });
  it("covers invited members with the household owner's subscription", () => {
    expect(resolveHouseholdAccess({ ...paid, isOwner: false })).toEqual(resolveHouseholdAccess(paid));
    expect(resolveHouseholdAccess({ ...paid, isOwner: false }).canAccess).toBe(true);
  });
  it("covers invited members with the personal household's allowance", () => {
    expect(resolveHouseholdAccess({ ...household, isOwner: false, personalAccess: true, enforcementEnabled: true }).canAccess).toBe(true);
  });
  it("accepts a verified Google introductory trial for the household", () => {
    expect(resolveHouseholdAccess({ ...paid, store: "google", status: "trialing" }).reason).toBe("store_subscription");
  });
  it("retains canceled subscriptions until their paid period ends", () => {
    expect(resolveHouseholdAccess({ ...paid, willRenew: false }).canAccess).toBe(true);
  });
  it("accepts only an unexpired verified grace period", () => {
    expect(resolveHouseholdAccess({ ...paid, status: "grace" }).canAccess).toBe(true);
    expect(resolveHouseholdAccess({ ...paid, status: "grace", expiresAt: household.checkedAt }).canAccess).toBe(false);
  });
  it("rejects an expired period at the exact expiration boundary", () => {
    expect(resolveHouseholdAccess({ ...paid, expiresAt: household.checkedAt }).canAccess).toBe(false);
  });
  it("rejects revoked purchases even if they have a future expiration date", () => {
    expect(resolveHouseholdAccess({ ...paid, status: "revoked" }).canAccess).toBe(false);
  });
  it("rejects expired store status even if its expiration date is in the future", () => {
    expect(resolveHouseholdAccess({ ...paid, status: "expired" }).canAccess).toBe(false);
  });
  it("requires server-verified store records", () => {
    expect(resolveHouseholdAccess({ ...paid, verifiedAt: null }).canAccess).toBe(false);
    expect(resolveHouseholdAccess({ ...paid, store: null }).canAccess).toBe(false);
    expect(resolveHouseholdAccess({ ...paid, verifiedAt: "2027-01-01T00:00:00Z" }).canAccess).toBe(false);
  });
  it("requires a subscription only after enforcement is explicitly enabled", () => {
    expect(resolveHouseholdAccess({ ...household, enforcementEnabled: true }))
      .toEqual({ canAccess: false, reason: "subscription_required" });
  });
});