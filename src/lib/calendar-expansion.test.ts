import { describe, expect, it } from "vitest";
import { expandedCalendarWeekHeight } from "./calendar-expansion";

describe("calendar expansion", () => {
  it("stops at the height needed to display events when that is less than double", () => {
    expect(expandedCalendarWeekHeight(112, 170)).toBe(170);
  });
  it("caps expansion at double the normal height on very busy weeks", () => {
    expect(expandedCalendarWeekHeight(112, 400)).toBe(224);
  });
  it("keeps quiet weeks at their normal height", () => {
    expect(expandedCalendarWeekHeight(112, 68)).toBe(112);
  });
});