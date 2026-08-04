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
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
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

/** Fire a system notification for an in-app notification message. */
export function showDevicePush(message: string, tag?: string) {
  if (!enabled || !devicePushSupported()) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    // still show — users asked for an alert on every notification
  }
  try {
    const n = new Notification("Bamboo Calendar", {
      body: message,
      tag,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
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
