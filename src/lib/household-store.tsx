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
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface TaskItem {
  id: string;
  profile_id: string;
  title: string;
  done: boolean;
  due_at?: string | null;
}

interface HouseholdState {
  profiles: Profile[];
  events: CalendarEvent[];
  tasks: TaskItem[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  toggleTask: (id: string, done: boolean) => void;
  visibleEvents: CalendarEvent[];
  visibleTasks: TaskItem[];
  activeProfile: Profile | undefined;
  familyProfile: Profile | undefined;
  loading: boolean;
  addProfile: (input: { name: string; role: ProfileRole; color: string }) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  setProfilePin: (id: string, pin: string | null) => Promise<void>;
  addEvent: (input: {
    profile_id: string;
    title: string;
    start_at: string;
    end_at?: string | null;
    location?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  addTask: (input: { profile_id: string; title: string; due_at?: string | null }) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

const Ctx = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children, user }: { children: ReactNode; user: User }) {
  const qc = useQueryClient();

  const profilesQ = useQuery({
    queryKey: ["profiles", user.id],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("household_profiles")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const eventsQ = useQuery({
    queryKey: ["events", user.id],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks", user.id],
    queryFn: async (): Promise<TaskItem[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
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

  const visibleEvents = useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.id === familyProfile?.id) return events;
    return events.filter((e) => e.profile_id === activeProfile.id || e.profile_id === familyProfile?.id);
  }, [events, activeProfile, familyProfile]);

  const visibleTasks = useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.id === familyProfile?.id) return tasks;
    return tasks.filter((t) => t.profile_id === activeProfile.id || t.profile_id === familyProfile?.id);
  }, [tasks, activeProfile, familyProfile]);

  const toggleMut = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
      if (error) throw error;
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

  const value: HouseholdState = {
    profiles,
    events,
    tasks,
    activeProfileId: effectiveActiveId,
    setActiveProfileId,
    toggleTask: (id, done) => toggleMut.mutate({ id, done }),
    visibleEvents,
    visibleTasks,
    activeProfile,
    familyProfile,
    loading: profilesQ.isLoading || eventsQ.isLoading || tasksQ.isLoading,
    addProfile: async (input) => {
      await addMut.mutateAsync(input);
    },
    removeProfile: async (id) => {
      await removeMut.mutateAsync(id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHousehold must be used within HouseholdProvider");
  return v;
}
