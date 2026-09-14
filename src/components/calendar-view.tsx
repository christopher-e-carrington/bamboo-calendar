import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHousehold, type CalendarEvent } from "@/lib/household-store";
import { expandEvents } from "@/lib/event-recurrence";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Cake, Image as ImageIcon, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EventDialog } from "./event-dialog";
import { cn } from "@/lib/utils";

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
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function eventDayBounds(ev: CalendarEvent) {
  const start = new Date(ev.start_at);
  if (isNaN(start.getTime())) return null;
  let end = ev.end_at ? new Date(ev.end_at) : new Date(start);
  if (isNaN(end.getTime()) || +end < +start) end = new Date(start);
  if (+end > +start && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
    end = new Date(+end - 1000);
  }
  return {
    start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
    end: new Date(end.getFullYear(), end.getMonth(), end.getDate()),
  };
}

type WeekEventSegment = {
  event: CalendarEvent;
  startColumn: number;
  endColumn: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};


export function CalendarView() {
  const { user } = useAuth();
  const { visibleEvents, profiles, activeProfile, loading } = useHousehold();
  const [cursor, setCursor] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  });
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const expanded = useMemo(() => {
    const rangeStart = new Date(days[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(days[days.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);
    // widen the start so multi-day events that began earlier still appear
    const lookBack = new Date(rangeStart);
    lookBack.setDate(lookBack.getDate() - 366);
    return expandEvents(visibleEvents || [], lookBack, rangeEnd);
  }, [visibleEvents, days]);

  const calendarWeeks = useMemo(() => {
    return Array.from({ length: 6 }, (_, weekIndex) => {
      const weekDays = days.slice(weekIndex * 7, weekIndex * 7 + 7);
      const weekStart = new Date(weekDays[0]);
      const weekEnd = new Date(weekDays[6]);
      const candidates = expanded
        .map((event) => ({ event, bounds: eventDayBounds(event) }))
        .filter(
          (entry): entry is { event: CalendarEvent; bounds: NonNullable<ReturnType<typeof eventDayBounds>> } =>
            entry.bounds !== null && +entry.bounds.end >= +weekStart && +entry.bounds.start <= +weekEnd,
        )
        .sort((a, b) => {
          const startDifference = +a.bounds.start - +b.bounds.start;
          if (startDifference !== 0) return startDifference;
          return +b.bounds.end - +a.bounds.end;
        });

      const laneEnds: number[] = [];
      const segments: WeekEventSegment[] = candidates.map(({ event, bounds }) => {
        const clippedStart = +bounds.start < +weekStart ? weekStart : bounds.start;
        const clippedEnd = +bounds.end > +weekEnd ? weekEnd : bounds.end;
        const startColumn = clippedStart.getDay() + 1;
        const endColumn = clippedEnd.getDay() + 1;
        let lane = laneEnds.findIndex((lastColumn) => lastColumn < startColumn);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(endColumn);
        } else {
          laneEnds[lane] = endColumn;
        }
        return {
          event,
          startColumn,
          endColumn,
          lane,
          continuesBefore: +bounds.start < +weekStart,
          continuesAfter: +bounds.end > +weekEnd,
        };
      });

      return { weekDays, segments, laneCount: laneEnds.length };
    });
  }, [days, expanded]);

  // Every day an occurrence covers, clipped to [from, to]
  const daysCovered = (ev: CalendarEvent, from: Date, to: Date): Date[] => {
    const s = new Date(ev.start_at);
    if (isNaN(s.getTime())) return [];
    let e = ev.end_at ? new Date(ev.end_at) : null;
    if (!e || isNaN(e.getTime()) || +e < +s) e = s;
    // an end exactly at midnight belongs to the previous day
    if (+e > +s && e.getHours() === 0 && e.getMinutes() === 0 && e.getSeconds() === 0) {
      e = new Date(+e - 1000);
    }
    let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const lo = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const hi = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const out: Date[] = [];
    let guard = 0;
    while (+cur <= +last && guard++ < 400) {
      if (+cur >= +lo && +cur <= +hi) out.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    return out;
  };

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    const rangeStart = days[0];
    const rangeEnd = days[days.length - 1];
    for (const ev of expanded) {
      if (!ev.start_at) continue;
      for (const d of daysCovered(ev, rangeStart, rangeEnd)) {
        const k = dayKey(d);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(ev);
      }
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const da = new Date(a.start_at).getTime();
        const db = new Date(b.start_at).getTime();
        return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      });
    }
    return m;
  }, [expanded, days]);

  const selectedEvents = useMemo(() => {
    const s = new Date(selectedDay);
    s.setHours(0, 0, 0, 0);
    const e = new Date(selectedDay);
    e.setHours(23, 59, 59, 999);
    const lookBack = new Date(s);
    lookBack.setDate(lookBack.getDate() - 366);
    return expandEvents(visibleEvents || [], lookBack, e)
      .filter((ev) => ev.start_at && daysCovered(ev, s, e).length > 0)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [visibleEvents, selectedDay]);



  const { data: memoryDays } = useQuery({
    queryKey: ["memories-days", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("memories").select("memory_date");
      if (error) throw error;
      const days: string[] = [];
      for (const row of data ?? []) {
        if (!row.memory_date) continue;
        const parts = String(row.memory_date).split("-");
        if (parts.length < 3) continue;
        const [y, m, d] = parts.map(Number);
        if (isNaN(y) || isNaN(m) || isNaN(d)) continue;
        days.push(`${y}-${m - 1}-${d}`);
      }
      return days;
    },
    enabled: !!user,
  });
  // Offline query persistence uses JSON, so this value must remain an array.
  // Array.isArray also safely ignores the old cached Set that became `{}`.
  const hasMemory = (d: Date) => Array.isArray(memoryDays) && memoryDays.includes(dayKey(d));


  const shift = (dir: -1 | 1) => {
    const x = new Date(cursor);
    x.setMonth(x.getMonth() + dir);
    setCursor(x);
  };

  const headerLabel = fmtMonth(cursor);

  const onDayClick = (d: Date) => {
    const clicked = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setCursor(clicked);
    setSelectedDay(clicked);
  };

  const openAdd = (d?: Date) => {
    setPickedDate(d ?? selectedDay);
    setOpen(true);
  };

  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dx = touchStart.x - touchEnd.x;
    const dy = touchStart.y - touchEnd.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < minSwipeDistance || absX < absY) return;
    if (dx > 0) {
      shift(1);
    } else {
      shift(-1);
    }
  };

  const findOriginal = (ev: CalendarEvent) => {
    const realId = String(ev.id).split(":")[0];
    return (visibleEvents ?? []).find((x) => x.id === realId) ?? null;
  };

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const renderProfileDots = (ev: CalendarEvent) => {
    const ids = ev.profile_ids?.length ? ev.profile_ids : [ev.profile_id];
    return (
      <span className="inline-flex -space-x-0.5 ml-1 align-middle">
        {ids.filter(Boolean).slice(0, 4).map((id) => {
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
    <div
      className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-full bg-secondary p-1">
          <button
            onClick={() => openAdd()}
            className="px-3 py-1 text-xs rounded-full bg-background shadow-sm inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add event
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        <div className="inline-flex items-center rounded-lg bg-card border border-border px-3 py-1 shadow-sm">
          <h1 className="font-display text-base sm:text-xl min-w-0 truncate">{headerLabel}</h1>
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
        <div>
          {calendarWeeks.map(({ weekDays, segments, laneCount }, weekIndex) => (
            <div
              key={dayKey(weekDays[0])}
              className="grid grid-cols-7 border-b border-border last:border-b-0 min-h-28 sm:min-h-[5.5rem]"
              style={{ gridTemplateRows: `2.25rem repeat(${Math.max(laneCount, 1)}, minmax(2rem, auto)) 0.375rem` }}
            >
              {weekDays.map((d, dayIndex) => {
                const isToday = sameDay(d, new Date());
                const otherMonth = d.getMonth() !== cursor.getMonth();
                return (
                  <button
                    key={dayKey(d)}
                    onClick={() => onDayClick(d)}
                    aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                    className={cn(
                      "group relative z-0 flex items-start justify-between border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-secondary/50 sm:p-2",
                      otherMonth && "bg-muted/30 text-muted-foreground/60",
                      sameDay(d, selectedDay) && "ring-2 ring-inset ring-primary/60 bg-secondary/40",
                    )}
                    style={{ gridColumn: dayIndex + 1, gridRow: "1 / -1" }}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-xs font-medium shadow-sm sm:text-sm",
                        isToday && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {hasMemory(d) && (
                      <span
                        title="Has memories"
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                      >
                        <ImageIcon className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}

              {segments.map((segment) => {
                const ids = segment.event.profile_ids?.length
                  ? segment.event.profile_ids
                  : [segment.event.profile_id];
                const primary = findProfile(ids[0]);
                return (
                  <button
                    key={`${segment.event.id}-${weekIndex}`}
                    type="button"
                    onClick={() => setDetailEvent(segment.event)}
                    className={cn(
                      "relative z-10 mx-0 min-w-0 self-stretch overflow-hidden px-1.5 py-1 text-left text-[10px] font-medium leading-tight shadow-sm transition-[filter] hover:brightness-95 sm:text-[11px]",
                      !segment.continuesBefore && "ml-1 rounded-l-md border-l-2",
                      !segment.continuesAfter && "mr-1 rounded-r-md",
                    )}
                    style={{
                      gridColumn: `${segment.startColumn} / ${segment.endColumn + 1}`,
                      gridRow: segment.lane + 2,
                      background: primary
                        ? `color-mix(in oklab, ${primary.color} 24%, var(--card))`
                        : undefined,
                      borderLeftColor: primary?.color,
                    }}
                    title={`${segment.event.title} · ${fmtTime(segment.event.start_at)}`}
                  >
                    <span className="line-clamp-2 sm:block sm:truncate">
                      {segment.event.contact_id && <Cake className="mr-0.5 -mt-0.5 inline h-2.5 w-2.5" />}
                      {segment.event.title}
                      <span className="hidden sm:inline">{renderProfileDots(segment.event)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="bamboo-card p-4 sm:p-6 mt-4">
        <div className="flex items-center mb-3 gap-2">
          <div className="inline-flex items-center rounded-lg bg-card border border-border px-3 py-1.5 shadow-sm">
            <h2 className="font-display text-base sm:text-lg">
              {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h2>
          </div>
        </div>
        <ul className="space-y-3">
          {selectedEvents.map((ev) => {
            const ids = ev.profile_ids?.length ? ev.profile_ids : [ev.profile_id];
            const colors = ids.map((id) => findProfile(id)?.color).filter(Boolean) as string[];
            const primary = findProfile(ids[0]);
            return (
              <li key={ev.id}>
                <button
                  onClick={() => setDetailEvent(ev)}
                  className="w-full text-left group flex items-start gap-3 rounded-2xl p-4 bg-card/80 border border-border shadow-sm hover:shadow-md hover:bg-card hover:-translate-y-0.5 transition-all"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: primary?.color,
                  }}
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
                    {ev.location && <div className="text-xs text-muted-foreground mt-1">{ev.location}</div>}
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
                </button>
              </li>
            );
          })}
          {selectedEvents.length === 0 && (
            <li className="text-sm text-muted-foreground py-8 text-center">Nothing scheduled.</li>
          )}
        </ul>
      </div>

      <EventDialog open={open} onOpenChange={setOpen} initialDate={pickedDate ?? undefined} />

      <Dialog open={!!detailEvent} onOpenChange={(o) => !o && setDetailEvent(null)}>
        <DialogContent>
          {detailEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailEvent.contact_id && <Cake className="h-4 w-4 text-primary" />}
                  {detailEvent.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {new Date(detailEvent.start_at).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · "}
                  {fmtTime(detailEvent.start_at)}
                  {detailEvent.end_at && ` – ${fmtTime(detailEvent.end_at)}`}
                </div>
                {detailEvent.location && <div>📍 {detailEvent.location}</div>}
                {detailEvent.notes && <div className="whitespace-pre-wrap">{detailEvent.notes}</div>}
                <div className="flex flex-wrap gap-1 pt-1">
                  {(detailEvent.profile_ids?.length ? detailEvent.profile_ids : [detailEvent.profile_id])
                    .map((id) => findProfile(id))
                    .filter(Boolean)
                    .map((p) => (
                      <span
                        key={p!.id}
                        className="text-[11px] rounded-full px-2 py-0.5 text-white"
                        style={{ background: p!.color }}
                      >
                        {p!.name}
                      </span>
                    ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDetailEvent(null)}>Close</Button>
                <Button
                  onClick={() => {
                    const original = findOriginal(detailEvent);
                    setDetailEvent(null);
                    if (original) setEditEvent(original);
                  }}
                  disabled={!findOriginal(detailEvent)}
                  className="gap-1"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {editEvent && (
        <EventDialog
          key={editEvent.id}
          event={editEvent}
          open={!!editEvent}
          onOpenChange={(o) => !o && setEditEvent(null)}
        />
      )}
    </div>
  );
}
