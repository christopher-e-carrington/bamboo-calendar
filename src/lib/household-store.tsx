import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_EVENTS,
  DEFAULT_PROFILES,
  DEFAULT_TASKS,
  type CalendarEvent,
  type Profile,
  type TaskItem,
} from "./profiles";

interface HouseholdState {
  profiles: Profile[];
  events: CalendarEvent[];
  tasks: TaskItem[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  toggleTask: (id: string) => void;
  addEvent: (e: Omit<CalendarEvent, "id">) => void;
  visibleEvents: CalendarEvent[];
  visibleTasks: TaskItem[];
  activeProfile: Profile;
}

const Ctx = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [profiles] = useState<Profile[]>(DEFAULT_PROFILES);
  const [events, setEvents] = useState<CalendarEvent[]>(DEFAULT_EVENTS);
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_TASKS);
  const [activeProfileId, setActiveProfileId] = useState<string>("family");

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  const visibleEvents = useMemo(
    () => (activeProfileId === "family" ? events : events.filter((e) => e.profileId === activeProfileId || e.profileId === "family")),
    [events, activeProfileId],
  );
  const visibleTasks = useMemo(
    () => (activeProfileId === "family" ? tasks : tasks.filter((t) => t.profileId === activeProfileId || t.profileId === "family")),
    [tasks, activeProfileId],
  );

  const value: HouseholdState = {
    profiles,
    events,
    tasks,
    activeProfileId,
    setActiveProfileId,
    toggleTask: (id) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    addEvent: (e) => setEvents((es) => [...es, { ...e, id: crypto.randomUUID() }]),
    visibleEvents,
    visibleTasks,
    activeProfile,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHousehold must be used within HouseholdProvider");
  return v;
}
