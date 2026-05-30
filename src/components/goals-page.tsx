import { useState } from "react";
import { useHousehold, TIERS, type Tier } from "@/lib/household-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, Target, Check } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { ProgressDashboard } from "./progress-dashboard";
import { toast } from "sonner";

const TIER_LABEL: Record<Tier, string> = {
  daily: "Daily habits",
  weekly: "Weekly targets",
  monthly: "Monthly achievements",
  quarterly: "Quarterly milestones",
  yearly: "Yearly visions",
};

const TIER_SHORT: Record<Tier, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function GoalsPage() {
  const { visibleGoals, profiles, activeProfile, addGoal, updateGoalProgress, toggleGoalDone, deleteGoal, loading } =
    useHousehold();
  const [tier, setTier] = useState<Tier>("weekly");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(1);
  const [busy, setBusy] = useState(false);

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addGoal({ profile_id: activeProfile.id, title: title.trim(), tier, target: Math.max(1, target) });
      setTitle("");
      setTarget(1);
    } catch {
      toast.error("Couldn't add goal");
    } finally {
      setBusy(false);
    }
  };

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Goals</h1>
          <p className="text-sm text-muted-foreground">Habits, targets and visions · {activeProfile.name}</p>
        </div>
      </header>

      <ProgressDashboard />

      <section className="bamboo-card p-4 sm:p-5">
        <Tabs value={tier} onValueChange={(v) => setTier(v as Tier)}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="bg-secondary/60">
              {TIERS.map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">
                  {TIER_SHORT[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="mt-4 flex flex-col sm:flex-row gap-2"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`New ${TIER_SHORT[tier].toLowerCase()} goal…`}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value || "1", 10))}
                className="w-24"
                aria-label="Target"
              />
              <Button type="submit" disabled={!title.trim() || busy} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </form>

          {TIERS.map((t) => {
            const items = visibleGoals.filter((g) => g.tier === t);
            return (
              <TabsContent key={t} value={t} className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg">{TIER_LABEL[t]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {items.filter((g) => g.done).length} of {items.length} reached
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Set a {TIER_SHORT[t].toLowerCase()} goal above to start growing.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {items.map((g) => {
                      const p = findProfile(g.profile_id);
                      const pct = Math.round((Math.min(g.progress, g.target) / g.target) * 100);
                      return (
                        <li
                          key={g.id}
                          className="group rounded-xl p-3 border border-border bg-background/50 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleGoalDone(g.id, !g.done)}
                              className={`h-6 w-6 rounded-full grid place-items-center border transition-colors ${
                                g.done
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary"
                              }`}
                              aria-label="Toggle goal done"
                            >
                              {g.done && <Check className="h-3.5 w-3.5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${g.done ? "line-through text-muted-foreground" : ""}`}>
                                {g.title}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {g.progress}/{g.target} · {pct}%
                              </div>
                            </div>
                            {p && <ProfileAvatar profile={p} size={24} />}
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateGoalProgress(g.id, g.progress - 1)}
                                disabled={g.progress <= 0}
                                aria-label="Decrease"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateGoalProgress(g.id, g.progress + 1)}
                                disabled={g.progress >= g.target}
                                aria-label="Increase"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              <button
                                onClick={() => deleteGoal(g.id)}
                                className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all ml-1"
                                aria-label="Delete goal"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="h-2 mt-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-[width] duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </section>
    </div>
  );
}
