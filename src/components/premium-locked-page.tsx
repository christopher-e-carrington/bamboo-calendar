import { Leaf, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  featureLabel: string;
  onUpgrade: () => void;
}

export function PremiumLockedPage({ featureLabel, onUpgrade }: Props) {
  return (
    <div className="p-6 md:p-10">
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-[#A7C29A]/15 via-[#E8D9B0]/15 to-[#7BA37A]/10 p-8 md:p-12 text-center shadow-sm">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-[#C9A36B]/15 blur-3xl" />
        <div className="relative">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/90 text-primary-foreground grid place-items-center shadow-md">
            <Leaf className="h-7 w-7" />
          </div>
          <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/60 backdrop-blur border border-primary/20 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> Premium feature
          </div>
          <h2 className="mt-4 font-display text-3xl">
            <Lock className="h-5 w-5 inline mr-2 -mt-1 text-muted-foreground" />
            {featureLabel} is part of Bamboo Premium
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            Grow your household toolkit with the full calendar, goals, projects,
            meals, shopping, routines, inventory, documents, memories, and unlimited members.
          </p>
          <Button size="lg" className="mt-6 bg-primary hover:bg-primary/90" onClick={onUpgrade}>
            <Sparkles className="h-4 w-4 mr-2" /> Upgrade to Premium
          </Button>
          <div className="mt-3 text-xs text-muted-foreground">Starting at $4.99/mo · Cancel anytime</div>
        </div>
      </div>
    </div>
  );
}
