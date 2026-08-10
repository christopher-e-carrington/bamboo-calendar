/**
 * Recovery for stale cached bundles.
 *
 * After a new deploy the service worker can still hold on to old asset URLs.
 * When a lazily-loaded chunk 404s the app throws a "failed to fetch dynamically
 * imported module" error and the whole screen is replaced by the error page.
 * These helpers detect that case, clear the caches once, and reload.
 */

const RELOAD_FLAG = "bamboo:chunk-reload";

export function isChunkLoadError(error: unknown): boolean {
  const msg =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  if (!msg) return false;
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg) ||
    /'text\/html' is not a valid JavaScript MIME type/i.test(msg)
  );
}

/** Clears caches/service workers and reloads once per session. */
export async function recoverFromStaleBundle(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* private mode – still attempt a reload below */
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.update()));
    }
  } catch {
    /* best effort */
  }

  window.location.reload();
  return true;
}

/** Installs global listeners so stale-chunk failures self-heal. */
export function installChunkRecovery() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void recoverFromStaleBundle();
  });

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error ?? event.message)) void recoverFromStaleBundle();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) void recoverFromStaleBundle();
  });
}
