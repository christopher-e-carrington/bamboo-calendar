import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Sparkles, Check, Loader2 } from "lucide-react";
import { getStripe, hasPaymentsConfigured } from "@/lib/stripe";
import { createPremiumCheckout } from "@/utils/payments.functions";
import { usePremium } from "@/hooks/use-premium";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureLabel?: string;
}

const FEATURES = [
  "Full shared calendar & events",
  "Goals, projects & routines",
  "Meals, shopping lists & inventory",
  "Documents & family memories",
  "Unlimited household members",
  "Priority support & new features",
];

export function UpgradeModal({ open, onOpenChange, featureLabel }: UpgradeModalProps) {
  const [plan, setPlan] = useState<"premium_monthly" | "premium_yearly">("premium_yearly");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPremium, refetch, environment } = usePremium();

  const startCheckout = async () => {
    if (!hasPaymentsConfigured()) {
      setError("Payments are not configured yet. Please try again shortly.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Existing subscribers manage plan changes in Stripe's Billing Portal
      // instead of creating a duplicate subscription.
      if (isPremium) {
        const { createBillingPortalSession } = await import("@/utils/payments.functions");
        const portal = await createBillingPortalSession({
          data: { returnUrl: `${window.location.origin}/`, environment },
        });
        if ("error" in portal) throw new Error(portal.error);
        window.open(portal.url, "_blank", "noopener,noreferrer");
        onOpenChange(false);
        return;
      }
      const result = await createPremiumCheckout({
        data: {
          priceId: plan,
          returnUrl: `${window.location.origin}/?checkout=success`,
          environment,
        },
      });
      if ("error" in result) throw new Error(result.error);
      setClientSecret(result.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setLoading(false);
    }
  };


  const reset = () => {
    setClientSecret(null);
    setError(null);
    refetch();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 border-primary/20">
        {/* Nature-inspired header */}
        <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-[#7BA37A]/20 via-[#A7C29A]/15 to-[#E8D9B0]/20 p-6 pb-4">
          <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-4 h-32 w-32 rounded-full bg-[#C9A36B]/15 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/90 text-primary-foreground grid place-items-center shadow-sm">
                <Leaf className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="bg-white/60 backdrop-blur border-primary/20 text-primary">
                <Sparkles className="h-3 w-3 mr-1" /> Bamboo Premium
              </Badge>
            </div>
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="font-display text-2xl">
                {featureLabel ? `Grow into ${featureLabel}` : "Let your household bloom"}
              </DialogTitle>
              <DialogDescription className="text-foreground/70">
                Unlock the full garden of features for your whole household with Bamboo Premium.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {clientSecret ? (
          <div className="p-4">
            <div id="checkout" className="min-h-[520px]">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
            <div className="pt-3 text-center">
              <button onClick={reset} className="text-xs text-muted-foreground underline">
                Choose a different plan
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 pt-4 space-y-5">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/15 grid place-items-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setPlan("premium_monthly")}
                className={`text-left rounded-xl border-2 p-4 transition ${
                  plan === "premium_monthly"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Monthly</div>
                <div className="mt-1 font-display text-2xl">$4.99<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <div className="text-xs text-muted-foreground mt-1">Cancel anytime</div>
              </button>
              <button
                onClick={() => setPlan("premium_yearly")}
                className={`relative text-left rounded-xl border-2 p-4 transition ${
                  plan === "premium_yearly"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Badge className="absolute -top-2 right-3 bg-[#C9A36B] hover:bg-[#C9A36B] text-white border-none">
                  Save 28%
                </Badge>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Yearly</div>
                <div className="mt-1 font-display text-2xl">$42.99<span className="text-sm font-normal text-muted-foreground">/yr</span></div>
                <div className="text-xs text-muted-foreground mt-1">~$3.58 / month</div>
              </button>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                {error}
              </div>
            )}

            <Button
              size="lg"
              className="w-full bg-primary hover:bg-primary/90"
              onClick={startCheckout}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparing checkout…
                </>
              ) : (
                <>Continue to secure checkout</>
              )}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              Payments are processed securely by Stripe. All plans include a full-featured household with unlimited members.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
