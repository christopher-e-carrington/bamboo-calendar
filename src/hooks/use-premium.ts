import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getStripeEnvironment, hasPaymentsConfigured } from "@/lib/stripe";

/**
 * Set of page ids that require an active Premium subscription.
 * Keep in sync with sidebar NAV_ITEMS and the router in routes/index.tsx.
 */
export const PREMIUM_PAGES = new Set<string>([
  "calendar",
  "events",
  "goals",
  "projects",
  "shopping",
  "meals",
  "routines",
  "inventory",
  "documents",
  "memories",
]);

export const FREE_MEMBER_LIMIT = 2;

function currentEnv(): "sandbox" | "live" {
  try {
    return getStripeEnvironment();
  } catch {
    return "sandbox";
  }
}

export function usePremium() {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setHouseholdId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (!cancelled) {
        setHouseholdId((data?.[0]?.household_id as string | undefined) ?? user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const env = currentEnv();

  const q = useQuery({
    queryKey: ["household-premium", householdId, env],
    enabled: !!householdId && hasPaymentsConfigured(),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("household_is_premium" as never, {
        _household: householdId!,
        _env: env,
      } as never);
      if (error) return false;
      return Boolean(data);
    },
    refetchInterval: 30_000,
  });

  return {
    isPremium: q.data ?? false,
    isLoading: q.isLoading,
    refetch: q.refetch,
    householdId,
    environment: env,
  };
}

export function useHouseholdMemberCount() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Find the household id (owner)
      const { data: mem } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const householdId = (mem?.[0]?.household_id as string | undefined) ?? user.id;
      const { count: members } = await supabase
        .from("household_members")
        .select("*", { count: "exact", head: true })
        .eq("household_id", householdId);
      // Owner + members. Owner is not necessarily a row in members table.
      const isOwner = householdId === user.id;
      const total = (members ?? 0) + (isOwner ? 1 : 0);
      if (!cancelled) setCount(Math.max(total, 1));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return count;
}
