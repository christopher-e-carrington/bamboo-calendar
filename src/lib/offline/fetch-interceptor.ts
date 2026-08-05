/**
 * Makes Supabase writes survive a dropped connection.
 *
 * While offline, any REST insert/update/delete is stored in the offline queue
 * and answered with an optimistic response so the UI updates immediately. The
 * queue is replayed automatically as soon as the connection returns.
 */
import {
  enqueueWrite,
  flushQueue,
  notifyConnectivityChange,
  originalFetch,
  readQueue,
} from "./queue";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const KEEP_HEADERS = ["content-type", "accept", "prefer", "content-profile", "accept-profile"];

let installed = false;
let onFlushed: (() => void) | null = null;

function restBase(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/rest/v1/` : null;
}

function headersToObject(init: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  new Headers(init).forEach((value, key) => {
    if (KEEP_HEADERS.includes(key.toLowerCase())) out[key] = value;
  });
  return out;
}

function tableFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split("/rest/v1/")[1]?.split("?")[0] ?? "";
  } catch {
    return "";
  }
}

/** Builds the response PostgREST would have returned for this write. */
function optimisticResult(method: string, body: string | null, accept: string) {
  let rows: Record<string, unknown>[] = [];
  if (method !== "DELETE" && body) {
    try {
      const parsed = JSON.parse(body);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      rows = [];
    }
  }
  const now = new Date().toISOString();
  const filled = rows.map((row) => ({
    id: (row as { id?: string }).id ?? crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    ...row,
  }));
  const single = accept.includes("vnd.pgrst.object");
  return { rows: filled, payload: single ? (filled[0] ?? {}) : filled };
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isNetworkError(err: unknown) {
  return err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message));
}

export function installOfflineFetch(options: { getAuthToken: () => Promise<string | null>; onSynced?: () => void }) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  onFlushed = options.onSynced ?? null;

  const base = restBase();

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const isSupabaseWrite = !!base && url.startsWith(base) && WRITE_METHODS.has(method);

    if (!isSupabaseWrite) return originalFetch(input as RequestInfo, init);

    const bodyText = typeof init?.body === "string" ? init.body : null;
    const headers = new Headers(init?.headers);
    const accept = headers.get("accept") ?? "";

    const queueIt = () => {
      const { rows, payload } = optimisticResult(method, bodyText, accept);
      // Replay the exact rows we optimistically showed (ids included) so the
      // server ends up with the same data the user already sees.
      const replayBody =
        method === "DELETE" ? null : rows.length > 0 ? JSON.stringify(rows.length === 1 && !Array.isArray(safeParse(bodyText)) ? rows[0] : rows) : bodyText;
      enqueueWrite({
        url,
        method,
        headers: headersToObject(init?.headers),
        body: replayBody,
      });
      return jsonResponse(payload, method === "POST" ? 201 : 200);
    };

    if (!navigator.onLine) return queueIt();

    try {
      return await originalFetch(input as RequestInfo, init);
    } catch (err) {
      if (isNetworkError(err)) return queueIt();
      throw err;
    }
  } as typeof fetch;

  const trySync = async () => {
    notifyConnectivityChange();
    if (!navigator.onLine) return;
    const sent = await flushQueue(options.getAuthToken);
    if (sent > 0) onFlushed?.();
  };

  window.addEventListener("online", trySync);
  window.addEventListener("offline", notifyConnectivityChange);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void trySync();
  });
  // Retry regularly in case the browser never fires an `online` event.
  window.setInterval(() => {
    if (readQueue().length > 0) void trySync();
  }, 20000);

  void trySync();

  function safeParse(text: string | null): unknown {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
