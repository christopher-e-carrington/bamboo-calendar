import { useEffect, useMemo, useRef, useState } from "react";
import { useSwipe } from "@/hooks/use-swipe";
import { useHousehold, type CalendarEvent, type TaskItem } from "@/lib/household-store";
import { expandEvents } from "@/lib/event-recurrence";
import { EventDialog } from "./event-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sun,
  Moon,
  MapPin,
  Pencil,
  Trash2,
  CheckSquare,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

const SNAP_MIN = 15;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 23;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function hourLabel(h: number) {
  const hh = ((h + 11) % 12) + 1;
  return `${hh} ${h < 12 ? "am" : "pm"}`;
}
function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

interface Block {
  ev: CalendarEvent;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

/** Greedy lane assignment so overlapping blocks sit side by side. */
function layout(items: { ev: CalendarEvent; startMin: number; endMin: number }[]): Block[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((m, b) => Math.max(m, b.lane + 1), 0);
    cluster.forEach((b) => (b.lanes = lanes));
    out.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    const taken = new Set(cluster.filter((b) => b.endMin > it.startMin).map((b) => b.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return out;
}

export function SchedulePage() {
  const {
    visibleEvents,
    visibleTasks,
    profiles,
    activeProfile,
    familyProfile,
    loading,
    deleteEvent,
  } = useHousehold();

  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [fullDay, setFullDay] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [armedTask, setArmedTask] = useState<TaskItem | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const startHour = fullDay ? 0 : DEFAULT_START_HOUR;
  const endHour = fullDay ? 24 : DEFAULT_END_HOUR;
  const totalMin = (endHour - startHour) * 60;
  const pxPerHour = 68;
  const height = (totalMin / 60) * pxPerHour;

  const findProfile = (id: string) => profiles.find((p) => p.id === id);

  const dayEvents = useMemo(() => {
    const s = startOfDay(day);
    const e = new Date(day);
    e.setHours(23, 59, 59, 999);
    return expandEvents(visibleEvents ?? [], s, e)
      .filter((ev) => ev.start_at && !isNaN(new Date(ev.start_at).getTime()))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [visibleEvents, day]);

  const blocks = useMemo(() => {
    const base = startOfDay(day).getTime();
    const items = dayEvents.map((ev) => {
      const s = new Date(ev.start_at);
      const rawEnd = ev.end_at ? new Date(ev.end_at) : null;
      const e = rawEnd && !isNaN(rawEnd.getTime()) && rawEnd > s ? rawEnd : new Date(s.getTime() + 60 * 60_000);
      const startMin = Math.max(0, Math.round((s.getTime() - base) / 60_000));
      const endMin = Math.min(24 * 60, Math.round((e.getTime() - base) / 60_000));
      return { ev, startMin, endMin: Math.max(endMin, startMin + 20) };
    });
    return layout(items);
  }, [dayEvents, day]);

  const stats = useMemo(() => {
    // merged busy minutes within the visible window
    const ranges = blocks
      .map((b) => [Math.max(b.startMin, startHour * 60), Math.min(b.endMin, endHour * 60)] as const)
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    let busy = 0;
    let cursor = -1;
    let end = -1;
    for (const [s, e] of ranges) {
      if (s > end) {
        if (end > cursor) busy += end - cursor;
        cursor = s;
        end = e;
      } else end = Math.max(end, e);
    }
    if (end > cursor) busy += end - cursor;
    const open = Math.max(0, totalMin - busy);
    // longest free gap
    let gap = 0;
    let prev = startHour * 60;
    for (const [s, e] of ranges) {
      gap = Math.max(gap, s - prev);
      prev = Math.max(prev, e);
    }
    gap = Math.max(gap, endHour * 60 - prev);
    return { busy, open, gap };
  }, [blocks, startHour, endHour, totalMin]);

  const unplanned = useMemo(() => {
    const list = (visibleTasks ?? []).filter((t) => !t.done);
    return list.slice(0, 12);
  }, [visibleTasks]);

  const minutesFromY = (clientY: number) => {
    const el = gridRef.current;
    if (!el) return startHour * 60;
    const rect = el.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const raw = startHour * 60 + ratio * totalMin;
    const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
    return Math.min(endHour * 60, Math.max(startHour * 60, snapped));
  };

  const openDraft = (fromMin: number, toMin: number) => {
    const a = Math.min(fromMin, toMin);
    const b = Math.max(fromMin, toMin);
    const s = new Date(startOfDay(day).getTime() + a * 60_000);
    const e = new Date(startOfDay(day).getTime() + (b - a < SNAP_MIN ? a + 60 : b) * 60_000);
    setDraft({ start: s, end: e });
    setComposeOpen(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const m = minutesFromY(e.clientY);
    setDrag({ from: m, to: m });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ from: drag.from, to: minutesFromY(e.clientY) });
  };
  const onPointerUp = () => {
    if (!drag) return;
    openDraft(drag.from, drag.to);
    setDrag(null);
  };

  const swipe = useSwipe({
    onSwipeLeft: () => setDay(addDays(day, 1)),
    onSwipeRight: () => setDay(addDays(day, -1)),
    ignoreSelector: "[data-timeline]",
  });

  const top = (min: number) => ((min - startHour * 60) / totalMin) * height;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = sameDay(day, now) && nowMin >= startHour * 60 && nowMin <= endHour * 60;

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-6xl mx-auto w-full touch-pan-y" {...swipe}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => openDraft(9 * 60, 10 * 60)}
          className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground shadow-sm inline-flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Block time
        </button>
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDay(startOfDay(new Date()))}>Today</Button>
        <div className="inline-flex items-center rounded-lg bg-card border border-border px-3 py-1 shadow-sm min-w-0">
          <h1 className="font-display text-base sm:text-xl truncate">
            {day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-1"
          onClick={() => setFullDay((v) => !v)}
        >
          {fullDay ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {fullDay ? "Daytime" : "Full day"}
        </Button>
      </div>

      {/* Rhythm summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        {[
          { label: "Planned", value: fmtDuration(stats.busy) },
          { label: "Open", value: fmtDuration(stats.open) },
          { label: "Longest calm", value: fmtDuration(stats.gap) },
        ].map((s) => (
          <div key={s.label} className="bamboo-card px-3 py-2 sm:px-4 sm:py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="font-display text-base sm:text-lg">{s.value}</div>
          </div>
        ))}
      </div>

      {/* To-do rail */}
      {unplanned.length > 0 && (
        <div className="bamboo-card p-3 sm:p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Drop a to-do into the day</span>
            {armedTask && (
              <span className="ml-auto text-[11px] text-muted-foreground inline-flex items-center gap-1">
                Pick a time slot
                <button onClick={() => setArmedTask(null)} aria-label="Cancel">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {unplanned.map((t) => {
              const p = findProfile(t.profile_id);
              const armed = armedTask?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setArmedTask(armed ? null : t)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors inline-flex items-center gap-1.5",
                    armed ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/60",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p?.color }} />
                  <span className="max-w-[10rem] truncate">{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bamboo-card overflow-hidden">
        <div className="flex">
          {/* hour gutter */}
          <div className="w-14 sm:w-16 shrink-0 border-r border-border bg-secondary/30 relative" style={{ height }}>
            {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] sm:text-[11px] text-muted-foreground"
                style={{ top: top(h * 60) }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>

          {/* grid */}
          <div
            ref={gridRef}
            data-timeline
            className="relative flex-1 touch-none select-none"
            style={{ height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
          >
            {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map((h) => (
              <div key={h}>
                <div className="absolute left-0 right-0 border-t border-border/70" style={{ top: top(h * 60) }} />
                <div className="absolute left-0 right-0 border-t border-dashed border-border/35" style={{ top: top(h * 60 + 30) }} />
              </div>
            ))}

            {/* drag preview */}
            {drag && (
              <div
                className="absolute left-1 right-1 rounded-xl bg-primary/15 border border-primary/40 pointer-events-none"
                style={{
                  top: top(Math.min(drag.from, drag.to)),
                  height: Math.max(8, Math.abs(top(drag.to) - top(drag.from))),
                }}
              />
            )}

            {/* now line */}
            {showNow && (
              <div className="absolute left-0 right-0 pointer-events-none z-20" style={{ top: top(nowMin) }}>
                <div className="h-px bg-primary/70" />
                <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" />
              </div>
            )}

            {/* event blocks */}
            {blocks.map((b) => {
              const ids = b.ev.profile_ids?.length ? b.ev.profile_ids : [b.ev.profile_id];
              const primary = findProfile(ids.filter(Boolean)[0]);
              const color = primary?.color ?? "var(--primary)";
              const widthPct = 100 / b.lanes;
              const s = new Date(b.ev.start_at);
              const dur = b.endMin - b.startMin;
              return (
                <button
                  key={b.ev.id}
                  data-block
                  onClick={() => setDetail(b.ev)}
                  className="absolute rounded-xl border border-border/60 shadow-sm px-2 py-1 text-left overflow-hidden hover:shadow-md transition-shadow z-10"
                  style={{
                    top: top(b.startMin) + 2,
                    height: Math.max(22, top(b.endMin) - top(b.startMin) - 4),
                    left: `calc(${b.lane * widthPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                    background: `color-mix(in oklab, ${color} 20%, var(--card))`,
                    borderLeft: `3px solid ${color}`,
                  }}
                  title={`${b.ev.title} · ${fmtTime(s)}`}
                >
                  <div className="text-[11px] sm:text-xs font-medium line-clamp-2 leading-tight">{b.ev.title}</div>
                  {dur >= 45 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {fmtTime(s)} · {fmtDuration(dur)}
                    </div>
                  )}
                </button>
              );
            })}

            {blocks.length === 0 && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center text-muted-foreground text-sm px-6">
                  <Sparkles className="h-4 w-4 mx-auto mb-1 text-primary/70" />
                  A clear day. Drag anywhere to block time.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-3">
        Tap or drag on the timeline to carve out a block. Tap a block to view or edit it.
      </p>

      {/* Compose */}
      <EventDialog
        key={`${draft?.start.getTime() ?? 0}-${armedTask?.id ?? ""}`}
        open={composeOpen}
        onOpenChange={(o) => {
          setComposeOpen(o);
          if (!o) {
            setDraft(null);
            setArmedTask(null);
          }
        }}
        initialStart={draft?.start}
        initialEnd={draft?.end}
        initialTitle={armedTask?.title}
        initialProfileIds={
          armedTask
            ? [armedTask.profile_id]
            : [activeProfile?.id ?? familyProfile?.id ?? profiles[0]?.id].filter(Boolean) as string[]
        }
      />

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {fmtTime(new Date(detail.start_at))}
                  {detail.end_at && ` – ${fmtTime(new Date(detail.end_at))}`}
                </div>
                {detail.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {detail.location}
                  </div>
                )}
                {detail.notes && <div className="whitespace-pre-wrap">{detail.notes}</div>}
                <div className="flex flex-wrap gap-1 pt-1">
                  {(detail.profile_ids?.length ? detail.profile_ids : [detail.profile_id])
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
              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  className="gap-1 text-destructive"
                  onClick={async () => {
                    const realId = String(detail.id).split(":")[0];
                    setDetail(null);
                    try {
                      await deleteEvent(realId);
                      toast.success("Block removed");
                    } catch {
                      toast.error("Could not remove block");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
                <Button
                  className="gap-1"
                  onClick={() => {
                    const realId = String(detail.id).split(":")[0];
                    const original = (visibleEvents ?? []).find((x) => x.id === realId) ?? null;
                    setDetail(null);
                    if (original) setEditEvent(original);
                  }}
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
