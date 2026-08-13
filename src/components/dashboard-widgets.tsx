import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useHousehold } from "@/lib/household-store";
import { useShopping, useMealPlan, getWeekStart } from "@/lib/meals-store";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getWeather } from "@/lib/weather.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Calendar as CalIcon,
  CheckSquare,
  Target,
  FolderKanban,
  ChefHat,
  ShoppingCart,
  NotebookPen,
  Cloud,
  CalendarPlus,
  Home,
} from "lucide-react";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function WidgetShell({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border/60 drag-handle cursor-grab active:cursor-grabbing">
        <Icon className="h-4 w-4 text-primary" />
        <div className="font-display text-sm">{title}</div>
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">{children}</div>
    </div>
  );
}

export function AgendaWidget() {
  const { visibleEvents } = useHousehold();
  const now = new Date();
  const todays = visibleEvents
    .filter((e) => isSameDay(new Date(e.start_at), now))
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  return (
    <WidgetShell title="Today's agenda" icon={Home}>
      {todays.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing on today.</p>
      ) : (
        <ul className="space-y-2">
          {todays.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">{fmtTime(e.start_at)}</span>
              <span className="text-sm truncate">{e.title}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function EventsWidget() {
  const { visibleEvents } = useHousehold();
  const now = Date.now();
  const upcoming = visibleEvents
    .filter((e) => +new Date(e.start_at) >= now)
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
    .slice(0, 8);
  return (
    <WidgetShell title="Upcoming events" icon={CalendarPlus}>
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground text-xs">No upcoming events.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <div className="w-1 self-stretch rounded-full bg-primary/60" />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{e.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtDay(e.start_at)} · {fmtTime(e.start_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function CalendarWidget() {
  const { visibleEvents } = useHousehold();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const monthStart = new Date(cursor);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startDow = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const eventDays = new Set(
    visibleEvents
      .filter((e) => {
        const d = new Date(e.start_at);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
      })
      .map((e) => new Date(e.start_at).getDate()),
  );
  const today = new Date();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <WidgetShell title="Calendar" icon={CalIcon}>
      <div className="flex items-center justify-between mb-2">
        <button
          className="text-xs px-2 py-0.5 rounded hover:bg-secondary"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <div className="text-sm font-medium">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button
          className="text-xs px-2 py-0.5 rounded hover:bg-secondary"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground text-center mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const isToday =
            d === today.getDate() &&
            cursor.getMonth() === today.getMonth() &&
            cursor.getFullYear() === today.getFullYear();
          const has = eventDays.has(d);
          return (
            <div
              key={i}
              className={`aspect-square rounded-md text-xs flex flex-col items-center justify-center relative ${
                isToday ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {d}
              {has && !isToday && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function TodosWidget() {
  const { visibleTasks, toggleTask } = useHousehold();
  const now = new Date();
  const list = visibleTasks
    .filter((t) => {
      if (t.done) return false;
      if ((!t.recurrence || t.recurrence === "none") && t.due_at) {
        const d = new Date(t.due_at);
        return isSameDay(d, now) || d < now;
      }
      if (t.tier === "daily" || t.recurrence === "daily") return true;
      if (!t.due_at) return t.recurrence === "none";
      const due = new Date(t.due_at);
      return isSameDay(due, now) || due < now;
    })
    .slice(0, 15);
  return (
    <WidgetShell title="To-dos" icon={CheckSquare}>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing due.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Checkbox checked={t.done} onCheckedChange={(v) => toggleTask(t.id, Boolean(v))} />
              <span className="text-sm truncate">{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function GoalsWidget() {
  const { visibleGoals } = useHousehold();
  const list = visibleGoals.filter((g) => !g.done).slice(0, 8);
  return (
    <WidgetShell title="Goals" icon={Target}>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-xs">No active goals.</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((g) => {
            const pct = g.target ? Math.round((g.progress / g.target) * 100) : 0;
            return (
              <li key={g.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate">{g.title}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

interface ProjectRow {
  id: string;
  title: string;
  status?: string | null;
}
export function ProjectsWidget() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects" as never)
        .select("id,title,status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });
  const list = (q.data ?? []).filter((p) => p.status !== "done").slice(0, 8);
  return (
    <WidgetShell title="Projects" icon={FolderKanban}>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-xs">No active projects.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((p) => (
            <li key={p.id} className="text-sm truncate">
              • {p.title}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function MealsWidget() {
  const weekStart = getWeekStart();
  const { plan } = useMealPlan(weekStart);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <WidgetShell title="This week's meals" icon={ChefHat}>
      <ul className="space-y-1.5">
        {days.map((d, i) => {
          const entry = (plan ?? []).find((m: any) => m.day_of_week === i);
          return (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-xs text-muted-foreground w-10 shrink-0">{d}</span>
              <span className="truncate">{entry?.recipe_name || <span className="text-muted-foreground/60">—</span>}</span>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

export function ShoppingWidget() {
  const { items, toggleItem } = useShopping();
  const list = items.filter((i) => !i.done).slice(0, 15);
  return (
    <WidgetShell title="Shopping" icon={ShoppingCart}>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing to buy.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <Checkbox checked={i.done} onCheckedChange={(v) => toggleItem(i.id, Boolean(v))} />
              <span className="text-sm truncate">{i.name}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

interface NoteRow {
  id: string;
  title: string | null;
  content: string | null;
  updated_at: string;
}
export function NotesWidget() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NoteRow[]> => {
      const { data, error } = await supabase
        .from("notes" as never)
        .select("id,title,content,updated_at")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });
  const list = q.data ?? [];
  return (
    <WidgetShell title="Notes" icon={NotebookPen}>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-xs">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <div className="text-sm truncate font-medium">{n.title || "Untitled"}</div>
              {n.content && (
                <div className="text-xs text-muted-foreground line-clamp-2">{n.content}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

export function WeatherWidget() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    try {
      const cached = localStorage.getItem("weather:coords");
      if (cached) setCoords(JSON.parse(cached));
      else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            localStorage.setItem("weather:coords", JSON.stringify(c));
            setCoords(c);
          },
          () => {},
        );
      }
    } catch {}
  }, []);
  const fetchWeather = useServerFn(getWeather);
  const q = useQuery({
    queryKey: ["weather", coords?.lat, coords?.lon],
    enabled: !!coords,
    staleTime: 15 * 60 * 1000,
    queryFn: () => fetchWeather({ data: coords! }),
  });
  return (
    <WidgetShell title="Weather" icon={Cloud}>
      {!coords ? (
        <p className="text-xs text-muted-foreground">Set location on the Today page.</p>
      ) : q.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : q.error || !q.data ? (
        <p className="text-xs text-muted-foreground">Weather unavailable.</p>
      ) : (
        <div>
          <div className="text-xs text-muted-foreground">{q.data.location}</div>
          <div className="text-3xl font-display mt-1">{q.data.today.temp}°</div>
          <div className="text-xs capitalize text-muted-foreground">{q.data.today.description}</div>
          <div className="text-xs text-muted-foreground mt-1">
            H {q.data.today.hi}° · L {q.data.today.lo}°
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export const WIDGET_COMPONENTS = {
  agenda: AgendaWidget,
  events: EventsWidget,
  calendar: CalendarWidget,
  todos: TodosWidget,
  goals: GoalsWidget,
  projects: ProjectsWidget,
  meals: MealsWidget,
  shopping: ShoppingWidget,
  notes: NotesWidget,
  weather: WeatherWidget,
} as const;
