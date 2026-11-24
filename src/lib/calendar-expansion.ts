/** Never shrink the default calendar or grow a week beyond twice its height. */
export function expandedCalendarWeekHeight(normalHeight: number, contentHeight: number): number {
  return Math.min(normalHeight * 2, Math.max(normalHeight, contentHeight));
}