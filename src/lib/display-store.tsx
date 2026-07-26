import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Smartphone, Tablet, Monitor, Tv, RotateCcw } from "lucide-react";

export type DisplayId =
  | "phone"
  | "tablet-vertical"
  | "tablet-horizontal"
  | "monitor-horizontal"
  | "monitor-vertical"
  | "tv";

export type DisplayOption = {
  id: DisplayId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const DISPLAYS: readonly DisplayOption[] = [
  {
    id: "phone",
    name: "Phone",
    description: "Compact single-column layout, larger tap targets, tight spacing.",
    icon: Smartphone,
  },
  {
    id: "tablet-vertical",
    name: "Tablet (vertical)",
    description: "Roomy single column with generous padding — ideal held in portrait.",
    icon: Tablet,
  },
  {
    id: "tablet-horizontal",
    name: "Tablet (horizontal)",
    description: "Two-column split with a persistent side menu.",
    icon: Tablet,
  },
  {
    id: "monitor-horizontal",
    name: "Monitor (horizontal)",
    description: "Full desktop layout, multi-column dashboard, comfortable density.",
    icon: Monitor,
  },
  {
    id: "monitor-vertical",
    name: "Monitor (vertical)",
    description: "Tall single-column stream, optimized for portrait displays.",
    icon: Monitor,
  },
  {
    id: "tv",
    name: "TV",
    description: "Oversized type and controls, low density — readable across the room.",
    icon: Tv,
  },
] as const;

const STORAGE_KEY = "bamboo.display";

function detectDisplay(): DisplayId {
  if (typeof window === "undefined") return "monitor-horizontal";
  const w = window.innerWidth;
  const h = window.innerHeight;
  const landscape = w >= h;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const ua = navigator.userAgent || "";
  const isTvUA = /\b(SmartTV|SMART-TV|GoogleTV|AppleTV|BRAVIA|Web0S|WebOS|Tizen|HbbTV|NetCast|VIERA)\b/i.test(ua);

  if (isTvUA) return "tv";
  if (!coarse && w >= 1800 && landscape) return "tv";
  if (coarse && w < 640) return "phone";
  if (!coarse && w < 640) return "phone";
  if (coarse && w < 1180) return landscape ? "tablet-horizontal" : "tablet-vertical";
  if (!landscape && w >= 900) return "monitor-vertical";
  return "monitor-horizontal";
}

function applyDisplay(id: DisplayId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-display", id);
}

type DisplayContextValue = {
  display: DisplayId;
  detected: DisplayId;
  assigned: DisplayId | null;
  assignDisplay: (id: DisplayId) => void;
  clearAssignment: () => void;
};

const DisplayContext = createContext<DisplayContextValue>({
  display: "monitor-horizontal",
  detected: "monitor-horizontal",
  assigned: null,
  assignDisplay: () => {},
  clearAssignment: () => {},
});

export function DisplayProvider({ children }: { children: ReactNode }) {
  const [detected, setDetected] = useState<DisplayId>("monitor-horizontal");
  const [assigned, setAssigned] = useState<DisplayId | null>(null);

  // Initial resolution + re-resolution whenever the signed-in user changes
  // (defaults are per user AND per device).
  useEffect(() => {
    const resolve = () => {
      const v = readScoped(STORAGE_KEY);
      const stored = v && DISPLAYS.some((d) => d.id === v) ? (v as DisplayId) : null;
      const d = detectDisplay();
      setDetected(d);
      setAssigned(stored);
      applyDisplay(stored ?? d);
    };
    resolve();
    const unsub = subscribePrefsUser(resolve);
    return () => {
      unsub();
    };
  }, []);

  // Re-detect on resize / orientation change (only affects the effective
  // display when the user hasn't manually assigned one).
  useEffect(() => {
    const onResize = () => {
      const d = detectDisplay();
      setDetected(d);
      if (!assigned) applyDisplay(d);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [assigned]);

  const assignDisplay = useCallback((id: DisplayId) => {
    setAssigned(id);
    writeScoped(STORAGE_KEY, id);
    applyDisplay(id);
  }, []);

  const clearAssignment = useCallback(() => {
    setAssigned(null);
    writeScoped(STORAGE_KEY, null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    applyDisplay(detectDisplay());
  }, []);

  const display = assigned ?? detected;

  return (
    <DisplayContext.Provider value={{ display, detected, assigned, assignDisplay, clearAssignment }}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplay() {
  return useContext(DisplayContext);
}

export const DISPLAY_RESET_ICON = RotateCcw;
