export type ReminderRecurrence =
  | "none"
  | "daily"
  | "weekly"
  | "monthly_dow"
  | "monthly_date"
  | "quarterly"
  | "yearly";

export const REMINDER_RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly (same day of week)" },
  { value: "monthly_dow", label: "Monthly (same weekday)" },
  { value: "monthly_date", label: "Monthly (same date)" },
  { value: "quarterly", label: "Quarterly (same date)" },
  { value: "yearly", label: "Yearly (same date)" },
];

export function reminderRecurrenceLabel(rec?: string | null) {
  return REMINDER_RECURRENCE_OPTIONS.find((o) => o.value === rec)?.label ?? "Does not repeat";
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - diff);
  }
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const d = new Date(year, month, day);
  return d.getMonth() === month ? d : null;
}

/**
 * Next occurrence of a reminder strictly after `after`, based on its recurrence.
 * Returns null for non-repeating reminders.
 */
export function nextReminderOccurrence(
  sendAtIso: string,
  recurrence: string | null | undefined,
  after: Date = new Date(),
): Date | null {
  const rec = (recurrence ?? "none") as ReminderRecurrence;
  if (!rec || rec === "none") return null;
  const base = new Date(sendAtIso);
  if (isNaN(base.getTime())) return null;

  const h = base.getHours();
  const m = base.getMinutes();
  const s = base.getSeconds();

  let next = new Date(base);
  let guard = 0;

  if (rec === "daily" || rec === "weekly") {
    const stepDays = rec === "daily" ? 1 : 7;
    while (next <= after && guard++ < 5000) {
      next = new Date(next);
      next.setDate(next.getDate() + stepDays);
    }
    return next;
  }

  if (rec === "monthly_date" || rec === "quarterly" || rec === "yearly") {
    const stepMonths = rec === "monthly_date" ? 1 : rec === "quarterly" ? 3 : 12;
    const day = base.getDate();
    let i = 0;
    while (guard++ < 2000) {
      i += stepMonths;
      const y = base.getFullYear();
      const mo = base.getMonth() + i;
      const lastDay = new Date(y, mo + 1, 0).getDate();
      const cand = new Date(y, mo, Math.min(day, lastDay), h, m, s);
      if (cand > after) return cand;
    }
    return null;
  }

  if (rec === "monthly_dow") {
    const weekday = base.getDay();
    const nth = Math.ceil(base.getDate() / 7);
    const lastDayOfBaseMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const isLast = base.getDate() + 7 > lastDayOfBaseMonth;
    const nthToUse = isLast && nth >= 4 ? -1 : nth;
    let i = 0;
    while (guard++ < 2000) {
      i += 1;
      const d = nthWeekdayOfMonth(base.getFullYear(), base.getMonth() + i, weekday, nthToUse);
      if (!d) continue;
      const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s);
      if (cand > after) return cand;
    }
    return null;
  }

  return null;
}
