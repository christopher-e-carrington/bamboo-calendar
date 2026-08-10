import type { CalendarEvent } from "./household-store";

export type EventRecurrence = CalendarEvent["recurrence"];

export const RECURRENCE_OPTIONS: { value: EventRecurrence; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Weekly (same day of week)" },
  { value: "biweekly", label: "Every other week (same day of week)" },
  { value: "monthly_date", label: "Monthly (same date)" },
  { value: "monthly_dow", label: "Monthly (same weekday)" },
  { value: "quarterly_date", label: "Quarterly (same date)" },
  { value: "quarterly_dow", label: "Quarterly (same weekday)" },
  { value: "yearly", label: "Yearly (same date)" },
];

function addDaysD(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonthsD(d: Date, n: number) {
  const x = new Date(d);
  const targetMonth = x.getMonth() + n;
  x.setMonth(targetMonth);
  return x;
}

/** Given a base date, return the Nth-weekday-of-month for the given year/month (0-indexed month). */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
  // nth: 1..5, or -1 for "last"
  if (nth === -1) {
    // last occurrence
    const last = new Date(year, month + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - diff);
  }
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const result = new Date(year, month, day);
  if (result.getMonth() !== month) return null;
  return result;
}

/** Which occurrence of its weekday is `date` within its month? Returns 1..5, and true if it's the last one. */
function occurrenceInMonth(date: Date): { nth: number; isLast: boolean } {
  const nth = Math.ceil(date.getDate() / 7);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const isLast = date.getDate() + 7 > lastDay;
  return { nth, isLast };
}

/**
 * Expand a single event into all occurrences intersecting [rangeStart, rangeEnd].
 */
export function expandEvent(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  if (!ev.start_at) return [];
  const base = new Date(ev.start_at);
  if (isNaN(base.getTime())) return [];

  const baseEnd = ev.end_at ? new Date(ev.end_at) : null;
  const durationMs = (baseEnd && !isNaN(baseEnd.getTime())) ? +baseEnd - +base : 0;

  const make = (occStart: Date, suffix: string): CalendarEvent => ({
    ...ev,
    id: `${ev.id}:${suffix}`,
    start_at: occStart.toISOString(),
    end_at: baseEnd && !isNaN(baseEnd.getTime()) ? new Date(+occStart + durationMs).toISOString() : null,
  });

  const out: CalendarEvent[] = [];
  const rec = ev.recurrence;

  if (rec === "none" || !rec) {
    if (base >= rangeStart && base <= rangeEnd) out.push(ev);
    return out;
  }

  if (rec === "weekly" || rec === "biweekly") {
    const stepDays = rec === "weekly" ? 7 : 14;
    // Find first occurrence >= rangeStart aligned to base
    const msDiff = +rangeStart - +base;
    let k = 0;
    if (msDiff > 0) {
      const stepMs = stepDays * 86400000;
      k = Math.max(0, Math.floor(msDiff / stepMs));
    }
    let occ = addDaysD(base, k * stepDays);
    // Handle sub-day rounding
    while (occ < rangeStart) occ = addDaysD(occ, stepDays);
    while (occ <= rangeEnd) {
      out.push(make(occ, `${occ.getFullYear()}-${occ.getMonth()}-${occ.getDate()}`));
      occ = addDaysD(occ, stepDays);
    }
    return out;
  }

  if (rec === "yearly") {
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
      const occ = new Date(base);
      occ.setFullYear(y);
      if (occ >= rangeStart && occ <= rangeEnd) out.push(make(occ, String(y)));
    }
    return out;
  }

  if (rec === "monthly_date" || rec === "quarterly_date") {
    const step = rec === "monthly_date" ? 1 : 3;
    // Start from a month before rangeStart to be safe
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    cursor = addMonthsD(cursor, -step);
    // Align to base month cadence
    while (cursor <= rangeEnd) {
      const monthsFromBase = (cursor.getFullYear() - base.getFullYear()) * 12 + (cursor.getMonth() - base.getMonth());
      if (monthsFromBase >= 0 && monthsFromBase % step === 0) {
        const occ = new Date(cursor.getFullYear(), cursor.getMonth(), base.getDate(), base.getHours(), base.getMinutes(), base.getSeconds());
        if (occ.getMonth() === cursor.getMonth() && occ >= rangeStart && occ <= rangeEnd) {
          out.push(make(occ, `${occ.getFullYear()}-${occ.getMonth()}`));
        }
      }
      cursor = addMonthsD(cursor, 1);
    }
    return out;
  }

  if (rec === "monthly_dow" || rec === "quarterly_dow") {
    const step = rec === "monthly_dow" ? 1 : 3;
    const weekday = base.getDay();
    const { nth, isLast } = occurrenceInMonth(base);
    const nthToUse = isLast && nth >= 4 ? -1 : nth;
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    cursor = addMonthsD(cursor, -step);
    while (cursor <= rangeEnd) {
      const monthsFromBase = (cursor.getFullYear() - base.getFullYear()) * 12 + (cursor.getMonth() - base.getMonth());
      if (monthsFromBase >= 0 && monthsFromBase % step === 0) {
        const day = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), weekday, nthToUse);
        if (day) {
          const occ = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes(), base.getSeconds());
          if (occ >= rangeStart && occ <= rangeEnd) {
            out.push(make(occ, `${occ.getFullYear()}-${occ.getMonth()}-dow`));
          }
        }
      }
      cursor = addMonthsD(cursor, 1);
    }
    return out;
  }

  // Fallback
  if (base >= rangeStart && base <= rangeEnd) out.push(ev);
  return out;
}

export function expandEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    try {
      out.push(...expandEvent(ev, rangeStart, rangeEnd));
    } catch (e) {
      console.warn("Failed to expand event", ev.id, e);
    }
  }
  return out;
}
