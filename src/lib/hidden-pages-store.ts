import { useSyncExternalStore } from "react";

const STORAGE_KEY = "bamboo.hiddenPages";
const EVENT = "bamboo:hidden-pages-change";

function read(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

let cached: string[] = [];
let cachedKey = "";
function getSnapshot(): string[] {
  const next = read();
  const key = next.join("|");
  if (key !== cachedKey) {
    cached = next;
    cachedKey = key;
  }
  return cached;
}

function getServerSnapshot(): string[] {
  return [];
}

export function useHiddenPages() {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setHidden = (ids: string[]) => write(Array.from(new Set(ids)));
  const togglePage = (id: string, hide: boolean) => {
    const current = read();
    const next = hide
      ? Array.from(new Set([...current, id]))
      : current.filter((x) => x !== id);
    write(next);
  };
  const isHidden = (id: string) => hidden.includes(id);
  return { hidden, setHidden, togglePage, isHidden };
}
