import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHousehold, type CalendarEvent } from "@/lib/household-store";
import { expandEvents } from "@/lib/event-recurrence";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Cake, Image as ImageIcon } from "lucide-react";
import { EventDialog } from "./event-dialog";
import { cn } from "@/lib/utils";

type Mode = "day" | "week" | "month";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Expand recurring (yearly) events into virtual occurrences for the year range. */
function expandEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    if (ev.recurrence !== "yearly") {
      out.push(ev);
      continue;
    }
    const base = new Date(ev.start_at);
    const baseEnd = ev.end_at ? new Date(ev.end_at) : null;
    const durationMs = baseEnd ? +baseEnd - +base : 0;
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
      const occ = new Date(base);
      occ.setFullYear(y);
      if (occ >= rangeStart && occ <= rangeEnd) {
        const occEnd = baseEnd ? new Date(+occ + durationMs).toISOString() : null;
        out.push({ ...ev, id: `${ev.id}:${y}`, start_at: occ.toISOString(), end_at: occEnd });
      }
    }
  }
  return out;
}

export function CalendarView() {
  const { user } = useAuth();
  const { visibleEvents, profiles, activeProfile, loading } = useHousehold();
  const [mode, setMode] = useState<Mode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  const days = useMemo(() => {
    if (mode === "day") return [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())];
    if (mode === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor, mode]);

  const expanded = useMemo(() => {
    const rangeStart = new Date(days[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(days[days.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);
    return expandEvents(visibleEvents, rangeStart, rangeEnd);
  }, [visibleEvents, days]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of expanded) {
      const d = new Date(ev.start_at);
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ev);
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
    return m;
  }, [expanded]);

  const { data: memoryDays } = useQuery({
    queryKey: ["memories-days", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("memories").select("memory_date");
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data ?? []) {
        const [y, m, d] = (row.memory_date as string).split("-").map(Number);
        set.add(`${y}-${m - 1}-${d}`);
      }
      return set;
    },
    enabled: !!user,
  });
  const hasMemory = (d: Date) => memoryDays?.has(dayKey(d)) ?? false;



  const shift = (dir: -1 | 1) => {
    const x = new Date(cursor);
    if (mode === "day") x.setDate(x.getDate() + dir);
    else if (mode === "week") x.setDate(x.getDate() + dir * 7);
    else x.setMonth(x.getMonth() + dir);
    setCursor(x);
  };

  const headerLabel =
    mode === "day"
      ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })
      : mode === "week"
      ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : fmtMonth(cursor);

  const onDayClick = (d: Date) => {
    setPickedDate(d);
    setOpen(true);
  };

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const renderProfileDots = (ev: CalendarEvent) => {
    const ids = ev.profile_ids?.length ? ev.profile_ids : [ev.profile_id];
    return (
      <span className="inline-flex -space-x-0.5 ml-1 align-middle">
        {ids.slice(0, 4).map((id) => {
          const p = findProfile(id);
          if (!p) return null;
          return (
            <span
              key={id}
              className="h-2 w-2 rounded-full ring-1 ring-background"
              style={{ background: p.color }}
            />
          );
        })}
      </span>
    );
  };

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        <h1 className="font-display text-lg sm:text-2xl ml-1 min-w-0 truncate">{headerLabel}</h1>
        <div className="ml-auto inline-flex rounded-full bg-secondary p-1">
          {(["day", "week", "month"] as Mode[]).map((m) => (
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

      {mode === "day" ? (
        <div className="bamboo-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-xl">{days[0].getDate()}</div>
            <Button size="sm" variant="ghost" onClick={() => onDayClick(days[0])} className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <ul className="space-y-2">
            {(eventsByDay.get(dayKey(days[0])) ?? []).map((ev) => {
              const ids = ev.profile_ids?.length ? ev.profile_ids : [ev.profile_id];
              const colors = ids.map((id) => findProfile(id)?.color).filter(Boolean) as string[];
              return (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 rounded-xl p-3 border border-border hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 self-stretch">
                    {colors.map((c, i) => (
                      <span key={i} className="w-1 flex-1 rounded-full min-h-3" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ev.contact_id && <Cake className="h-3.5 w-3.5 text-primary" />}
                      <span className="font-medium truncate">{ev.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtTime(ev.start_at)}
                        {ev.end_at && ` – ${fmtTime(ev.end_at)}`}
                      </span>
                    </div>
                    {ev.location && (
                      <div className="text-xs text-muted-foreground mt-0.5">{ev.location}</div>
                    )}
                  </div>
                  <div className="flex -space-x-1 shrink-0">
                    {ids.slice(0, 4).map((id) => {
                      const p = findProfile(id);
                      if (!p) return null;
                      return (
                        <span
                          key={id}
                          title={p.name}
                          className="h-5 w-5 rounded-full ring-2 ring-background text-[9px] grid place-items-center font-medium text-white"
                          style={{ background: p.color }}
                        >
                          {p.initials}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
            {(eventsByDay.get(dayKey(days[0])) ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground py-8 text-center">Nothing scheduled.</li>
            )}
          </ul>
        </div>
      ) : (
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
              mode === "week" ? "auto-rows-[minmax(10rem,1fr)]" : "auto-rows-[minmax(5.5rem,1fr)]",
            )}
          >
            {days.map((d) => {
              const dayEvents = eventsByDay.get(dayKey(d)) ?? [];
              const isToday = sameDay(d, new Date());
              const otherMonth = mode === "month" && d.getMonth() !== cursor.getMonth();
              const limit = mode === "week" ? 5 : 3;
              return (
                <button
                  key={dayKey(d)}
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
                    <div className="flex items-center gap-1">
                      {hasMemory(d) && (
                        <span
                          title="Has memories"
                          className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent text-accent-foreground"
                        >
                          <ImageIcon className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {dayEvents.slice(0, limit).map((ev) => {
                      const ids = ev.profile_ids?.length ? ev.profile_ids : [ev.profile_id];
                      const primary = findProfile(ids[0]);
                      return (
                        <li
                          key={ev.id}
                          className="text-[11px] leading-tight rounded-md px-1.5 py-0.5 truncate"
                          style={{
                            background: primary
                              ? `color-mix(in oklab, ${primary.color} 22%, transparent)`
                              : undefined,
                            borderLeft: primary ? `2px solid ${primary.color}` : undefined,
                          }}
                          title={`${ev.title} · ${fmtTime(ev.start_at)}`}
                        >
                          <span className="font-medium truncate">
                            {ev.contact_id && <Cake className="inline h-2.5 w-2.5 mr-0.5 -mt-0.5" />}
                            {ev.title}
                          </span>
                          {renderProfileDots(ev)}
                        </li>
                      );
                    })}
                    {dayEvents.length > limit && (
                      <li className="text-[10px] text-muted-foreground px-1.5">
                        +{dayEvents.length - limit} more
                      </li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <EventDialog open={open} onOpenChange={setOpen} initialDate={pickedDate ?? undefined} />
    </div>
  );
}
