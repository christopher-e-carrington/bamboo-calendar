import { useCallback, useSyncExternalStore } from "react";

/**
 * Device-level push/system notifications.
 * Uses the browser Notification API so alerts surface outside the app window
 * (system tray / notification shade) while the app is open in a tab.
 * Saved per device.
 */

const KEY = "bamboo:device-push";

function load(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Default ON: only off when the user explicitly turned it off.
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

let enabled = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isDevicePushEnabled() {
  return enabled;
}

export function devicePushSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function devicePushPermission(): NotificationPermission | "unsupported" {
  if (!devicePushSupported()) return "unsupported";
  return Notification.permission;
}

export async function setDevicePushEnabled(next: boolean): Promise<boolean> {
  if (next) {
    if (!devicePushSupported()) return false;
    let perm = Notification.permission;
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = "denied";
      }
    }
    if (perm !== "granted") {
      enabled = false;
      emit();
      return false;
    }
  }
  enabled = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
  emit();
  return next;
}

const SW_URL = "/notif-sw.js";
let swReg: ServiceWorkerRegistration | null = null;
let swPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Register the notification-only service worker.
 * Mobile browsers (notably Android Chrome) throw on `new Notification()`,
 * so notifications must be shown via the service worker registration.
 */
async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swReg) return swReg;
  if (!swPromise) {
    swPromise = navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then(async (reg) => {
        await navigator.serviceWorker.ready.catch(() => undefined);
        swReg = reg;
        return reg;
      })
      .catch(() => null);
  }
  return swPromise;
}

/** Fire a system notification for an in-app notification message. */
export function showDevicePush(message: string, tag?: string) {
  if (!enabled || !devicePushSupported()) return;
  if (Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body: message,
    tag,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  };

  void (async () => {
    // Preferred path: service worker (required on mobile).
    const reg = await ensureServiceWorker();
    if (reg) {
      try {
        await reg.showNotification("Bamboo Calendar", options);
        return;
      } catch {
        // fall through to the constructor path
      }
    }
    try {
      const n = new Notification("Bamboo Calendar", options);
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          // ignore
        }
        n.close();
      };
    } catch {
      // ignore
    }
  })();
}

/** Ask for notification permission once, since push is on by default. */
export async function initDevicePush() {
  if (!enabled || !devicePushSupported()) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
    emit();
  }
  if (Notification.permission === "granted") {
    await ensureServiceWorker();
  }
}



export function useDevicePush() {
  const on = useSyncExternalStore(subscribe, isDevicePushEnabled, () => false);
  const toggle = useCallback((v: boolean) => setDevicePushEnabled(v), []);
  return {
    enabled: on,
    supported: devicePushSupported(),
    permission: devicePushPermission(),
    setEnabled: toggle,
  };
}
