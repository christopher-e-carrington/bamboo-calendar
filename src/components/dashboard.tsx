import { useHousehold } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalIcon, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function groupByDay(events: { start: string }[]) {
  const map = new Map<string, number[]>();
  events.forEach((e, i) => {
    const key = formatDay(e.start);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  });
  return map;
}

export function Dashboard() {
  const { visibleEvents, visibleTasks, profiles, toggleTask, activeProfile } = useHousehold();
  const sorted = [...visibleEvents].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const grouped = groupByDay(sorted);
  const findProfile = (id: string) => profiles.find((p) => p.id === id)!;

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full">
      {/* Greeting */}
      <section className="bamboo-card overflow-hidden mb-6 relative">
        <div className="absolute inset-y-0 left-0 w-1.5 bamboo-stripe" />
        <div className="p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
          <ProfileAvatar profile={activeProfile} size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl">
              {activeProfile.id === "family" ? "Together this week" : `Hi, ${activeProfile.name}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sorted.length} upcoming {sorted.length === 1 ? "event" : "events"} · {visibleTasks.filter((t) => !t.done).length} open tasks
            </p>
          </div>
          <Button className="rounded-full gap-1.5 self-start sm:self-center">
            <Sparkles className="h-4 w-4" />
            Add event
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Agenda */}
        <section className="bamboo-card p-5 lg:col-span-2">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Agenda</h2>
            </div>
            <div className="text-xs text-muted-foreground">Upcoming</div>
          </header>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">A quiet stretch ahead. Plant something new.</p>
          ) : (
            <ul className="space-y-5">
              {Array.from(grouped.entries()).map(([day, idxs]) => (
                <li key={day}>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{day}</div>
                  <ul className="space-y-2">
                    {idxs.map((i) => {
                      const e = sorted[i];
                      const p = findProfile(e.profileId);
                      return (
                        <li
                          key={e.id}
                          className="flex items-start gap-3 rounded-xl p-3 hover:bg-secondary/60 transition-colors border border-transparent hover:border-border"
                        >
                          <div
                            className="w-1 self-stretch rounded-full"
                            style={{ background: p.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium truncate">{e.title}</span>
                              <span className="text-xs text-muted-foreground">{formatTime(e.start)}</span>
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

        {/* Tasks */}
        <section className="bamboo-card p-5">
          <header className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">Tasks</h2>
            <div className="text-xs text-muted-foreground">
              {visibleTasks.filter((t) => !t.done).length} open
            </div>
          </header>
          <ul className="space-y-2">
            {visibleTasks.map((t) => {
              const p = findProfile(t.profileId);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-secondary/60 transition-colors"
                >
                  <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
                    {t.title}
                  </span>
                  <ProfileAvatar profile={p} size={22} />
                </li>
              );
            })}
          </ul>
        </section>

        {/* Profiles summary */}
        <section className="bamboo-card p-5 lg:col-span-3">
          <h2 className="font-display text-lg mb-4">Who's busy</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {profiles.map((p) => {
              const count = visibleEvents.filter((e) => e.profileId === p.id).length;
              return (
                <div key={p.id} className="rounded-xl border border-border bg-background/50 p-3 flex items-center gap-3">
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
