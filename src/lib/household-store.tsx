import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type ProfileRole = "parent" | "kid" | "shared";

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  color: string;
  initials: string;
  pin?: string | null;
  sort_order: number;
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
  recurrence: "none" | "yearly";
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
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  toggleTask: (id: string, done: boolean) => void;
  visibleEvents: CalendarEvent[];
  visibleTasks: TaskItem[];
  visibleGoals: Goal[];
  activeProfile: Profile | undefined;
  familyProfile: Profile | undefined;
  loading: boolean;
  addProfile: (input: { name: string; role: ProfileRole; color: string }) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  setProfilePin: (id: string, pin: string | null) => Promise<void>;
  addEvent: (input: {
    profile_ids: string[];
    title: string;
    start_at: string;
    end_at?: string | null;
    location?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  addTask: (input: { profile_id: string; title: string; due_at?: string | null; recurrence?: Recurrence; tier?: Tier }) => Promise<void>;
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
      return (data ?? []) as Profile[];
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
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const effectiveActiveId = activeProfileId || familyProfile?.id || "";
  const activeProfile = profiles.find((p) => p.id === effectiveActiveId);

  const events = eventsQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const includesProfile = (e: CalendarEvent, id: string) =>
    (e.profile_ids?.length ? e.profile_ids.includes(id) : e.profile_id === id);

  const visibleEvents = useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.id === familyProfile?.id) return events;
    return events.filter(
      (e) => includesProfile(e, activeProfile.id) || (familyProfile && includesProfile(e, familyProfile.id)),
    );
  }, [events, activeProfile, familyProfile]);

  const visibleTasks = useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.id === familyProfile?.id) return tasks;
    return tasks.filter((t) => t.profile_id === activeProfile.id || t.profile_id === familyProfile?.id);
  }, [tasks, activeProfile, familyProfile]);

  const advanceDate = (iso: string | null | undefined, rec: Recurrence): string | null => {
    const base = iso ? new Date(iso) : new Date();
    if (rec === "daily") base.setDate(base.getDate() + 1);
    else if (rec === "weekly") base.setDate(base.getDate() + 7);
    else if (rec === "monthly") base.setMonth(base.getMonth() + 1);
    else return null;
    return base.toISOString();
  };

  const toggleMut = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
      if (error) throw error;
      if (done) {
        const t = (qc.getQueryData<TaskItem[]>(["tasks", user.id]) ?? []).find((x) => x.id === id);
        if (t && t.recurrence && t.recurrence !== "none") {
          const next_due = advanceDate(t.due_at, t.recurrence);
          await supabase.from("tasks").insert({
            owner_id: user.id,
            profile_id: t.profile_id,
            title: t.title,
            due_at: next_due,
            recurrence: t.recurrence,
          });
        }
      }
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ["tasks", user.id] });
      const prev = qc.getQueryData<TaskItem[]>(["tasks", user.id]);
      qc.setQueryData<TaskItem[]>(["tasks", user.id], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, done } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", user.id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", user.id] }),
  });

  const addMut = useMutation({
    mutationFn: async (input: { name: string; role: ProfileRole; color: string }) => {
      const initials = input.name.trim().slice(0, 2).toUpperCase() || "NP";
      const sort_order = (profiles.at(-1)?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("household_profiles").insert({
        owner_id: user.id,
        name: input.name.trim(),
        role: input.role,
        color: input.color,
        initials,
        sort_order,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profiles", user.id] }),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("events").delete().eq("profile_id", id);
      await supabase.from("tasks").delete().eq("profile_id", id);
      const { error } = await supabase.from("household_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["profiles", user.id] });
      qc.invalidateQueries({ queryKey: ["events", user.id] });
      qc.invalidateQueries({ queryKey: ["tasks", user.id] });
    },
  });

  const setPinMut = useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string | null }) => {
      const { error } = await supabase.from("household_profiles").update({ pin }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profiles", user.id] }),
  });

  const addEventMut = useMutation({
    mutationFn: async (input: {
      profile_ids: string[];
      title: string;
      start_at: string;
      end_at?: string | null;
      location?: string | null;
      notes?: string | null;
    }) => {
      const primary = input.profile_ids[0];
      if (!primary) throw new Error("Assign at least one profile");
      const { error } = await supabase.from("events").insert({
        owner_id: user.id,
        profile_id: primary,
        profile_ids: input.profile_ids,
        title: input.title,
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events", user.id] }),
  });

  const addTaskMut = useMutation({
    mutationFn: async (input: { profile_id: string; title: string; due_at?: string | null; recurrence?: Recurrence; tier?: Tier }) => {
      const { error } = await supabase.from("tasks").insert({
        profile_id: input.profile_id,
        title: input.title,
        due_at: input.due_at ?? null,
        recurrence: input.recurrence ?? "none",
        tier: input.tier ?? "daily",
        owner_id: user.id,
      } as any);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", user.id] }),
  });


  const deleteEventMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events", user.id] }),
  });

  const deleteTaskMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", user.id] }),
  });

  // Goals
  const goalsQ = useQuery({
    queryKey: ["goals", user.id],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await (supabase as any)
        .from("goals")
        .select("*")
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
        owner_id: user.id,
        profile_id: input.profile_id,
        title: input.title,
        tier: input.tier,
        target: input.target ?? 1,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", user.id] }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", user.id] }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", user.id] }),
  });

  const deleteGoalMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals", user.id] }),
  });

  const contactsQ = useQuery({
    queryKey: ["contacts", user.id],
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });


  const addContactMut = useMutation({
    mutationFn: async (input: Omit<Contact, "id" | "created_at">) => {
      const { error } = await supabase.from("contacts").insert({ ...input, owner_id: user.id });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", user.id] });
      qc.invalidateQueries({ queryKey: ["events", user.id] });
    },
  });

  const updateContactMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Contact, "id" | "created_at">> }) => {
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", user.id] });
      qc.invalidateQueries({ queryKey: ["events", user.id] });
    },
  });

  const deleteContactMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", user.id] });
      qc.invalidateQueries({ queryKey: ["events", user.id] });
    },
  });

  const value: HouseholdState = {
    profiles,
    events,
    tasks,
    goals,
    contacts: contactsQ.data ?? [],
    activeProfileId: effectiveActiveId,
    setActiveProfileId,
    toggleTask: (id, done) => toggleMut.mutate({ id, done }),
    visibleEvents,
    visibleTasks,
    visibleGoals,
    activeProfile,
    familyProfile,
    loading: profilesQ.isLoading || eventsQ.isLoading || tasksQ.isLoading,
    addProfile: (input) => addMut.mutateAsync(input).then(() => undefined),
    removeProfile: (id) => removeMut.mutateAsync(id).then(() => undefined),
    setProfilePin: (id, pin) => setPinMut.mutateAsync({ id, pin }).then(() => undefined),
    addEvent: (input) => addEventMut.mutateAsync(input).then(() => undefined),
    addTask: (input) => addTaskMut.mutateAsync(input).then(() => undefined),
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
