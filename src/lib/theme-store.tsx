import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = [
  { id: "parchment", name: "Parchment", description: "Warm cream, bamboo greens. The original.", swatches: ["#f6f1e4", "#7a9a72", "#c2a878", "#4a5a3c"] },
  { id: "fauna", name: "Fauna", description: "Deep walnut, copper, amber and forest moss.", swatches: ["#2a1f17", "#5a7045", "#c98c4a", "#e8c884"] },
  { id: "flora", name: "Flora", description: "Sage, mossy greens, terracotta and seafoam.", swatches: ["#cfd8c2", "#5e7a4f", "#b86e52", "#4a9080"] },
  { id: "sky", name: "Sky", description: "Soft blues, warm sand and seafoam.", swatches: ["#eaf2fa", "#6fa4d6", "#f2a882", "#4a9e8e"] },
  { id: "light", name: "Light", description: "Material light. Clean and neutral.", swatches: ["#ffffff", "#f5f5f5", "#1976d2", "#212121"] },
  { id: "dark", name: "Dark", description: "Material dark. Easy on the eyes.", swatches: ["#121212", "#1e1e1e", "#90caf9", "#e0e0e0"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "bamboo.theme";
const DEFAULT_THEME: ThemeId = "parchment";

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}>({ theme: DEFAULT_THEME, setTheme: () => {} });

function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
  root.classList.add(`theme-${theme}`);
  // Material dark uses .dark for shadcn dark variants
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as ThemeId | null;
    const initial = stored && THEMES.some((t) => t.id === stored) ? stored : DEFAULT_THEME;
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
