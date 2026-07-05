import { useSyncExternalStore } from "react";

export type NotifCategory =
  | "events"
  | "goals"
  | "projects"
  | "shopping"
  | "tasks"
  | "contacts"
  | "documents"
  | "meals"
  | "memories";

export type NotifPrefs = {
  events: { added: boolean; deleted: boolean; hourBefore: boolean };
  goals: { added: boolean; progress: boolean; completed: boolean };
  projects: { added: boolean; progress: boolean; completed: boolean };
  shopping: { added: boolean; checkedOff: boolean };
  tasks: { added: boolean; checkedOff: boolean };
  contacts: { added: boolean };
  documents: { added: boolean };
  meals: { added: boolean };
  memories: { added: boolean };
};

export const DEFAULT_PREFS: NotifPrefs = {
  events: { added: true, deleted: true, hourBefore: true },
  goals: { added: true, progress: false, completed: true },
  projects: { added: false, progress: false, completed: false },
  shopping: { added: true, checkedOff: true },
  tasks: { added: false, checkedOff: false },
  contacts: { added: false },
  documents: { added: false },
  meals: { added: false },
  memories: { added: false },
};

const KEY = "bamboo:notif-prefs";

function load(): NotifPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    const merged: Record<string, Record<string, boolean>> = {};
    for (const cat of Object.keys(DEFAULT_PREFS)) {
      merged[cat] = {
        ...(DEFAULT_PREFS as unknown as Record<string, Record<string, boolean>>)[cat],
        ...(parsed?.[cat] ?? {}),
      };
    }
    return merged as unknown as NotifPrefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

let current: NotifPrefs = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getPrefs(): NotifPrefs {
  return current;
}

export function setPref<C extends NotifCategory, K extends keyof NotifPrefs[C]>(
  cat: C,
  key: K,
  val: NotifPrefs[C][K],
) {
  current = { ...current, [cat]: { ...current[cat], [key]: val } };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNotifPrefs(): NotifPrefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}
