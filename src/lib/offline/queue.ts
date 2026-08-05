/**
 * Offline write queue.
 *
 * When the device has no connection, every Supabase REST write (insert /
 * update / delete) is captured here instead of failing. As soon as the
 * connection comes back the queued writes are replayed in the order they were
 * made — "my offline change wins", so they are sent as-is and overwrite
 * whatever the server currently holds.
 */

const STORAGE_KEY = "bamboo:offline-queue:v1";

export interface QueuedWrite {
  id: string;
  at: number;
  url: string;
  method: string;
  /** Headers worth replaying (auth is re-attached fresh at send time). */
  headers: Record<string, string>;
  body: string | null;
}

type Listener = (state: OfflineState) => void;

export interface OfflineState {
  online: boolean;
  pending: number;
  syncing: boolean;
}

let syncing = false;
const listeners = new Set<Listener>();

function safeParse(raw: string | null): QueuedWrite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

export function readQueue(): QueuedWrite[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeQueue(items: QueuedWrite[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full — drop silently rather than break the app */
  }
  emit();
}

export function enqueueWrite(item: Omit<QueuedWrite, "id" | "at">) {
  const items = readQueue();
  items.push({ ...item, id: crypto.randomUUID(), at: Date.now() });
  writeQueue(items);
}

export function getOfflineState(): OfflineState {
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    pending: readQueue().length,
    syncing,
  };
}

function emit() {
  const state = getOfflineState();
  listeners.forEach((l) => l(state));
}

export function subscribeOffline(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyConnectivityChange() {
  emit();
}

/** Replays the queue. Resolves with the number of writes that went through. */
export async function flushQueue(getAuthToken: () => Promise<string | null>): Promise<number> {
  if (typeof window === "undefined" || syncing) return 0;
  if (!navigator.onLine) return 0;
  let items = readQueue();
  if (items.length === 0) return 0;

  syncing = true;
  emit();
  let sent = 0;

  try {
    const token = await getAuthToken();
    while (items.length > 0) {
      const [next, ...rest] = items;
      if (!next) break;
      const headers = new Headers(next.headers);
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (apikey) headers.set("apikey", apikey);
      if (token) headers.set("Authorization", `Bearer ${token}`);

      let response: Response;
      try {
        response = await originalFetch(next.url, {
          method: next.method,
          headers,
          body: next.body ?? undefined,
        });
      } catch {
        // Still offline / flaky — stop and keep everything queued.
        break;
      }

      if (response.status >= 500) break; // server hiccup: retry later
      // 2xx = applied. 4xx = the row is gone or invalid; dropping it keeps the
      // queue from wedging forever on one bad write.
      if (response.ok) sent += 1;
      items = rest;
      writeQueue(items);
    }
  } finally {
    syncing = false;
    emit();
  }

  return sent;
}

/** Captured before we monkey-patch window.fetch so replays never re-queue. */
export const originalFetch: typeof fetch =
  typeof window !== "undefined" ? window.fetch.bind(window) : (globalThis.fetch as typeof fetch);
