import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getHouseholdSubscription } from "@/lib/household-subscription.functions";

function SubscriptionStatus({ userId }: { userId: string }) {
  const checkSubscription = useServerFn(getHouseholdSubscription);
  const { data, refetch, isFetching } = useSuspenseQuery({
    queryKey: ["household-subscription", userId],
    queryFn: async () => {
      try { return await checkSubscription(); }
      catch { return null; }
    },
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: "always",
  });
  const label = !data ? "Status unavailable" :
    data.reason === "personal_preview" ? "Personal household access" :
    data.reason === "preparation" ? "No payment required" :
    data.status === "trialing" ? "Free trial" :
    data.reason === "store_subscription" ? "Subscription active" : "Subscription required";

  return <div className="pt-3 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium" role="status">{label}</span>
      </div>
      <Button variant="ghost" size="icon" aria-label="Refresh subscription status" title="Refresh subscription status" disabled={isFetching} onClick={() => void refetch()}>
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
    {data?.reason === "personal_preview" && <p className="text-sm text-muted-foreground">Your household has a protected personal-access allowance. No subscription payment is required during preparation.</p>}
    {data?.reason === "preparation" && <p className="text-sm text-muted-foreground">Store subscriptions are not active yet. Your household can continue using Bamboo without payment.</p>}
    {!data && <p className="text-sm text-muted-foreground">Connect to the internet and refresh to check your household’s status. Your current access has not changed.</p>}
    {data?.reason === "store_subscription" && <div className="text-sm text-muted-foreground space-y-1">
      <p>{data.store === "apple" ? "Apple App Store" : "Google Play"} · Covers your whole household</p>
      {data.expiresAt && <p>{data.willRenew ? "Renews" : "Access until"} {new Date(data.expiresAt).toLocaleDateString()}</p>}
    </div>}
    {data && <p className="text-xs text-muted-foreground">One subscription covers every household member.</p>}
    <Button variant="outline" size="sm" asChild><Link to="/subscription">Subscription information</Link></Button>
  </div>;
}

export function HouseholdSubscriptionMenu() {
  const { user } = useAuth();
  if (!user) return null;
  return <Suspense fallback={<p className="pt-3 text-sm text-muted-foreground">Checking household subscription…</p>}>
    <SubscriptionStatus userId={user.id} />
  </Suspense>;
}