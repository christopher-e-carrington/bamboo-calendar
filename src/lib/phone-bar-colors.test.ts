import { describe, expect, it } from "vitest";
import { phoneBarColorScheme } from "./phone-bar-colors";

describe("phone bar contrast selection", () => {
  it("uses light chrome for Sara silver", () => {
    expect(phoneBarColorScheme("#f2f4f7")).toBe("light");
  });
  it("uses dark chrome for dark views", () => {
    for (const color of ["#3a2818", "#1a2629", "#0f1b3d", "#121212"]) {
      expect(phoneBarColorScheme(color)).toBe("dark");
    }
  });
  it("handles custom short hex colors", () => {
    expect(phoneBarColorScheme("#fff")).toBe("light");
    expect(phoneBarColorScheme("#111")).toBe("dark");
  });
});