import { useState } from "react";
import { useHousehold, TIERS, type Tier, type Recurrence } from "@/lib/household-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Repeat, ListChecks } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { ProgressDashboard } from "./progress-dashboard";
import { toast } from "sonner";

const TIER_LABEL: Record<Tier, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function TasksPage() {
  const { visibleTasks, profiles, activeProfile, toggleTask, addTask, deleteTask, loading } = useHousehold();
  const [tier, setTier] = useState<Tier>("daily");
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [busy, setBusy] = useState(false);

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addTask({ profile_id: activeProfile.id, title: title.trim(), tier, recurrence });
      setTitle("");
      setRecurrence("none");
    } catch {
      toast.error("Couldn't add task");
    } finally {
      setBusy(false);
    }
  };

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">To-Dos</h1>
          <p className="text-sm text-muted-foreground">Daily through yearly · {activeProfile.name}</p>
        </div>
      </header>

      <ProgressDashboard />

      <section className="bamboo-card p-4 sm:p-5">
        <Tabs value={tier} onValueChange={(v) => setTier(v as Tier)}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="bg-secondary/60">
              {TIERS.map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">
                  {TIER_LABEL[t]}
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
              placeholder={`Add a ${TIER_LABEL[tier].toLowerCase()} to-do…`}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
                <SelectTrigger className="w-[140px]">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!title.trim() || busy} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </form>

          {TIERS.map((t) => {
            const items = visibleTasks.filter((x) => x.tier === t);
            const open = items.filter((x) => !x.done).length;
            return (
              <TabsContent key={t} value={t} className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg">{TIER_LABEL[t]} to-dos</h2>
                  <span className="text-xs text-muted-foreground">{open} of {items.length} open</span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nothing here yet — plant your first {TIER_LABEL[t].toLowerCase()} to-do above.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((task) => {
                      const p = findProfile(task.profile_id);
                      return (
                        <li
                          key={task.id}
                          className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-secondary/60 transition-colors border border-transparent hover:border-border"
                        >
                          <Checkbox checked={task.done} onCheckedChange={(v) => toggleTask(task.id, Boolean(v))} />
                          <span className={`flex-1 text-sm flex items-center gap-1.5 ${task.done ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                            {task.recurrence && task.recurrence !== "none" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                <Repeat className="h-2.5 w-2.5" />
                                {task.recurrence}
                              </span>
                            )}
                          </span>
                          {p && <ProfileAvatar profile={p} size={22} />}
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
