/**
 * Single service-worker registration point.
 *
 * The published app uses the generated `/sw.js` (offline app shell + push);
 * dev and Lovable preview fall back to the notification-only worker so a
 * cached shell can never mask live edits.
 */

const OFFLINE_SW = "/sw.js";
const NOTIF_SW = "/notif-sw.js";

export function offlineSwAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return false;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return false;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return false;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return false;
  if (new URLSearchParams(window.location.search).has("sw") &&
      new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return true;
}

export function appServiceWorkerUrl(): string {
  return offlineSwAllowed() ? OFFLINE_SW : NOTIF_SW;
}

/** Removes the offline worker in contexts where it must not run. */
export async function cleanupOfflineSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (offlineSwAllowed()) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(OFFLINE_SW))
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}
