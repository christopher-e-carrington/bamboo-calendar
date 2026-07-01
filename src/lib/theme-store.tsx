import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import auraBg from "@/assets/aura.png.asset.json";
import bambooBg from "@/assets/bamboo.jpg.asset.json";
import sketchBg from "@/assets/sketch.png.asset.json";
import leatherBg from "@/assets/leather.png.asset.json";
import articBg from "@/assets/artic.png.asset.json";
import stormBg from "@/assets/storm.png.asset.json";

export const THEMES = [
  { id: "parchment", name: "Parchment", description: "Warm cream, bamboo greens. The original.", swatches: ["#f6f1e4", "#7a9a72", "#c2a878", "#4a5a3c"] },
  { id: "bamboo", name: "Bamboo", description: "Soft cream over a sunlit bamboo grove.", swatches: ["#f6f1e4", "#7a9a72", "#c2a878", "#2a2a22"] },
  { id: "leather", name: "Leather", description: "Burnished cognac, walnut, and deep grove greens.", swatches: ["#3a2818", "#b07040", "#e8b878", "#4a6a3c"] },
  { id: "sketch", name: "Sketch", description: "Graphite pencil on textured paper.", swatches: ["#efece4", "#cfcabd", "#5a5a55", "#1f1f1f"] },
  { id: "fauna", name: "Fauna", description: "Deep walnut, copper, amber and forest moss.", swatches: ["#2a1f17", "#5a7045", "#c98c4a", "#e8c884"] },
  { id: "flora", name: "Flora", description: "Sage, mossy greens, terracotta and seafoam.", swatches: ["#cfd8c2", "#5e7a4f", "#b86e52", "#4a9080"] },
  { id: "sky", name: "Sky", description: "Soft blues, warm sand and seafoam.", swatches: ["#eaf2fa", "#6fa4d6", "#f2a882", "#4a9e8e"] },
  { id: "artic", name: "Artic", description: "Frosted bamboo in an arctic mist.", swatches: ["#e8f4f4", "#4a8a8a", "#a0d0d0", "#1a3a3a"] },
  { id: "storm", name: "Storm", description: "Rain-soaked bamboo under a steel-grey sky.", swatches: ["#1a2629", "#4a6a6a", "#7a9a9a", "#c8d8d8"] },
  { id: "aura", name: "Aura", description: "Northern lights over moonlit bamboo.", swatches: ["#0f1b3d", "#4ade9e", "#a78bfa", "#5eead4"] },
  { id: "light", name: "Light", description: "Material light. Clean and neutral.", swatches: ["#ffffff", "#f5f5f5", "#1976d2", "#212121"] },
  { id: "dark", name: "Dark", description: "Material dark. Easy on the eyes.", swatches: ["#121212", "#1e1e1e", "#90caf9", "#e0e0e0"] },
] as const;

const BUILTIN_BACKGROUNDS: Record<string, string> = {
  aura: auraBg.url,
  bamboo: bambooBg.url,
  sketch: sketchBg.url,
  leather: leatherBg.url,
  artic: articBg.url,
  storm: stormBg.url,
};

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
  id: string;
  name: string;
  colors: CustomThemeColors;
  backgroundImage?: string | null;
  cardOpacity?: number;
  sidebarColor?: string | null;
  sidebarOpacity?: number | null;
};

export type SidebarOverride = {
  color: string;
  opacity: number;
};

const STORAGE_KEY = "bamboo.theme";
const SIDEBAR_KEY = "bamboo.sidebar";
const DEFAULT_THEME: ThemeId = "parchment";

const CUSTOM_VARS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--popover", "--popover-foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--border", "--input", "--ring",
  "--sidebar", "--sidebar-foreground", "--sidebar-primary",
  "--sidebar-primary-foreground", "--sidebar-accent", "--sidebar-accent-foreground",
  "--sidebar-border", "--sidebar-ring",
  "--cream", "--sage", "--sage-deep", "--bamboo", "--bamboo-light", "--wood",
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

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function clearCustomVars(root: HTMLElement) {
  CUSTOM_VARS.forEach((v) => root.style.removeProperty(v));
}

let bgRequestId = 0;

function clearBackgroundImage() {
  if (typeof document === "undefined") return;
  bgRequestId++;
  document.body.style.backgroundImage = "";
  document.body.style.backgroundSize = "";
  document.body.style.backgroundPosition = "";
  document.body.style.backgroundAttachment = "";
  document.body.style.backgroundRepeat = "";
}

