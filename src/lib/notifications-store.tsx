import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household-store";

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

function storageKey(householdId: string) {
  return `bamboo:notifications:${householdId}`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { householdId, profiles } = useHousehold();
  const [items, setItems] = useState<Notification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const mountedAt = useRef<number>(Date.now());

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
      setItems((prev) =>
        [{ id: key, message, at: Date.now(), read: false }, ...prev].slice(0, MAX_ITEMS),
      );
    };

    const profileName = (id: string | null | undefined) => {
      if (!id) return "Someone";
      const p = profilesRef.current.find((pp) => pp.id === id);
      return p?.name ?? "Someone";
    };

    const channel = supabase
      .channel(`notifications:${householdId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as { id: string; title: string; profile_id?: string };
          // Skip events that existed before mount (initial historical inserts shouldn't arrive, but guard)
          push(`event:insert:${row.id}`, `${profileName(row.profile_id)}'s event "${row.title}" was added`);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "events", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const row = payload.old as { id: string; title?: string; profile_id?: string };
          push(`event:delete:${row.id}`, `Event "${row.title ?? "Untitled"}" was removed`);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shopping_items", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as { id: string; name: string };
          push(`shop:insert:${row.id}`, `"${row.name}" was added to the shopping list`);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shopping_items", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const row = payload.old as { id: string; name?: string };
          push(`shop:delete:${row.id}`, `"${row.name ?? "Item"}" was removed from the shopping list`);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as { id: string; display_name?: string };
          push(`member:insert:${row.id}`, `${row.display_name ?? "A new member"} joined the household`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "goals", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const oldRow = payload.old as { id: string; done?: boolean };
          const newRow = payload.new as { id: string; done?: boolean; title?: string; profile_id?: string };
          if (!oldRow.done && newRow.done) {
            push(
              `goal:complete:${newRow.id}`,
              `${profileName(newRow.profile_id)} completed the goal "${newRow.title ?? "Untitled"}"`,
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "goals", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as { id: string; done?: boolean; title?: string; profile_id?: string };
          if (row.done) {
            push(
              `goal:complete:${row.id}`,
              `${profileName(row.profile_id)} completed the goal "${row.title ?? "Untitled"}"`,
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "household_profiles", filter: `owner_id=eq.${householdId}` },
        (payload) => {
          const oldRow = payload.old as { id: string; claimed_user_id?: string | null; name?: string };
          const newRow = payload.new as { id: string; claimed_user_id?: string | null; name?: string };
          if (!oldRow.claimed_user_id && newRow.claimed_user_id) {
            push(
              `profile:claim:${newRow.id}:${newRow.claimed_user_id}`,
              `${newRow.name ?? "A profile"} was taken over by a household member`,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const unreadCount = items.filter((n) => !n.read).length;
  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const clear = () => {
    setItems([]);
    seenRef.current.clear();
  };

  // Suppress unused-var lint for mountedAt (kept for potential future filtering)
  void mountedAt;

  return (
    <Ctx.Provider value={{ items, unreadCount, markAllRead, clear }}>{children}</Ctx.Provider>
  );
}

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications must be used within NotificationsProvider");
  return v;
}
