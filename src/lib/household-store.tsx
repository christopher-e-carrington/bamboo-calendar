import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pushEventToGoogle, deleteEventFromGoogle } from "@/lib/google-calendar.functions";
import type { User } from "@supabase/supabase-js";

const fireAndForget = (p: Promise<unknown>) => {
  p.catch((e) => console.warn("[google-sync]", e));
};

export type ProfileRole = "parent" | "kid" | "shared";

export interface Profile {
  id: string;
  name: string;
  nickname?: string | null;
  role: ProfileRole;
  color: string;
  initials: string;
  pin?: string | null;
  sort_order: number;
  birthday?: string | null;
}

export interface CalendarEvent {
  id: string;
  profile_id: string;
  profile_ids: string[];
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  notes?: string | null;
  recurrence:
    | "none"
    | "weekly"
    | "biweekly"
    | "monthly_date"
    | "monthly_dow"
    | "quarterly_date"
    | "quarterly_dow"
    | "yearly";
  contact_id?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  birthday?: string | null;
  notes?: string | null;
  created_at: string;
}

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type Tier = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export const TIERS: Tier[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export interface TaskItem {
  id: string;
  profile_id: string;
  title: string;
  done: boolean;
  due_at?: string | null;
  completed_at?: string | null;
  recurrence: Recurrence;
  tier: Tier;
}

export interface Goal {
  id: string;
  profile_id: string;
  title: string;
  tier: Tier;
  target: number;
  progress: number;
  done: boolean;
  notes?: string | null;
  created_at: string;
}

interface HouseholdState {
  profiles: Profile[];
  events: CalendarEvent[];
  tasks: TaskItem[];
  goals: Goal[];
  contacts: Contact[];
  householdId: string;
  isHouseholdOwner: boolean;
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  defaultProfileId: string;
  setDefaultProfileId: (id: string) => void;
  toggleTask: (id: string, done: boolean) => void;
  visibleEvents: CalendarEvent[];
  visibleTasks: TaskItem[];
  visibleGoals: Goal[];
  activeProfile: Profile | undefined;
  familyProfile: Profile | undefined;
  loading: boolean;
  addProfile: (input: { name: string; role: ProfileRole; color: string; birthday?: string | null }) => Promise<void>;
  updateProfile: (id: string, patch: { name?: string; nickname?: string | null; role?: ProfileRole; color?: string; birthday?: string | null }) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  setProfilePin: (id: string, pin: string | null) => Promise<void>;
  addEvent: (input: {
    profile_ids: string[];
    title: string;
    start_at: string;
    end_at?: string | null;
    location?: string | null;
    notes?: string | null;
    recurrence?: CalendarEvent["recurrence"];
  }) => Promise<void>;
  addTask: (input: { profile_id: string; title: string; due_at?: string | null; recurrence?: Recurrence; tier?: Tier }) => Promise<void>;
  updateTask: (id: string, patch: { title?: string; due_at?: string | null; recurrence?: Recurrence; tier?: Tier }) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addGoal: (input: { profile_id: string; title: string; tier: Tier; target?: number; notes?: string | null }) => Promise<void>;
  updateGoalProgress: (id: string, progress: number) => Promise<void>;
  toggleGoalDone: (id: string, done: boolean) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addContact: (input: Omit<Contact, "id" | "created_at">) => Promise<void>;
  updateContact: (id: string, input: Partial<Omit<Contact, "id" | "created_at">>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
}


const Ctx = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children, user }: { children: ReactNode; user: User }) {
  const qc = useQueryClient();

  // Determine which household this user belongs to. If they have joined
  // someone else's household via invitation, use that; otherwise they are
  // the creator of their own household (household_id = their user.id).
  const membershipQ = useQuery({
    queryKey: ["my-household", user.id],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0]?.household_id as string | undefined) ?? user.id;
    },
  });
  const householdId = membershipQ.data ?? user.id;

  const profilesQ = useQuery({
    queryKey: ["profiles", householdId],
    enabled: !!membershipQ.data,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("household_profiles")
        .select("*")
        .eq("owner_id", householdId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        name: (r.nickname && String(r.nickname).trim()) ? String(r.nickname).trim() : r.name,
      })) as Profile[];
    },
  });

  const eventsQ = useQuery({
    queryKey: ["events", householdId],
    enabled: !!membershipQ.data,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("owner_id", householdId)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks", householdId],
    enabled: !!membershipQ.data,
    queryFn: async (): Promise<TaskItem[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("owner_id", householdId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskItem[];
    },
  });

  const profiles = profilesQ.data ?? [];
  const familyProfile =
    profiles.find((p) => p.name.toLowerCase() === "household") ??
    profiles.find((p) => p.name.toLowerCase() === "family") ??
    profiles[0];
  const defaultKey = `bamboo.defaultProfile.${user.id}`;
  const [activeProfileId, setActiveProfileIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(defaultKey) ?? "";
  });
  const setActiveProfileId = (id: string) => setActiveProfileIdState(id);
  const [defaultProfileId, setDefaultProfileIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(defaultKey) ?? "";
  });
  const setDefaultProfileId = (id: string) => {
    setDefaultProfileIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(defaultKey, id);
      else window.localStorage.removeItem(defaultKey);
    }
    setActiveProfileIdState(id);
  };
  const effectiveActiveId = activeProfileId || familyProfile?.id || "";
  const activeProfile = profiles.find((p) => p.id === effectiveActiveId);

  const events = eventsQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  // Daily housekeeping for tasks:
  // - Reset done=false on recurring tasks completed before today so they
  //   reappear once per new day (instead of spawning duplicates on toggle).
  // - Roll non-daily recurring tasks (weekly/monthly/quarterly/yearly)
  //   forward to their next occurrence when the previous one has passed,
  //   so weekly stays on its weekday, monthly on its date, etc.
  // - Delete daily-recurring tasks left undone after their day to avoid
  //   piling up; one-time tasks are left alone (they remain until done).
  const cleanupRanRef = useRef<string | null>(null);
  useEffect(() => {
    if (!tasksQ.data || !householdId) return;
    const todayKey = new Date().toDateString();
    if (cleanupRanRef.current === `${householdId}:${todayKey}`) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const rollForward = (iso: string, rec: Recurrence): string => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      while (d < startOfToday) {
        if (rec === "daily") d.setDate(d.getDate() + 1);
        else if (rec === "weekly") d.setDate(d.getDate() + 7);
        else if (rec === "monthly") d.setMonth(d.getMonth() + 1);
        else if (rec === "quarterly") d.setMonth(d.getMonth() + 3);
        else if (rec === "yearly") d.setFullYear(d.getFullYear() + 1);
        else break;
      }
      return d.toISOString();
    };

    const toReset = (tasksQ.data ?? []).filter(
      (t: any) =>
        t.done &&
        t.recurrence &&
        t.recurrence !== "none" &&
        (!t.completed_at || new Date(t.completed_at) < startOfToday),
    );
    const toRoll = (tasksQ.data ?? []).filter(
      (t) =>
        t.recurrence &&
        t.recurrence !== "none" &&
        t.recurrence !== "daily" &&
        t.due_at &&
        new Date(t.due_at) < startOfToday,
    );
    const dailyStale = (tasksQ.data ?? []).filter(
      (t) =>
        !t.done &&
        t.recurrence === "daily" &&
        t.due_at &&
        new Date(t.due_at) < startOfToday,
    );
    // Completed one-time tasks: disappear the day after they were completed.
    const oneTimeCompletedStale = (tasksQ.data ?? []).filter(
      (t: any) =>
        t.done &&
        (!t.recurrence || t.recurrence === "none") &&
        t.completed_at &&
        new Date(t.completed_at) < startOfToday,
    );

    if (
      toReset.length === 0 &&
      toRoll.length === 0 &&
      dailyStale.length === 0 &&
      oneTimeCompletedStale.length === 0
    ) {
      cleanupRanRef.current = `${householdId}:${todayKey}`;
      return;
    }
    cleanupRanRef.current = `${householdId}:${todayKey}`;
    (async () => {
      if (toReset.length > 0) {
        await supabase
          .from("tasks")
          .update({ done: false, completed_at: null } as any)
          .in("id", toReset.map((t) => t.id));
      }
      for (const t of toRoll) {
        const next = rollForward(t.due_at as string, t.recurrence);
        await supabase
          .from("tasks")
          .update({ due_at: next } as any)
          .eq("id", t.id);
      }
      if (dailyStale.length > 0) {
        await supabase.from("tasks").delete().in("id", dailyStale.map((t) => t.id));
      }
      if (oneTimeCompletedStale.length > 0) {
        await supabase
          .from("tasks")
          .delete()
          .in("id", oneTimeCompletedStale.map((t) => t.id));
      }
      qc.invalidateQueries({ queryKey: ["tasks", householdId] });
    })();
  }, [tasksQ.data, householdId, qc]);

  const includesProfile = (e: CalendarEvent, id: string) =>
    (e.profile_ids?.length ? e.profile_ids.includes(id) : e.profile_id === id);

  const visibleEvents = useMemo(() => {
    if (!activeProfile) return [];
    // Shared/household view: show only events explicitly assigned to the
    // shared profile. Personal-only events stay on their owner's calendar so
    // the same event no longer appears on both views.
    if (activeProfile.id === familyProfile?.id) {
      return events.filter((e) => includesProfile(e, activeProfile.id));
    }
    return events.filter(
      (e) => includesProfile(e, activeProfile.id) || (familyProfile && includesProfile(e, familyProfile.id)),
    );
  }, [events, activeProfile, familyProfile]);

  const visibleTasks = useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.id === familyProfile?.id) return tasks;
    return tasks.filter((t) => t.profile_id === activeProfile.id || t.profile_id === familyProfile?.id);
  }, [tasks, activeProfile, familyProfile]);




  const toggleMut = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ done, completed_at: done ? new Date().toISOString() : null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ["tasks", householdId] });
      const prev = qc.getQueryData<TaskItem[]>(["tasks", householdId]);
      qc.setQueryData<TaskItem[]>(["tasks", householdId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, done } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", householdId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", householdId] }),
  });

  const addMut = useMutation({
    mutationFn: async (input: { name: string; role: ProfileRole; color: string; birthday?: string | null }) => {
      if (countHouseholdUsers(profiles) >= MAX_HOUSEHOLD_USERS) {
        throw new Error(`This account is limited to ${MAX_HOUSEHOLD_USERS} users.`);
      }
      const initials = input.name.trim().slice(0, 2).toUpperCase() || "NP";
      const sort_order = (profiles.at(-1)?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("household_profiles").insert({
        owner_id: householdId,
        name: input.name.trim(),
        role: input.role,
        color: input.color,
        initials,
        sort_order,
        birthday: input.birthday ?? null,
      } as any);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["profiles", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });
    },
  });

  const updateProfileMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; role?: ProfileRole; color?: string; birthday?: string | null } }) => {
      const { error } = await supabase.from("household_profiles").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["profiles", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });
    },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("events").delete().eq("profile_id", id);
      await supabase.from("tasks").delete().eq("profile_id", id);
      const { error } = await supabase.from("household_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["profiles", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });
      qc.invalidateQueries({ queryKey: ["tasks", householdId] });
    },
  });

  const setPinMut = useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string | null }) => {
      const { error } = await supabase.from("household_profiles").update({ pin }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profiles", householdId] }),
  });

  const addEventMut = useMutation({
    mutationFn: async (input: {
      profile_ids: string[];
      title: string;
      start_at: string;
      end_at?: string | null;
      location?: string | null;
      notes?: string | null;
      recurrence?: CalendarEvent["recurrence"];
    }) => {
      const primary = input.profile_ids[0];
      if (!primary) throw new Error("Assign at least one profile");
      const { data, error } = await supabase.from("events").insert({
        owner_id: householdId,
        profile_id: primary,
        profile_ids: input.profile_ids,
        title: input.title,
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        recurrence: input.recurrence ?? "none",
      } as any).select("id").single();
      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: (id) => {
      if (id) fireAndForget(pushEventToGoogle({ data: { eventId: id } }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events", householdId] }),
  });

  const addTaskMut = useMutation({
    mutationFn: async (input: { profile_id: string; title: string; due_at?: string | null; recurrence?: Recurrence; tier?: Tier }) => {
      const { error } = await supabase.from("tasks").insert({
        profile_id: input.profile_id,
        title: input.title,
        due_at: input.due_at ?? null,
        recurrence: input.recurrence ?? "none",
        tier: input.tier ?? "daily",
        owner_id: householdId,
      } as any);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", householdId] }),
  });

  const updateTaskMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { title?: string; due_at?: string | null; recurrence?: Recurrence; tier?: Tier } }) => {
      const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", householdId] }),
  });

  const deleteEventMut = useMutation({
    mutationFn: async (id: string) => {
      // Best-effort: delete on Google first; the mapping row cascades when the
      // event row is removed below, so we need to call this before the delete.
      try {
        await deleteEventFromGoogle({ data: { eventId: id } });
      } catch (e) {
        console.warn("[google-sync] delete failed", e);
      }
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events", householdId] }),
  });

  const deleteTaskMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", householdId] }),
  });

  // Goals
  const goalsQ = useQuery({
    queryKey: ["goals", householdId],
    enabled: !!membershipQ.data,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await (supabase as any)
        .from("goals")
        .select("*")
        .eq("owner_id", householdId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });

  const goals = goalsQ.data ?? [];
  const visibleGoals = useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.id === familyProfile?.id) return goals;
    return goals.filter((g) => g.profile_id === activeProfile.id || g.profile_id === familyProfile?.id);
  }, [goals, activeProfile, familyProfile]);

  const addGoalMut = useMutation({
    mutationFn: async (input: { profile_id: string; title: string; tier: Tier; target?: number; notes?: string | null }) => {
      const { error } = await (supabase as any).from("goals").insert({
        owner_id: householdId,
        profile_id: input.profile_id,
        title: input.title,
        tier: input.tier,
        target: input.target ?? 1,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", householdId] }),
  });

  const updateGoalProgressMut = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const cur = goals.find((g) => g.id === id);
      const target = cur?.target ?? 1;
      const clamped = Math.max(0, Math.min(progress, target));
      const done = clamped >= target;
      const { error } = await (supabase as any).from("goals").update({ progress: clamped, done }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", householdId] }),
  });

  const toggleGoalDoneMut = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const cur = goals.find((g) => g.id === id);
      const target = cur?.target ?? 1;
      const { error } = await (supabase as any)
        .from("goals")
        .update({ done, progress: done ? target : 0 })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", householdId] }),
  });

  const deleteGoalMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", householdId] }),
  });

  const contactsQ = useQuery({
    queryKey: ["contacts", householdId],
    enabled: !!membershipQ.data,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("owner_id", householdId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });


  const addContactMut = useMutation({
    mutationFn: async (input: Omit<Contact, "id" | "created_at">) => {
      const { error } = await supabase.from("contacts").insert({ ...input, owner_id: householdId });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });
    },
  });

  const updateContactMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Contact, "id" | "created_at">> }) => {
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });
    },
  });

  const deleteContactMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });
    },
  });

  const value: HouseholdState = {
    profiles,
    events,
    tasks,
    goals,
    contacts: contactsQ.data ?? [],
    householdId,
    isHouseholdOwner: householdId === user.id,
    activeProfileId: effectiveActiveId,
    setActiveProfileId,
    defaultProfileId,
    setDefaultProfileId,
    toggleTask: (id, done) => toggleMut.mutate({ id, done }),
    visibleEvents,
    visibleTasks,
    visibleGoals,
    activeProfile,
    familyProfile,
    loading: profilesQ.isLoading || eventsQ.isLoading || tasksQ.isLoading,
    addProfile: (input) => addMut.mutateAsync(input).then(() => undefined),
    updateProfile: (id, patch) => updateProfileMut.mutateAsync({ id, patch }).then(() => undefined),
    removeProfile: (id) => removeMut.mutateAsync(id).then(() => undefined),
    setProfilePin: (id, pin) => setPinMut.mutateAsync({ id, pin }).then(() => undefined),
    addEvent: (input) => addEventMut.mutateAsync(input).then(() => undefined),
    addTask: (input) => addTaskMut.mutateAsync(input).then(() => undefined),
    updateTask: (id, patch) => updateTaskMut.mutateAsync({ id, patch }).then(() => undefined),
    deleteEvent: (id) => deleteEventMut.mutateAsync(id).then(() => undefined),
    deleteTask: (id) => deleteTaskMut.mutateAsync(id).then(() => undefined),
    addGoal: (input) => addGoalMut.mutateAsync(input).then(() => undefined),
    updateGoalProgress: (id, progress) => updateGoalProgressMut.mutateAsync({ id, progress }).then(() => undefined),
    toggleGoalDone: (id, done) => toggleGoalDoneMut.mutateAsync({ id, done }).then(() => undefined),
    deleteGoal: (id) => deleteGoalMut.mutateAsync(id).then(() => undefined),
    addContact: (input) => addContactMut.mutateAsync(input).then(() => undefined),
    updateContact: (id, patch) => updateContactMut.mutateAsync({ id, patch }).then(() => undefined),
    deleteContact: (id) => deleteContactMut.mutateAsync(id).then(() => undefined),
  };


  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHousehold must be used within HouseholdProvider");
  return v;
}
