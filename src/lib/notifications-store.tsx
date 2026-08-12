import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { nextReminderOccurrence } from "@/lib/reminder-recurrence";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household-store";
import { getPrefs } from "@/lib/notification-prefs";
import { showDevicePush, initDevicePush, registerWebPush } from "@/lib/device-push";

export interface Notification {
  id: string;
  message: string;
  at: number;
  read: boolean;
}

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clear: () => void;
}

const Ctx = createContext<NotificationsState | undefined>(undefined);

const MAX_ITEMS = 50;
const SEEN_TTL = 24 * 60 * 60 * 1000;

function storageKey(householdId: string) {
  return `bamboo:notifications:${householdId}`;
}

function seenKeyStore(householdId: string) {
  return `bamboo:notifications-seen:${householdId}`;
}

/** Persisted, cross-tab/reload de-duplication of notification keys+messages. */
function markSeen(householdId: string, key: string): boolean {
  try {
    const raw = localStorage.getItem(seenKeyStore(householdId));
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    for (const k of Object.keys(map)) if (now - map[k]! > SEEN_TTL) delete map[k];
    if (map[key] !== undefined) {
      localStorage.setItem(seenKeyStore(householdId), JSON.stringify(map));
      return true;
    }
    map[key] = now;
    localStorage.setItem(seenKeyStore(householdId), JSON.stringify(map));
    return false;
  } catch {
    return false;
  }
}


