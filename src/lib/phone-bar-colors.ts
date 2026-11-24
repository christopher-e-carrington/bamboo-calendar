export function phoneBarColorScheme(color: string): "light" | "dark" {
  const hex = color.replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  if (!/^[\da-f]{6}$/i.test(full)) return "light";
  const rgb = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
  const [red = 1, green = 1, blue = 1] = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 0.179 ? "dark" : "light";
}