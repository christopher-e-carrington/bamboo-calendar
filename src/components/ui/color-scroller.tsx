import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Textra-style horizontally scrolling color picker.
// Renders a grid of hue columns × shade rows so users can browse many
// colors and shades quickly by scrolling sideways.

const HUES = [
  { name: "Red", h: 0 },
  { name: "Deep Orange", h: 14 },
  { name: "Orange", h: 28 },
  { name: "Amber", h: 40 },
  { name: "Yellow", h: 52 },
  { name: "Lime", h: 78 },
  { name: "Green", h: 130 },
  { name: "Teal", h: 168 },
  { name: "Cyan", h: 190 },
  { name: "Sky", h: 205 },
  { name: "Blue", h: 220 },
  { name: "Indigo", h: 240 },
  { name: "Violet", h: 262 },
  { name: "Purple", h: 280 },
  { name: "Magenta", h: 300 },
  { name: "Pink", h: 330 },
  { name: "Rose", h: 348 },
];

// Lightness rows, top = light, bottom = dark
const SHADES = [95, 88, 78, 68, 58, 48, 38, 28, 18];
const SAT = 68;

// Neutrals column (grayscale)
const NEUTRALS = ["#ffffff", "#f5f5f5", "#e5e5e5", "#cccccc", "#a3a3a3", "#737373", "#525252", "#262626", "#000000"];

const hslHex = (h: number, s: number, l: number) => {
  const a = (s * Math.min(l, 100 - l)) / 100 / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export function ColorScroller({
  value,
  onChange,
  className,
  showCustom = true,
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  showCustom?: boolean;
}) {
  const columns = useMemo(() => {
    const cols: { key: string; label: string; swatches: string[] }[] = [
      { key: "neutral", label: "Neutral", swatches: NEUTRALS },
    ];
    for (const hue of HUES) {
      cols.push({
        key: hue.name,
        label: hue.name,
        swatches: SHADES.map((l) => hslHex(hue.h, SAT, l)),
      });
    }
    return cols;
  }, []);

  const normalized = (value ?? "").toLowerCase();

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="overflow-x-auto rounded-md border border-input bg-background p-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-1.5">
          {columns.map((col) => (
            <div key={col.key} className="flex flex-col gap-1.5 shrink-0">
              {col.swatches.map((hex) => {
                const selected = hex.toLowerCase() === normalized;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onChange(hex)}
                    className={cn(
                      "relative h-7 w-7 rounded-md border transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-foreground scale-110 ring-2 ring-ring" : "border-black/10",
                    )}
                    style={{ backgroundColor: hex }}
                    aria-label={`${col.label} ${hex}`}
                  >
                    {selected && (
                      <Check
                        className="absolute inset-0 m-auto h-4 w-4 drop-shadow"
                        style={{ color: isLight(hex) ? "#000" : "#fff" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 px-0.5">
        {showCustom && (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#888888"}
              onChange={(e) => onChange(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent p-0"
              aria-label="Custom color"
            />
            Custom
          </label>
        )}
        <span className="ml-auto text-[11px] font-mono uppercase text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function isLight(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // perceived luminance
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}