export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { householdId, profiles } = useHousehold();
  const [items, setItems] = useState<Notification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  // Ask for system notification permission (push is on by default) and
  // register this device for background Web Push.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initDevicePush();
      if (cancelled || !householdId) return;
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      await registerWebPush(async (sub) => {
        await supabase.from("push_subscriptions").upsert(
          {
            household_id: householdId,
            user_id: userId,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            label: sub.label,
          },
          { onConflict: "endpoint" },
        );
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId]);


  // Load persisted notifications when household changes
  useEffect(() => {
    if (!householdId) return;
    try {
      const raw = localStorage.getItem(storageKey(householdId));
      if (raw) {
        const parsed = JSON.parse(raw) as Notification[];
        setItems(parsed);
        parsed.forEach((n) => seenRef.current.add(n.id));
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, [householdId]);

  // Persist
  useEffect(() => {
    if (!householdId) return;
    try {
      localStorage.setItem(storageKey(householdId), JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {
      // ignore
    }
  }, [items, householdId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!householdId) return;

    const push = (key: string, message: string) => {
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      // Persisted guard: survives reloads, remounts and other tabs so the same
      // change never produces a second alert.
      if (markSeen(householdId, key)) return;
      if (markSeen(householdId, `msg:${message}`)) return;
      showDevicePush(message, key);
      setItems((prev) =>
        prev.some((n) => n.id === key || n.message === message)
          ? prev
          : [{ id: key, message, at: Date.now(), read: false }, ...prev].slice(0, MAX_ITEMS),
      );
    };


    const profileName = (id: string | null | undefined) => {
      if (!id) return "Someone";
      const p = profilesRef.current.find((pp) => pp.id === id);
      return p?.name ?? "Someone";
    };

    const filter = `owner_id=eq.${householdId}`;
    const projectIds = new Set<string>();

    // Unique topic per mount: reusing a fixed topic can leave a "joined" channel
    // with no server-side subscription when React remounts the effect.
    const channel = supabase
      .channel(`notifications:${householdId}:${Math.random().toString(36).slice(2)}`)
      // ---------- Events ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter }, (payload) => {
        if (!getPrefs().events.added) return;
        const row = payload.new as { id: string; title: string; profile_id?: string };
        push(`event:insert:${row.id}`, `${profileName(row.profile_id)}'s event "${row.title}" was added`);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "events", filter }, (payload) => {
        if (!getPrefs().events.deleted) return;
        const row = payload.old as { id: string; title?: string };
        push(`event:delete:${row.id}`, `Event "${row.title ?? "Untitled"}" was removed`);
      })
      // ---------- Shopping ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shopping_items", filter }, (payload) => {
        if (!getPrefs().shopping.added) return;
        const row = payload.new as { id: string; name: string };
        push(`shop:insert:${row.id}`, `"${row.name}" was added to the shopping list`);
      })
      // Deletions (including clearing the picked-up list) intentionally do not notify.

      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shopping_items", filter }, (payload) => {
        if (!getPrefs().shopping.checkedOff) return;
        const oldRow = payload.old as { id: string; done?: boolean };
        const newRow = payload.new as { id: string; done?: boolean; name?: string };
        if (!oldRow.done && newRow.done) {
          push(`shop:check:${newRow.id}`, `"${newRow.name ?? "Item"}" was crossed off the shopping list`);
        }
      })
      // ---------- Household members ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` }, (payload) => {
        const row = payload.new as { id: string; display_name?: string };
        push(`member:insert:${row.id}`, `${row.display_name ?? "A new member"} joined the household`);
      })
      // ---------- Goals ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "goals", filter }, (payload) => {
        const row = payload.new as { id: string; done?: boolean; title?: string; profile_id?: string };
        if (row.done) {
          if (getPrefs().goals.completed) {
            push(`goal:complete:${row.id}`, `${profileName(row.profile_id)} completed the goal "${row.title ?? "Untitled"}"`);
          }
        } else if (getPrefs().goals.added) {
          push(`goal:insert:${row.id}`, `${profileName(row.profile_id)} added the goal "${row.title ?? "Untitled"}"`);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "goals", filter }, (payload) => {
        const oldRow = payload.old as { id: string; done?: boolean; progress?: number };
        const newRow = payload.new as { id: string; done?: boolean; progress?: number; title?: string; profile_id?: string };
        if (!oldRow.done && newRow.done) {
          if (getPrefs().goals.completed) {
            push(`goal:complete:${newRow.id}`, `${profileName(newRow.profile_id)} completed the goal "${newRow.title ?? "Untitled"}"`);
          }
        } else if (getPrefs().goals.progress && (newRow.progress ?? 0) > (oldRow.progress ?? 0)) {
          push(`goal:progress:${newRow.id}:${newRow.progress}`, `${profileName(newRow.profile_id)} made progress on "${newRow.title ?? "Untitled"}"`);
        }
      })
      // ---------- Projects ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "projects", filter }, (payload) => {
        const row = payload.new as { id: string; title?: string; status?: string; profile_id?: string };
        projectIds.add(row.id);
        if (row.status === "completed") {
          if (getPrefs().projects.completed) {
            push(`project:complete:${row.id}`, `${profileName(row.profile_id)} completed the project "${row.title ?? "Untitled"}"`);
          }
        } else if (getPrefs().projects.added) {
          push(`project:insert:${row.id}`, `${profileName(row.profile_id)} added the project "${row.title ?? "Untitled"}"`);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter }, (payload) => {
        const oldRow = payload.old as { id: string; status?: string };
        const newRow = payload.new as { id: string; status?: string; title?: string; profile_id?: string };
        if (oldRow.status !== "completed" && newRow.status === "completed" && getPrefs().projects.completed) {
          push(`project:complete:${newRow.id}`, `${profileName(newRow.profile_id)} completed the project "${newRow.title ?? "Untitled"}"`);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "project_steps" }, (payload) => {
        if (!getPrefs().projects.progress) return;
        const oldRow = payload.old as { id: string; done?: boolean };
        const newRow = payload.new as { id: string; done?: boolean; title?: string; project_id?: string };
        // Only notify for our own projects
        if (!newRow.project_id || !projectIds.has(newRow.project_id)) return;
        if (!oldRow.done && newRow.done) {
          push(`project:step:${newRow.id}`, `Project step completed: "${newRow.title ?? "step"}"`);
        }
      })
      // ---------- Tasks ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter }, (payload) => {
        if (!getPrefs().tasks.added) return;
        const row = payload.new as { id: string; title?: string; profile_id?: string };
        push(`task:insert:${row.id}`, `${profileName(row.profile_id)} added the task "${row.title ?? "Untitled"}"`);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter }, (payload) => {
        if (!getPrefs().tasks.checkedOff) return;
        const oldRow = payload.old as { id: string; done?: boolean };
        const newRow = payload.new as { id: string; done?: boolean; title?: string; profile_id?: string };
        if (!oldRow.done && newRow.done) {
          push(`task:done:${newRow.id}`, `${profileName(newRow.profile_id)} completed the task "${newRow.title ?? "Untitled"}"`);
        }
      })
      // ---------- Contacts / Documents / Meals / Memories ----------
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contacts", filter }, (payload) => {
        if (!getPrefs().contacts.added) return;
        const row = payload.new as { id: string; name?: string };
        push(`contact:insert:${row.id}`, `Contact "${row.name ?? "Someone"}" was added`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "documents", filter }, (payload) => {
        if (!getPrefs().documents.added) return;
        const row = payload.new as { id: string; name?: string };
        push(`doc:insert:${row.id}`, `Document "${row.name ?? "Untitled"}" was added`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recipes", filter }, (payload) => {
        if (!getPrefs().meals.added) return;
        const row = payload.new as { id: string; name?: string };
        push(`meal:insert:${row.id}`, `Meal "${row.name ?? "Untitled"}" was added`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "memories", filter }, (payload) => {
        if (!getPrefs().memories.added) return;
        const row = payload.new as { id: string; title?: string };
        push(`memory:insert:${row.id}`, `Memory "${row.title ?? "Untitled"}" was added`);
      })
      // ---------- Profile claim ----------
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "household_profiles", filter }, (payload) => {
        const oldRow = payload.old as { id: string; claimed_user_id?: string | null };
        const newRow = payload.new as { id: string; claimed_user_id?: string | null; name?: string };
        if (!oldRow.claimed_user_id && newRow.claimed_user_id) {
          push(`profile:claim:${newRow.id}:${newRow.claimed_user_id}`, `${newRow.name ?? "A profile"} was taken over by a household member`);
        }
      })
      .subscribe();

    // ---------- Polling fallback ----------
    // Realtime can silently drop a subscription (sleeping tab, reconnect, proxy).
    // Poll for newly created events / shopping items so notifications still land.
    const since = new Date().toISOString();
    const pollNew = async () => {
      const [evRes, shopRes] = await Promise.all([
        supabase
          .from("events")
          .select("id,title,profile_id,created_at")
          .eq("owner_id", householdId)
          .gt("created_at", since)
          .order("created_at", { ascending: true })
          .limit(20),
        supabase
          .from("shopping_items")
          .select("id,name,created_at")
          .eq("owner_id", householdId)
          .gt("created_at", since)
          .order("created_at", { ascending: true })
          .limit(20),
      ]);
      if (getPrefs().events.added) {
        (evRes.data ?? []).forEach((row) => {
          push(`event:insert:${row.id}`, `${profileName(row.profile_id)}'s event "${row.title}" was added`);
        });
      }
      if (getPrefs().shopping.added) {
        (shopRes.data ?? []).forEach((row) => {
          push(`shop:insert:${row.id}`, `"${row.name}" was added to the shopping list`);
        });
      }
    };
    const pollTimer = window.setInterval(pollNew, 15 * 1000);



    // Seed known project ids so step updates can be attributed to this household
    supabase
      .from("projects")
      .select("id")
      .eq("owner_id", householdId)
      .then(({ data }) => {
        (data ?? []).forEach((r) => projectIds.add(r.id));
      });

    // ---------- Events 1-hour-before scheduler ----------
    const notifiedHourBefore = new Set<string>();
    const scanUpcoming = async () => {
      if (!getPrefs().events.hourBefore) return;
      const now = Date.now();
      const soon = now + 65 * 60 * 1000; // slightly more than 1h to catch the window
      const { data } = await supabase
        .from("events")
        .select("id,title,start_at,profile_id")
        .eq("owner_id", householdId)
        .gte("start_at", new Date(now).toISOString())
        .lte("start_at", new Date(soon).toISOString());
      (data ?? []).forEach((ev) => {
        const key = `event:1h:${ev.id}`;
        if (notifiedHourBefore.has(key)) return;
        const startMs = new Date(ev.start_at).getTime();
        const diff = startMs - Date.now();
        if (diff <= 60 * 60 * 1000 && diff > 0) {
          notifiedHourBefore.add(key);
          push(key, `${profileName(ev.profile_id)}'s event "${ev.title}" starts in about an hour`);
        }
      });
    };
    scanUpcoming();
    const timer = window.setInterval(scanUpcoming, 60 * 1000);


    // ---------- Reminders due scheduler ----------
    // Fires an in-app notification when a reminder's send_at time arrives,
    // and marks it as sent so it doesn't fire again.
    const scanReminders = async () => {
      const nowIso = new Date().toISOString();
      const { data } = await (supabase as any)
        .from("reminders")
        .select("id,message,recipient_profile_ids,channels,send_at,sent_at,recurrence")
        .eq("owner_id", householdId)
        .is("sent_at", null)
        .lte("send_at", nowIso);
      const rows = (data ?? []) as Array<{
        id: string;
        message: string;
        recipient_profile_ids: string[];
        channels: string[];
        send_at: string;
        sent_at: string | null;
        recurrence?: string | null;
      }>;
      for (const r of rows) {
        if (r.channels?.includes("app")) {
          const names = (r.recipient_profile_ids ?? [])
            .map((id) => profileName(id))
            .join(", ");
          push(`reminder:${r.id}:${r.send_at}`, `Reminder for ${names || "you"}: ${r.message}`);
        }
        const next = nextReminderOccurrence(r.send_at, r.recurrence);
        if (next) {
          await (supabase as any)
            .from("reminders")
            .update({ send_at: next.toISOString(), sent_at: null })
            .eq("id", r.id);
        } else {
          await (supabase as any)
            .from("reminders")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", r.id);
        }
      }
    };

    scanReminders();
    const reminderTimer = window.setInterval(scanReminders, 30 * 1000);


    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
      window.clearInterval(reminderTimer);
      window.clearInterval(pollTimer);
    };
  }, [householdId]);

  const unreadCount = items.filter((n) => !n.read).length;
  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const clear = () => {
    setItems([]);
    seenRef.current.clear();
  };

  return (
    <Ctx.Provider value={{ items, unreadCount, markAllRead, clear }}>{children}</Ctx.Provider>
  );
}

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications must be used within NotificationsProvider");
  return v;
}
