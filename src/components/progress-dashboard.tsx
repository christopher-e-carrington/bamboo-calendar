import { useMemo } from "react";
import { useHousehold, TIERS, type Tier } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Sprout, Target, ListChecks } from "lucide-react";

function pct(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function Ring({ value, color = "hsl(var(--primary))", size = 84 }: { value: number; color?: string; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-xl">{value}%</span>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${value}%`, background: color ?? "hsl(var(--primary))" }}
      />
    </div>
  );
}

export function ProgressDashboard() {
  const { visibleTasks, visibleGoals, profiles, tasks, goals, activeProfile, familyProfile } = useHousehold();

  const tierStats = useMemo(() => {
    return TIERS.map((tier) => {
      const t = visibleTasks.filter((x) => x.tier === tier);
      const g = visibleGoals.filter((x) => x.tier === tier);
      const tDone = t.filter((x) => x.done).length;
      const gDone = g.filter((x) => x.done).length;
      return { tier, tasks: t.length, tasksDone: tDone, goals: g.length, goalsDone: gDone };
    });
  }, [visibleTasks, visibleGoals]);

  const dailyTasks = tierStats.find((s) => s.tier === "daily")!;
  const weeklyTasks = tierStats.find((s) => s.tier === "weekly")!;

  const overallTasksPct = pct(visibleTasks.filter((t) => t.done).length, visibleTasks.length);
  const overallGoalsPct = (() => {
    if (visibleGoals.length === 0) return 0;
    const total = visibleGoals.reduce((a, g) => a + Math.min(g.progress, g.target) / g.target, 0);
    return Math.round((total / visibleGoals.length) * 100);
  })();

  const isFamily = activeProfile?.id === familyProfile?.id;
  const perProfile = profiles.map((p) => {
    const remaining = (isFamily ? tasks : tasks.filter((t) => t.profile_id === p.id || t.profile_id === familyProfile?.id)).filter(
      (t) => t.profile_id === p.id && !t.done,
    ).length;
    const openGoals = goals.filter((g) => g.profile_id === p.id && !g.done).length;
    return { profile: p, remaining, openGoals };
  });

  return (
    <section className="bamboo-card p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sprout className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg">Progress</h2>
        </div>
        <span className="text-xs text-muted-foreground">{isFamily ? "Household" : activeProfile?.name}</span>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl border border-border bg-background/50 p-4 flex items-center gap-4">
          <Ring value={pct(dailyTasks.tasksDone, dailyTasks.tasks)} />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Daily tasks</div>
            <div className="font-medium">{dailyTasks.tasksDone}/{dailyTasks.tasks} done</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/50 p-4 flex items-center gap-4">
          <Ring value={pct(weeklyTasks.tasksDone, weeklyTasks.tasks)} color="hsl(var(--accent-foreground))" />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Weekly tasks</div>
            <div className="font-medium">{weeklyTasks.tasksDone}/{weeklyTasks.tasks} done</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/50 p-4 flex items-center gap-4">
          <Ring value={overallGoalsPct} color="hsl(var(--ring))" />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Goal completion</div>
            <div className="font-medium">{visibleGoals.filter((g) => g.done).length}/{visibleGoals.length} reached</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-medium">Tasks by tier</h3>
            <span className="ml-auto text-xs text-muted-foreground">{overallTasksPct}% overall</span>
          </div>
          <ul className="space-y-2.5">
            {tierStats.map((s) => (
              <li key={`t-${s.tier}`} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="capitalize">{s.tier}</span>
                  <span className="text-muted-foreground text-xs">{s.tasksDone}/{s.tasks}</span>
                </div>
                <Bar value={pct(s.tasksDone, s.tasks)} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-medium">Goals by tier</h3>
            <span className="ml-auto text-xs text-muted-foreground">{overallGoalsPct}% on track</span>
          </div>
          <ul className="space-y-2.5">
            {tierStats.map((s) => {
              const g = visibleGoals.filter((x) => x.tier === (s.tier as Tier));
              const progress = g.length === 0 ? 0 : Math.round((g.reduce((a, x) => a + Math.min(x.progress, x.target) / x.target, 0) / g.length) * 100);
              return (
                <li key={`g-${s.tier}`} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="capitalize">{s.tier}</span>
                    <span className="text-muted-foreground text-xs">{s.goalsDone}/{s.goals}</span>
                  </div>
                  <Bar value={progress} color="hsl(var(--ring))" />
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium mb-3">Remaining per profile</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {perProfile.map(({ profile, remaining, openGoals }) => (
            <div key={profile.id} className="rounded-xl border border-border bg-background/50 p-3 flex items-center gap-3">
              <ProfileAvatar profile={profile} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{profile.name}</div>
                <div className="text-xs text-muted-foreground">{remaining} tasks · {openGoals} goals</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