function setBodyBg(url: string) {
  if (typeof document === "undefined") return;
  const body = document.body;
  body.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
  body.style.backgroundSize = "cover";
  body.style.backgroundPosition = "center";
  body.style.backgroundAttachment = "fixed";
  body.style.backgroundRepeat = "no-repeat";
  // Force a reflow so the browser commits the new background paint immediately.
  // Some mobile browsers otherwise defer the paint until the next layout shift,
  // which is why the image only appears after switching views and back.
  void body.offsetHeight;
}

function applyBackgroundImage(url: string) {
  if (typeof document === "undefined" || !url) return;
  const requestId = ++bgRequestId;
  // Paint immediately so data: URLs are visible right away.
  setBodyBg(url);
  // Preload, then re-commit once decoded to guarantee the paint sticks even
  // when the previous attempt happened before the image was ready.
  const img = new Image();
  const recommit = () => {
    if (requestId !== bgRequestId) return; // a newer theme switch superseded us
    setBodyBg(url);
  };
  img.onload = recommit;
  img.onerror = recommit;
  try {
    img.src = url;
    if (typeof img.decode === "function") {
      img.decode().then(recommit).catch(recommit);
    }
  } catch {
    // ignore — paint already attempted above
  }
}

function applyCustomColors(
  root: HTMLElement,
  c: CustomThemeColors,
  cardOpacity = 1,
  sidebarOverride?: { color?: string | null; opacity?: number | null } | null,
) {
  const isDark = luminance(c.background) < 0.4;
  const fgOnBg = c.foreground;
  const fgOnPrimary = contrastFg(c.primary);
  const fgOnAccent = contrastFg(c.accent);
  const muted = mix(c.background, isDark ? "#ffffff" : "#000000", 0.06);
  const mutedFg = mix(fgOnBg, c.background, 0.45);
  const secondary = mix(c.background, isDark ? "#ffffff" : "#000000", 0.1);
  const defaultSidebar = mix(c.background, isDark ? "#ffffff" : "#000000", 0.03);

  const cardColor = cardOpacity >= 1 ? c.card : rgba(c.card, cardOpacity);

  // Per-theme sidebar override takes priority; otherwise derive from background.
  let sidebarColor: string;
  if (sidebarOverride?.color) {
    const op = typeof sidebarOverride.opacity === "number" ? sidebarOverride.opacity : 1;
    sidebarColor = op >= 1 ? sidebarOverride.color : rgba(sidebarOverride.color, op);
  } else {
    sidebarColor = cardOpacity >= 1 ? defaultSidebar : rgba(defaultSidebar, Math.max(cardOpacity, 0.4));
  }

  const map: Record<string, string> = {
    "--background": c.background,
    "--foreground": fgOnBg,
    "--card": cardColor,
    "--card-foreground": contrastFg(c.card),
    "--popover": cardColor,
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
    "--sidebar": sidebarColor,
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

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  customThemes: CustomTheme[];
  saveCustomTheme: (input: {
    name: string;
    colors: CustomThemeColors;
    backgroundImage?: string | null;
    cardOpacity?: number;
    sidebarColor?: string | null;
    sidebarOpacity?: number | null;
  }) => Promise<CustomTheme | null>;
  updateCustomTheme: (
    id: string,
    input: {
      name: string;
      colors: CustomThemeColors;
      backgroundImage?: string | null;
      cardOpacity?: number;
      sidebarColor?: string | null;
      sidebarOpacity?: number | null;
    },
  ) => Promise<CustomTheme | null>;
  deleteCustomTheme: (id: string) => Promise<void>;
}>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  customThemes: [],
  saveCustomTheme: async () => null,
  updateCustomTheme: async () => null,
  deleteCustomTheme: async () => {},
});

function applyTheme(theme: ThemeId, customs: CustomTheme[]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
  clearCustomVars(root);
  clearBackgroundImage();

  const custom = customs.find((c) => c.id === theme);
  if (custom) {
    root.classList.add("theme-custom");
    applyCustomColors(root, custom.colors, custom.cardOpacity ?? 1, {
      color: custom.sidebarColor ?? null,
      opacity: custom.sidebarOpacity ?? null,
    });
    if (custom.backgroundImage) applyBackgroundImage(custom.backgroundImage);
  } else {
    const builtIn = (THEMES.find((t) => t.id === theme)?.id ?? DEFAULT_THEME) as BuiltInThemeId;
    root.classList.add(`theme-${builtIn}`);
    root.classList.toggle("dark", builtIn === "dark" || builtIn === "aura" || builtIn === "leather");
    const bg = BUILTIN_BACKGROUNDS[builtIn];
    if (bg) applyBackgroundImage(bg);
  }
}

