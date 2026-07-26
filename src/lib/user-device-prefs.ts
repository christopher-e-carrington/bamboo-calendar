import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-user + per-device preferences.
 *
 * localStorage is already device-specific, so scoping each key by the signed-in
 * user id gives us "user AND device specific" defaults: the same person can have
 * different defaults on their phone and their computer, and two people sharing a
 * device keep their own defaults.
 */

let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function setPrefsUser(id: string | null) {
  if (id === currentUserId) return;
  currentUserId = id;
  notify();
}

export function getPrefsUser() {
  return currentUserId;
}

export function subscribePrefsUser(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-renders (and re-reads scoped prefs) whenever the signed-in user changes. */
export function usePrefsUser() {
  const [id, setId] = useState<string | null>(currentUserId);
  useEffect(() => subscribePrefsUser(() => setId(currentUserId)), []);
  return id;
}

export function scopedKey(base: string) {
  return currentUserId ? `${base}::${currentUserId}` : base;
}

export function readScoped(base: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    // Fall back to the legacy unscoped value so existing settings carry over.
    return localStorage.getItem(scopedKey(base)) ?? localStorage.getItem(base);
  } catch {
    return null;
  }
}

export function writeScoped(base: string, value: string | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (value === null) localStorage.removeItem(scopedKey(base));
    else localStorage.setItem(scopedKey(base), value);
  } catch {
    // ignore
  }
}

/* ---------------- Starting home page ---------------- */

export const HOME_PAGE_KEY = "bamboo.home.default";
export const DEFAULT_HOME_PAGE = "today";

export function getDefaultHomePage(): string {
  return readScoped(HOME_PAGE_KEY) || DEFAULT_HOME_PAGE;
}

export function setDefaultHomePage(id: string | null) {
  writeScoped(HOME_PAGE_KEY, id);
  notify();
}

export function useDefaultHomePage() {
  const userId = usePrefsUser();
  const [page, setPage] = useState<string>(DEFAULT_HOME_PAGE);
  useEffect(() => {
    setPage(getDefaultHomePage());
  }, [userId]);
  return {
    homePage: page,
    setHomePage: (id: string) => {
      setDefaultHomePage(id);
      setPage(id);
    },
  };
}

/* ---------------- Keep the scope in sync with auth ---------------- */

if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => setPrefsUser(data.session?.user?.id ?? null));
  supabase.auth.onAuthStateChange((_e, session) => setPrefsUser(session?.user?.id ?? null));
}
