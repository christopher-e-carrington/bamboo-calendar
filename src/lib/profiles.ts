export type ProfileRole = "parent" | "kid" | "shared";

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  color: string; // hex/oklch reference for accent dot
  initials: string;
  pin?: string; // 4 digit, optional
}

export interface CalendarEvent {
  id: string;
  profileId: string; // or 'family'
  title: string;
  start: string; // ISO
  end?: string;
  location?: string;
  notes?: string;
}

export interface TaskItem {
  id: string;
  profileId: string;
  title: string;
  done: boolean;
  due?: string;
}

export const DEFAULT_PROFILES: Profile[] = [
  { id: "family", name: "Family", role: "shared", color: "#7BA37A", initials: "FA" },
  { id: "mom", name: "Mom", role: "parent", color: "#A7C29A", initials: "MO", pin: "1234" },
  { id: "dad", name: "Dad", role: "parent", color: "#C9A36B", initials: "DA", pin: "1234" },
  { id: "kid1", name: "Kid 1", role: "kid", color: "#E8B774", initials: "K1" },
  { id: "kitchen", name: "Kitchen", role: "shared", color: "#9CB89A", initials: "KI" },
];

const today = new Date();
const iso = (d: Date) => d.toISOString();
const addDays = (n: number, h = 9) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  d.setHours(h, 0, 0, 0);
  return iso(d);
};

export const DEFAULT_EVENTS: CalendarEvent[] = [
  { id: "e1", profileId: "mom", title: "Yoga class", start: addDays(0, 7), location: "Studio Zen" },
  { id: "e2", profileId: "dad", title: "Team standup", start: addDays(0, 10) },
  { id: "e3", profileId: "kid1", title: "Soccer practice", start: addDays(0, 16), location: "East Field" },
  { id: "e4", profileId: "family", title: "Movie night", start: addDays(1, 19), notes: "Pick something cozy" },
  { id: "e5", profileId: "kitchen", title: "Grocery delivery", start: addDays(2, 11) },
  { id: "e6", profileId: "mom", title: "Dentist", start: addDays(3, 14) },
  { id: "e7", profileId: "family", title: "Hike at Cedar Grove", start: addDays(5, 8) },
];

export const DEFAULT_TASKS: TaskItem[] = [
  { id: "t1", profileId: "kitchen", title: "Restock rice & oats", done: false },
  { id: "t2", profileId: "dad", title: "Renew car insurance", done: false, due: addDays(4) },
  { id: "t3", profileId: "mom", title: "Book pediatrician", done: true },
  { id: "t4", profileId: "kid1", title: "Finish science project", done: false, due: addDays(2) },
  { id: "t5", profileId: "family", title: "Plan weekend brunch", done: false },
];