type DbRow = {
  id: string;
  name: string;
  colors: CustomThemeColors;
  background_image_url: string | null;
  card_opacity: number | string;
  sidebar_color: string | null;
  sidebar_opacity: number | string | null;
};

const ROW_SELECT =
  "id, name, colors, background_image_url, card_opacity, sidebar_color, sidebar_opacity";

function rowToTheme(r: DbRow): CustomTheme {
  const so = r.sidebar_opacity;
  return {
    id: r.id,
    name: r.name,
    colors: r.colors,
    backgroundImage: r.background_image_url,
    cardOpacity: typeof r.card_opacity === "string" ? parseFloat(r.card_opacity) : r.card_opacity,
    sidebarColor: r.sidebar_color,
    sidebarOpacity: so == null ? null : typeof so === "string" ? parseFloat(so) : so,
  };
}

async function resolveHouseholdId(userId: string): Promise<string> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1);
  return (data?.[0]?.household_id as string | undefined) ?? userId;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("custom_themes")
      .select(ROW_SELECT)
      .order("created_at", { ascending: true });
    if (error || !data) {
      setCustomThemes([]);
      return [] as CustomTheme[];
    }
    const themes = (data as unknown as DbRow[]).map(rowToTheme);
    setCustomThemes(themes);
    return themes;
  }, []);

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "";
    const builtInValid = THEMES.some((t) => t.id === stored);
    const initial = builtInValid ? stored : stored || DEFAULT_THEME;
    // Clean up old global sidebar override (replaced by per-theme sidebar)
    try {
      localStorage.removeItem(SIDEBAR_KEY);
    } catch {
      // ignore
    }
    setThemeState(initial);
    applyTheme(initial, []);

    let active = true;
    refresh().then((themes) => {
      if (!active) return;
      const valid = THEMES.some((t) => t.id === initial) || themes.some((c) => c.id === initial);
      const next = valid ? initial : DEFAULT_THEME;
      setThemeState(next);
      applyTheme(next, themes);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        refresh().then((themes) => {
          applyTheme(theme, themes);
        });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const saveCustomTheme = useCallback(
    async (input: {
      name: string;
      colors: CustomThemeColors;
      backgroundImage?: string | null;
      cardOpacity?: number;
      sidebarColor?: string | null;
      sidebarOpacity?: number | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return null;
      const householdId = await resolveHouseholdId(user.id);

      const { data, error } = await supabase
        .from("custom_themes")
        .insert({
          household_id: householdId,
          created_by: user.id,
          name: input.name.trim() || "Custom theme",
          colors: input.colors,
          background_image_url: input.backgroundImage ?? null,
          card_opacity: input.cardOpacity ?? 1,
          sidebar_color: input.sidebarColor ?? null,
          sidebar_opacity: input.sidebarOpacity ?? null,
        })
        .select(ROW_SELECT)
        .single();
      if (error || !data) return null;

      const next = rowToTheme(data as unknown as DbRow);
      const list = [...customThemes, next];
      setCustomThemes(list);
      setThemeState(next.id);
      applyTheme(next.id, list);
      try {
        localStorage.setItem(STORAGE_KEY, next.id);
      } catch {
        // ignore
      }
      return next;
    },
    [customThemes],
  );

  const updateCustomTheme = useCallback(
    async (
      id: string,
      input: {
        name: string;
        colors: CustomThemeColors;
        backgroundImage?: string | null;
        cardOpacity?: number;
        sidebarColor?: string | null;
        sidebarOpacity?: number | null;
      },
    ) => {
      const { data, error } = await supabase
        .from("custom_themes")
        .update({
          name: input.name.trim() || "Custom theme",
          colors: input.colors,
          background_image_url: input.backgroundImage ?? null,
          card_opacity: input.cardOpacity ?? 1,
          sidebar_color: input.sidebarColor ?? null,
          sidebar_opacity: input.sidebarOpacity ?? null,
        })
        .eq("id", id)
        .select(ROW_SELECT)
        .single();
      if (error || !data) return null;

      const updated = rowToTheme(data as unknown as DbRow);
      const list = customThemes.map((c) => (c.id === id ? updated : c));
      setCustomThemes(list);
      if (theme === id) applyTheme(id, list);
      return updated;
    },
    [customThemes, theme],
  );

  const deleteCustomTheme = useCallback(
    async (id: string) => {
      await supabase.from("custom_themes").delete().eq("id", id);
      const list = customThemes.filter((c) => c.id !== id);
      setCustomThemes(list);
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
      value={{
        theme,
        setTheme,
        customThemes,
        saveCustomTheme,
        updateCustomTheme,
        deleteCustomTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
