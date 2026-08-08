import { useCallback, useSyncExternalStore } from "react";
import { appServiceWorkerUrl } from "@/lib/offline/sw";

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

// In the published app this is the offline+push worker (`/sw.js`, which imports
// the push handlers); elsewhere it's the notification-only worker.
const SW_URL = appServiceWorkerUrl();
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

/* ---- cross-tab / cross-reload de-duplication ---------------------- */
const DEDUPE_KEY = "bamboo:push-shown";
const DEDUPE_TTL = 10 * 60 * 1000;

function readShown(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DEDUPE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** Returns true when this exact alert was already shown recently. */
function alreadyShown(key: string) {
  try {
    const now = Date.now();
    const map = readShown();
    for (const k of Object.keys(map)) if (now - map[k]! > DEDUPE_TTL) delete map[k];
    if (map[key] !== undefined) {
      localStorage.setItem(DEDUPE_KEY, JSON.stringify(map));
      return true;
    }
    map[key] = now;
    localStorage.setItem(DEDUPE_KEY, JSON.stringify(map));
    return false;
  } catch {
    return false;
  }
}

/** Fire a system notification for an in-app notification message. */
export function showDevicePush(message: string, tag?: string) {
  if (!enabled || !devicePushSupported()) return;
  if (Notification.permission !== "granted") return;
  if (alreadyShown(tag || message)) return;
  if (tag && alreadyShown(`msg:${message}`)) return;


  const options: NotificationOptions = {
    body: message,
    tag,
    icon: "/app-icon-192.png",
    badge: "/favicon.png",
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

/* ------------------------------------------------------------------ *
 * Web Push — notifications that arrive with the app / browser closed
 * ------------------------------------------------------------------ */

const VAPID_PUBLIC_KEY =
  "BPcRsy5FMe3rdnMSqC1cbY7irLG6-oCpTT2NkeiDBetx8GN5fbtYZdLVPccpNIbYNVflYOLJc-3Yzrig5HxjMls";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  let str = "";
  new Uint8Array(buf).forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function webPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Register this device for background Web Push and store the subscription
 * so the backend can deliver notifications when nothing is open.
 */
export async function registerWebPush(
  saveSubscription: (sub: { endpoint: string; p256dh: string; auth: string; label: string }) => Promise<void>,
) {
  if (!enabled || !webPushSupported()) return;
  if (Notification.permission !== "granted") return;

  const reg = await ensureServiceWorker();
  if (!reg) return;

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
    const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey("p256dh"));
    const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey("auth"));
    if (!p256dh || !auth) return;
    await saveSubscription({
      endpoint: sub.endpoint,
      p256dh,
      auth,
      label: navigator.userAgent.slice(0, 120),
    });
  } catch {
    // ignore — push simply stays unavailable on this device
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
