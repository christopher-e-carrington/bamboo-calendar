import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = [
  { id: "parchment", name: "Parchment", description: "Warm cream, bamboo greens. The original.", swatches: ["#f6f1e4", "#7a9a72", "#c2a878", "#4a5a3c"] },
  { id: "fauna", name: "Fauna", description: "Deep walnut, copper, amber and forest moss.", swatches: ["#2a1f17", "#5a7045", "#c98c4a", "#e8c884"] },
  { id: "flora", name: "Flora", description: "Sage, mossy greens, terracotta and seafoam.", swatches: ["#cfd8c2", "#5e7a4f", "#b86e52", "#4a9080"] },
  { id: "sky", name: "Sky", description: "Soft blues, warm sand and seafoam.", swatches: ["#eaf2fa", "#6fa4d6", "#f2a882", "#4a9e8e"] },
  { id: "light", name: "Light", description: "Material light. Clean and neutral.", swatches: ["#ffffff", "#f5f5f5", "#1976d2", "#212121"] },
  { id: "dark", name: "Dark", description: "Material dark. Easy on the eyes.", swatches: ["#121212", "#1e1e1e", "#90caf9", "#e0e0e0"] },
] as const;

export type BuiltInThemeId = (typeof THEMES)[number]["id"];
export type ThemeId = string;

export type CustomThemeColors = {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  accent: string;
  border: string;
};

export type CustomTheme = {
  id: string; // "custom-<slug>"
  name: string;
  colors: CustomThemeColors;
};

const STORAGE_KEY = "bamboo.theme";
const CUSTOM_KEY = "bamboo.custom-themes";
const DEFAULT_THEME: ThemeId = "parchment";

const CUSTOM_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--cream",
  "--sage",
  "--sage-deep",
  "--bamboo",
  "--bamboo-light",
  "--wood",
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastFg(hex: string) {
  return luminance(hex) > 0.5 ? "#1a1a1a" : "#ffffff";
}

function mix(a: string, b: string, t: number) {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(m(ar.r, br.r))}${toHex(m(ar.g, br.g))}${toHex(m(ar.b, br.b))}`;
}

function clearCustomVars(root: HTMLElement) {
  CUSTOM_VARS.forEach((v) => root.style.removeProperty(v));
}

function applyCustomColors(root: HTMLElement, c: CustomThemeColors) {
  const isDark = luminance(c.background) < 0.4;
  const fgOnBg = c.foreground;
  const fgOnPrimary = contrastFg(c.primary);
  const fgOnAccent = contrastFg(c.accent);
  const muted = mix(c.background, isDark ? "#ffffff" : "#000000", 0.06);
  const mutedFg = mix(fgOnBg, c.background, 0.45);
  const secondary = mix(c.background, isDark ? "#ffffff" : "#000000", 0.1);
  const sidebar = mix(c.background, isDark ? "#ffffff" : "#000000", 0.03);

  const map: Record<string, string> = {
    "--background": c.background,
    "--foreground": fgOnBg,
    "--card": c.card,
    "--card-foreground": contrastFg(c.card),
    "--popover": c.card,
    "--popover-foreground": contrastFg(c.card),
    "--primary": c.primary,
    "--primary-foreground": fgOnPrimary,
    "--secondary": secondary,
    "--secondary-foreground": fgOnBg,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--accent": c.accent,
    "--accent-foreground": fgOnAccent,
    "--border": c.border,
    "--input": c.border,
    "--ring": c.primary,
    "--sidebar": sidebar,
    "--sidebar-foreground": fgOnBg,
    "--sidebar-primary": c.primary,
    "--sidebar-primary-foreground": fgOnPrimary,
    "--sidebar-accent": c.accent,
    "--sidebar-accent-foreground": fgOnAccent,
    "--sidebar-border": c.border,
    "--sidebar-ring": c.primary,
    "--cream": c.card,
    "--sage": c.primary,
    "--sage-deep": mix(c.primary, "#000000", 0.25),
    "--bamboo": c.accent,
    "--bamboo-light": mix(c.accent, c.background, 0.6),
    "--wood": c.accent,
  };

  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
  root.classList.toggle("dark", isDark);
}

function loadCustomThemes(): CustomTheme[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  customThemes: CustomTheme[];
  saveCustomTheme: (name: string, colors: CustomThemeColors) => CustomTheme;
  deleteCustomTheme: (id: string) => void;
}>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  customThemes: [],
  saveCustomTheme: () => ({ id: "", name: "", colors: {} as CustomThemeColors }),
  deleteCustomTheme: () => {},
});

function applyTheme(theme: ThemeId, customs: CustomTheme[]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
  clearCustomVars(root);

  const custom = customs.find((c) => c.id === theme);
  if (custom) {
    root.classList.add("theme-custom");
    applyCustomColors(root, custom.colors);
    return;
  }

  const builtIn = (THEMES.find((t) => t.id === theme)?.id ?? DEFAULT_THEME) as BuiltInThemeId;
  root.classList.add(`theme-${builtIn}`);
  root.classList.toggle("dark", builtIn === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  useEffect(() => {
    const customs = loadCustomThemes();
    setCustomThemes(customs);
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "";
    const valid =
      THEMES.some((t) => t.id === stored) || customs.some((c) => c.id === stored);
    const initial = valid ? stored : DEFAULT_THEME;
    setThemeState(initial);
    applyTheme(initial, customs);
  }, []);

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      applyTheme(t, customThemes);
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        // ignore
      }
    },
    [customThemes],
  );

  const persistCustoms = (list: CustomTheme[]) => {
    setCustomThemes(list);
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const saveCustomTheme = useCallback(
    (name: string, colors: CustomThemeColors) => {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
      const id = `custom-${slug}-${Date.now().toString(36)}`;
      const next: CustomTheme = { id, name: name.trim() || "Custom theme", colors };
      const list = [...customThemes, next];
      persistCustoms(list);
      // Apply immediately
      setThemeState(id);
      applyTheme(id, list);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // ignore
      }
      return next;
    },
    [customThemes],
  );

  const deleteCustomTheme = useCallback(
    (id: string) => {
      const list = customThemes.filter((c) => c.id !== id);
      persistCustoms(list);
      if (theme === id) {
        setThemeState(DEFAULT_THEME);
        applyTheme(DEFAULT_THEME, list);
        try {
          localStorage.setItem(STORAGE_KEY, DEFAULT_THEME);
        } catch {
          // ignore
        }
      }
    },
    [customThemes, theme],
  );

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, customThemes, saveCustomTheme, deleteCustomTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
