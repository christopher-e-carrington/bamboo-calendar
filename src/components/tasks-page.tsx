import { useState } from "react";
import { useHousehold, TIERS, type Tier, type Recurrence } from "@/lib/household-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Repeat, ListChecks, ChevronDown, Sun } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { ProgressDashboard } from "./progress-dashboard";
import { toast } from "sonner";
import { TaskDetailsDialog } from "./task-details-dialog";

const TIER_LABEL: Record<Tier, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function recurrenceLabel(rec: string, due_at: string | null): string {
  if (!rec || rec === "none") return "";
  if (rec === "daily") return "daily";
  if (!due_at) return rec;
  const d = new Date(due_at);
  if (rec === "weekly") return `every ${WEEKDAYS_SHORT[d.getDay()]}`;
  if (rec === "monthly") return `monthly · day ${d.getDate()}`;
  if (rec === "quarterly") return `quarterly · day ${d.getDate()}`;
  if (rec === "yearly") return `yearly · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return rec;
}

function nextWeeklyDue(weekday: number): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d.toISOString();
}

function nextMonthlyDue(dayOfMonth: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 9, 0, 0, 0);
  if (d <= now) d.setMonth(d.getMonth() + 1);
  if (d.getDate() !== dayOfMonth) d.setDate(0);
  return d.toISOString();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function TasksPage() {
  const { visibleTasks, profiles, activeProfile, toggleTask, addTask, deleteTask, loading } = useHousehold();
  const [tier, setTier] = useState<Tier>("daily");
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [weekday, setWeekday] = useState<number>(new Date().getDay());
  const [monthDay, setMonthDay] = useState<number>(new Date().getDate());
  const [busy, setBusy] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      let due_at: string | null = null;
      if (recurrence === "weekly") due_at = nextWeeklyDue(weekday);
      else if (recurrence === "monthly" || recurrence === "quarterly" || recurrence === "yearly")
        due_at = nextMonthlyDue(monthDay);
      await addTask({ profile_id: activeProfile.id, title: title.trim(), tier, recurrence, due_at });
      setTitle("");
      setRecurrence("none");
    } catch {
      toast.error("Couldn't add task");
    } finally {
      setBusy(false);
    }
  };

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  // "Today" rules:
  // - Daily recurrence or daily-tier tasks always show.
  // - Tasks with a due date show only when due_at falls on today.
  // - One-time tasks (recurrence "none") with no due date show until done.
  // - Overdue, undone one-time tasks roll over and show today.
  // Weekly/monthly/quarterly/yearly recurring tasks are auto-rolled forward
  // by the store so they only land on today when their next occurrence hits.
  const now = new Date();
  const todayTasks = visibleTasks.filter((t) => {
    if (t.tier === "daily" || t.recurrence === "daily") return true;
    if (!t.due_at) return t.recurrence === "none";
    const due = new Date(t.due_at);
    if (isSameDay(due, now)) return true;
    // overdue one-time tasks still need attention
    if (t.recurrence === "none" && !t.done && due < now) return true;
    return false;
  });
  const todayOpen = todayTasks.filter((t) => !t.done).length;

  const todayLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">To-Dos</h1>
          <p className="text-sm text-muted-foreground">Today and beyond · {activeProfile.name}</p>
        </div>
      </header>

      {/* Today */}
      <section className="bamboo-card p-4 sm:p-5">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg">Today</h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {todayLabel}</span>
          </div>
          <span className="text-xs text-muted-foreground">{todayOpen} open</span>
        </header>

        {todayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nothing on today's list. Add one below to plant something for the day.
          </p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => {
              const p = findProfile(task.profile_id);
              return (
                <li
                  key={task.id}
                  className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-secondary/60 transition-colors border border-transparent hover:border-border"
                >
                  <Checkbox checked={task.done} onCheckedChange={(v) => toggleTask(task.id, Boolean(v))} />
                  <TaskDetailsDialog
                    task={task}
                    trigger={
                      <button
                        type="button"
                        className={`flex-1 text-left text-sm flex items-center gap-1.5 hover:text-primary transition-colors ${task.done ? "line-through text-muted-foreground" : ""}`}
                      >
                        {task.title}
                        {task.recurrence && task.recurrence !== "none" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                            <Repeat className="h-2.5 w-2.5" />
                            {recurrenceLabel(task.recurrence, task.due_at ?? null)}
                          </span>
                        )}
                        {task.tier && task.tier !== "daily" && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {task.tier}
                          </span>
                        )}
                      </button>
                    }
                  />
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
      </section>

      <ProgressDashboard />

      {/* All to-dos by tier (collapsible) */}
      <Collapsible open={tiersOpen} onOpenChange={setTiersOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full bamboo-card p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-left">
              <span className="font-display text-lg">All to-dos by tier</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Create, review, edit & delete
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${tiersOpen ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
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
                <div className="flex flex-wrap gap-2">
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
                  {recurrence === "weekly" && (
                    <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                      <SelectTrigger className="w-[150px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Every</span>
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {(recurrence === "monthly" || recurrence === "quarterly" || recurrence === "yearly") && (
                    <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
                              <TaskDetailsDialog
                                task={task}
                                trigger={
                                  <button
                                    type="button"
                                    className={`flex-1 text-left text-sm flex items-center gap-1.5 hover:text-primary transition-colors ${task.done ? "line-through text-muted-foreground" : ""}`}
                                  >
                                    {task.title}
                                    {task.recurrence && task.recurrence !== "none" && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                        <Repeat className="h-2.5 w-2.5" />
                                        {recurrenceLabel(task.recurrence, task.due_at ?? null)}
                                      </span>
                                    )}
                                  </button>
                                }
                              />
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
