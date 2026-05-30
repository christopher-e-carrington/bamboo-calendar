import { useMemo, useState } from "react";
import { useHousehold } from "@/lib/household-store";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EventDialog } from "./event-dialog";
import { cn } from "@/lib/utils";

type Mode = "week" | "month";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
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
function fmtMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CalendarView() {
  const { visibleEvents, profiles, activeProfile, loading } = useHousehold();
  const [mode, setMode] = useState<Mode>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor, mode]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, typeof visibleEvents>();
    for (const ev of visibleEvents) {
      const d = new Date(ev.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(ev);
    }
    return m;
  }, [visibleEvents]);

  const shift = (dir: -1 | 1) => {
    const x = new Date(cursor);
    if (mode === "week") x.setDate(x.getDate() + dir * 7);
    else x.setMonth(x.getMonth() + dir);
    setCursor(x);
  };

  const headerLabel = mode === "week"
    ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : fmtMonth(cursor);

  const onDayClick = (d: Date) => {
    setPickedDate(d);
    setOpen(true);
  };

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        <h1 className="font-display text-xl sm:text-2xl ml-1">{headerLabel}</h1>
        <div className="ml-auto inline-flex rounded-full bg-secondary p-1">
          {(["week", "month"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 text-xs rounded-full capitalize transition-colors",
                mode === m ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="bamboo-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/40">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-[11px] uppercase tracking-wider text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "grid grid-cols-7",
            mode === "week" ? "auto-rows-[minmax(11rem,1fr)]" : "auto-rows-[minmax(5.5rem,1fr)]",
          )}
        >
          {days.map((d) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = (eventsByDay.get(key) ?? []).sort(
              (a, b) => +new Date(a.start_at) - +new Date(b.start_at),
            );
            const isToday = sameDay(d, new Date());
            const otherMonth = mode === "month" && d.getMonth() !== cursor.getMonth();
            return (
              <button
                key={key}
                onClick={() => onDayClick(d)}
                className={cn(
                  "group text-left border-r border-b border-border last:border-r-0 p-1.5 sm:p-2 hover:bg-secondary/50 transition-colors relative overflow-hidden",
                  otherMonth && "bg-muted/30 text-muted-foreground/60",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-medium inline-flex items-center justify-center h-6 w-6 rounded-full",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <ul className="space-y-1">
                  {dayEvents.slice(0, mode === "week" ? 6 : 3).map((ev) => {
                    const p = findProfile(ev.profile_id);
                    return (
                      <li
                        key={ev.id}
                        className="text-[11px] leading-tight rounded-md px-1.5 py-0.5 truncate"
                        style={{
                          background: p ? `color-mix(in oklab, ${p.color} 22%, transparent)` : undefined,
                          borderLeft: p ? `2px solid ${p.color}` : undefined,
                        }}
                        title={`${ev.title} · ${fmtTime(ev.start_at)}`}
                      >
                        <span className="font-medium">{ev.title}</span>
                        {mode === "week" && (
                          <span className="text-muted-foreground ml-1">{fmtTime(ev.start_at)}</span>
                        )}
                      </li>
                    );
                  })}
                  {dayEvents.length > (mode === "week" ? 6 : 3) && (
                    <li className="text-[10px] text-muted-foreground px-1.5">
                      +{dayEvents.length - (mode === "week" ? 6 : 3)} more
                    </li>
                  )}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      <EventDialog open={open} onOpenChange={setOpen} initialDate={pickedDate ?? undefined} />
    </div>
  );
}
