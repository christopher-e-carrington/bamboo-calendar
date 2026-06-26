import { useMemo } from "react";
import { useHousehold, type CalendarEvent, type TaskItem } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { TaskDetailsDialog } from "./task-details-dialog";
import {
  CalendarClock,
  CalendarDays,
  CheckSquare,
  MapPin,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ThisWeekPage() {
  const { visibleEvents, visibleTasks, visibleGoals, profiles, activeProfile } = useHousehold();

  const today = startOfDay(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);
  const weekEnd = addDays(today, 7);

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  // Events in the next 7 days
  const weekEvents = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => {
          const t = new Date(e.start_at);
          return t >= today && t < weekEnd;
        })
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [visibleEvents, today, weekEnd],
  );

  // Tasks that fall within this week (daily recurring shows every day; others on their due date)
  const tasksForDay = (day: Date): TaskItem[] => {
    return visibleTasks.filter((t) => {
      if (t.done) return false;
      if (t.recurrence === "daily") return true;
      if (!t.due_at) return sameDay(day, today); // floating todos show today
      return sameDay(new Date(t.due_at), day);
    });
  };

  const eventsForDay = (day: Date): CalendarEvent[] =>
    weekEvents.filter((e) => sameDay(new Date(e.start_at), day));

  const openGoals = useMemo(() => visibleGoals.filter((g) => !g.done), [visibleGoals]);

  const totalEvents = weekEvents.length;
  const totalTaskItems = useMemo(() => {
    return days.reduce((sum, d) => sum + tasksForDay(d).length, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTasks, days]);

  const busiestDay = useMemo(() => {
    let best = days[0];
    let bestCount = -1;
    for (const d of days) {
      const c = eventsForDay(d).length + tasksForDay(d).length;
      if (c > bestCount) {
        best = d;
        bestCount = c;
      }
    }
    return { day: best, count: bestCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, weekEvents, visibleTasks]);

  const greeting = activeProfile?.name ? `, ${activeProfile.name.split(" ")[0]}` : "";
  const weekLabel = `${today.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(
    today,
    6,
  ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <header className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 p-5 md:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> The week ahead
            </div>
            <h1 className="font-display text-2xl md:text-3xl mt-1">This week{greeting}</h1>
            <p className="text-sm text-muted-foreground mt-1">{weekLabel}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
            <Stat icon={CalendarClock} label="Events" value={totalEvents} />
            <Stat icon={CheckSquare} label="To-dos" value={totalTaskItems} />
            <Stat icon={Target} label="Goals" value={openGoals.length} />
          </div>
        </div>

        {busiestDay.count > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Busiest day:{" "}
            <span className="font-medium text-foreground">
              {busiestDay.day.toLocaleDateString(undefined, { weekday: "long" })}
            </span>{" "}
            • {busiestDay.count} item{busiestDay.count === 1 ? "" : "s"}
          </div>
        )}
      </header>

      {/* Daily breakdown */}
      <section className="rounded-2xl border border-border bg-card/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Day by day
        </div>
        <div className="space-y-3">
          {days.map((day, idx) => {
            const evts = eventsForDay(day);
            const tks = tasksForDay(day);
            const isToday = sameDay(day, today);
            const isEmpty = evts.length === 0 && tks.length === 0;
            return (
              <div
                key={day.toISOString()}
                className={`rounded-xl border transition-colors ${
                  isToday
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 bg-background/40"
                }`}
              >
                <div className="flex items-stretch">
                  {/* Date rail */}
                  <div
                    className={`w-16 md:w-20 shrink-0 flex flex-col items-center justify-center py-3 px-2 rounded-l-xl ${
                      isToday ? "bg-primary text-primary-foreground" : "bg-muted/40 text-foreground"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-80">
                      {isToday ? "Today" : DAY_LABELS[day.getDay()]}
                    </div>
                    <div className="font-display text-2xl leading-none mt-0.5">
                      {day.getDate()}
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-80">
                      {day.toLocaleDateString(undefined, { month: "short" })}
                    </div>
                  </div>

                  {/* Day contents */}
                  <div className="flex-1 min-w-0 p-3 space-y-2">
                    {isEmpty && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-2">
                        <Sun className="h-3.5 w-3.5" />
                        {idx === 0 ? "Nothing scheduled — a clear day." : "Open day."}
                      </div>
                    )}

                    {evts.map((e) => {
                      const ids = e.profile_ids?.length ? e.profile_ids : [e.profile_id];
                      const ps = ids.map((id) => profileMap[id]).filter(Boolean);
                      return (
                        <div
                          key={e.id}
                          className="flex items-center gap-2 rounded-lg bg-card/80 border border-border/60 px-2.5 py-2 text-sm"
                        >
                          <div className="w-1 h-8 rounded-full bg-primary/70 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{e.title}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" />
                                {fmtTime(new Date(e.start_at))}
                              </span>
                              {e.location && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3" /> {e.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex -space-x-2 shrink-0">
                            {ps.slice(0, 3).map((p) => (
                              <ProfileAvatar key={p.id} profile={p} size={20} />
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {tks.map((t) => {
                      const p = profileMap[t.profile_id];
                      return (
                        <TaskDetailsDialog
                          key={t.id}
                          task={t}
                          trigger={
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 rounded-lg bg-secondary/40 hover:bg-secondary/70 border border-border/40 px-2.5 py-1.5 text-sm text-left transition-colors"
                            >
                              <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="flex-1 truncate">{t.title}</span>
                              {t.recurrence !== "none" && (
                                <span className="text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                  {t.recurrence}
                                </span>
                              )}
                              {p && <ProfileAvatar profile={p} size={18} />}
                            </button>
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Goals in focus */}
      {openGoals.length > 0 && (
        <section className="rounded-2xl border border-border bg-card/60 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Target className="h-4 w-4" /> Goals in focus
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {openGoals.slice(0, 6).map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
              const p = profileMap[g.profile_id];
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    {p && <ProfileAvatar profile={p} size={20} />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{g.title}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {g.tier} goal
                      </div>
                    </div>
                    <div className="text-xs font-medium text-primary">{pct}%</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-card/70 border border-border/60 px-3 py-2 min-w-[72px]">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="font-display text-xl leading-tight mt-0.5">{value}</div>
    </div>
  );
}
