import { useCallback, useEffect, useState } from "react";
import type { LayoutItem } from "react-grid-layout";

type Layout = LayoutItem[];

export type WidgetType =
  | "agenda"
  | "calendar"
  | "events"
  | "notes"
  | "todos"
  | "goals"
  | "projects"
  | "meals"
  | "shopping"
  | "weather";

export interface WidgetInstance {
  id: string;
  type: WidgetType;
}

export interface DashboardConfig {
  widgets: WidgetInstance[];
  layouts: { [breakpoint: string]: Layout };
}

export const WIDGET_CATALOG: { type: WidgetType; label: string; defaultW: number; defaultH: number }[] = [
  { type: "agenda", label: "Today's agenda", defaultW: 4, defaultH: 6 },
  { type: "calendar", label: "Calendar (month)", defaultW: 6, defaultH: 8 },
  { type: "events", label: "Upcoming events", defaultW: 4, defaultH: 6 },
  { type: "todos", label: "To-dos", defaultW: 4, defaultH: 6 },
  { type: "goals", label: "Goals", defaultW: 4, defaultH: 5 },
  { type: "projects", label: "Projects", defaultW: 4, defaultH: 5 },
  { type: "meals", label: "This week's meals", defaultW: 4, defaultH: 5 },
  { type: "shopping", label: "Shopping list", defaultW: 4, defaultH: 6 },
  { type: "notes", label: "Notes", defaultW: 4, defaultH: 5 },
  { type: "weather", label: "Weather", defaultW: 3, defaultH: 4 },
];

const DEVICE_KEY = "bamboo:device-id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      (crypto?.randomUUID?.() ??
        `dev-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`);
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function storageKey(userId: string) {
  return `bamboo:dashboard:${userId}:${getDeviceId()}`;
}

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: [
    { id: "w-agenda", type: "agenda" },
    { id: "w-calendar", type: "calendar" },
    { id: "w-todos", type: "todos" },
    { id: "w-weather", type: "weather" },
  ],
  layouts: {
    lg: [
      { i: "w-agenda", x: 0, y: 0, w: 4, h: 6 },
      { i: "w-calendar", x: 4, y: 0, w: 6, h: 8 },
      { i: "w-weather", x: 10, y: 0, w: 2, h: 4 },
      { i: "w-todos", x: 0, y: 6, w: 4, h: 6 },
    ],
  },
};

export function useDashboardConfig(userId: string | undefined) {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = window.localStorage.getItem(storageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardConfig;
        if (parsed && Array.isArray(parsed.widgets)) {
          setConfig({
            widgets: parsed.widgets,
            layouts: parsed.layouts ?? { lg: [] },
          });
        }
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
    setLoaded(true);
  }, [userId]);

  const persist = useCallback(
    (next: DashboardConfig) => {
      setConfig(next);
      if (!userId) return;
      try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [userId],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      const meta = WIDGET_CATALOG.find((w) => w.type === type)!;
      const id = `w-${type}-${Date.now().toString(36)}`;
      const nextWidgets = [...config.widgets, { id, type }];
      const existingLg = config.layouts.lg ?? [];
      const maxY = existingLg.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      const nextLg = [
        ...existingLg,
        { i: id, x: 0, y: maxY, w: meta.defaultW, h: meta.defaultH },
      ];
      persist({ widgets: nextWidgets, layouts: { ...config.layouts, lg: nextLg } });
    },
    [config, persist],
  );

  const removeWidget = useCallback(
    (id: string) => {
      persist({
        widgets: config.widgets.filter((w) => w.id !== id),
        layouts: Object.fromEntries(
          Object.entries(config.layouts).map(([bp, arr]) => [bp, arr.filter((l) => l.i !== id)]),
        ),
      });
    },
    [config, persist],
  );

  const updateLayouts = useCallback(
    (layouts: { [bp: string]: Layout }) => {
      persist({ ...config, layouts });
    },
    [config, persist],
  );

  const reset = useCallback(() => {
    persist(DEFAULT_CONFIG);
  }, [persist]);

  return { config, loaded, addWidget, removeWidget, updateLayouts, reset };
}
