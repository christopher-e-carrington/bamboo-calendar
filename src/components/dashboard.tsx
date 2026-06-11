import { useState } from "react";
import { useHousehold, type Recurrence } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalIcon, MapPin, Sparkles, Plus, Trash2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventDialog } from "./event-dialog";
import { ProgressDashboard } from "./progress-dashboard";
import { toast } from "sonner";
import { TaskDetailsDialog } from "./task-details-dialog";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function Dashboard() {
  const { visibleEvents, visibleTasks, profiles, toggleTask, activeProfile, familyProfile, loading, addTask, deleteTask } =
    useHousehold();
  const [newTask, setNewTask] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [adding, setAdding] = useState(false);

  if (loading || !activeProfile) {
    return (
      <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading your household…</div>
    );
  }

  const quickAddTask = async () => {
    if (!newTask.trim()) return;
    setAdding(true);
    try {
      await addTask({
        profile_id: activeProfile.id,
        title: newTask.trim(),
        recurrence,
      });
      setNewTask("");
      setRecurrence("none");
    } catch {
      toast.error("Couldn't add task");
    } finally {
      setAdding(false);
    }
  };

  const sorted = [...visibleEvents].sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  const grouped = new Map<string, typeof sorted>();
  sorted.forEach((e) => {
    const k = formatDay(e.start_at);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(e);
  });

  const findProfile = (id: string) => profiles.find((p) => p.id === id);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const todaysTasks = visibleTasks.filter((t) => !t.due_at || new Date(t.due_at) <= endOfToday);
  const openTodayCount = todaysTasks.filter((t) => !t.done).length;
  const isFamilyView = activeProfile.id === familyProfile?.id;

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full">
      <section className="bamboo-card overflow-hidden mb-6 relative">
        <div className="absolute inset-y-0 left-0 w-1.5 bamboo-stripe" />
        <div className="p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
          <ProfileAvatar profile={activeProfile} size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl">
              {isFamilyView ? "Together this week" : `Hi, ${activeProfile.name}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sorted.length} upcoming {sorted.length === 1 ? "event" : "events"} ·{" "}
              {openTodayCount} open tasks today
            </p>
          </div>
          <EventDialog
            trigger={
              <Button className="rounded-full gap-1.5 self-start sm:self-center">
                <Sparkles className="h-4 w-4" />
                Add event
              </Button>
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <section className="bamboo-card p-5 lg:col-span-2">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Agenda</h2>
            </div>
            <div className="text-xs text-muted-foreground">Upcoming</div>
          </header>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              A quiet stretch ahead. Plant something new.
            </p>
          ) : (
            <ul className="space-y-5">
              {Array.from(grouped.entries()).map(([day, items]) => (
                <li key={day}>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{day}</div>
                  <ul className="space-y-2">
                    {items.map((e) => {
                      const p = findProfile(e.profile_id);
                      if (!p) return null;
                      return (
                        <li
                          key={e.id}
                          className="flex items-start gap-3 rounded-xl p-3 hover:bg-secondary/60 transition-colors border border-transparent hover:border-border"
                        >
                          <div className="w-1 self-stretch rounded-full" style={{ background: p.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium truncate">{e.title}</span>
                              <span className="text-xs text-muted-foreground">{formatTime(e.start_at)}</span>
                            </div>
                            {e.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {e.location}
                              </div>
                            )}
                          </div>
                          <ProfileAvatar profile={p} size={26} />
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bamboo-card p-5">
          <header className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">Tasks</h2>
            <div className="text-xs text-muted-foreground">
              {openTodayCount} open today
            </div>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              quickAddTask();
            }}
            className="flex flex-col gap-2 mb-3"
          >
            <div className="flex gap-2">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Quick add a task…"
                className="h-9"
              />
              <Button type="submit" size="icon" disabled={!newTask.trim() || adding} aria-label="Add task">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger className="h-8 text-xs">
                <div className="flex items-center gap-1.5">
                  <Repeat className="h-3 w-3 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">One-time</SelectItem>
                <SelectItem value="daily">Repeats daily</SelectItem>
                <SelectItem value="weekly">Repeats weekly</SelectItem>
                <SelectItem value="monthly">Repeats monthly</SelectItem>
              </SelectContent>
            </Select>
          </form>

          {visibleTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing on the list.</p>
          ) : (
            <ul className="space-y-2">
              {visibleTasks.map((t) => {
                const p = findProfile(t.profile_id);
                return (
                  <li
                    key={t.id}
                    className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-secondary/60 transition-colors"
                  >
                    <Checkbox checked={t.done} onCheckedChange={(v) => toggleTask(t.id, Boolean(v))} />
                    <TaskDetailsDialog
                      task={t}
                      trigger={
                        <button
                          type="button"
                          className={`flex-1 text-left text-sm flex items-center gap-1.5 hover:text-primary transition-colors ${t.done ? "line-through text-muted-foreground" : ""}`}
                        >
                          {t.title}
                          {t.recurrence && t.recurrence !== "none" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                              <Repeat className="h-2.5 w-2.5" />
                              {t.recurrence}
                            </span>
                          )}
                        </button>
                      }
                    />
                    {p && <ProfileAvatar profile={p} size={22} />}
                    <button
                      onClick={() => deleteTask(t.id)}
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

        <div className="lg:col-span-3">
          <ProgressDashboard />
        </div>

        <section className="bamboo-card p-5 lg:col-span-3">
          <h2 className="font-display text-lg mb-4">Who's busy</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {profiles.map((p) => {
              const count = visibleEvents.filter((e) => e.profile_id === p.id).length;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-background/50 p-3 flex items-center gap-3"
                >
                  <ProfileAvatar profile={p} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{count} this week</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
