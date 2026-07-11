import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useHousehold } from "@/lib/household-store";
import { getWeather, geocodeLocation, type WeatherKind as ApiWeatherKind } from "@/lib/weather.functions";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CloudOff, Loader2 } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EventDialog } from "./event-dialog";
import {
  Calendar as CalIcon,
  MapPin,
  Sparkles,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Target as TargetIcon,
  ListChecks,
  Leaf,
  Navigation,
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
function pct(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function Ring({ value, label, sublabel, color = "hsl(var(--primary))" }: { value: number; label: string; sublabel: string; color?: string }) {
  const size = 92;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4 flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={7} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={7}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-xl">{value}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{sublabel}</div>
      </div>
    </div>
  );
}

const WEATHER_ICONS: Record<ApiWeatherKind, typeof Sun> = {
  sun: Sun,
  cloudSun: CloudSun,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  fog: CloudFog,
};

type Coords = { lat: number; lon: number };

function useGeolocation(enabled: boolean) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation not supported");
      return;
    }
    const cached = localStorage.getItem("weather:coords");
    if (cached) {
      try { setCoords(JSON.parse(cached)); } catch { /* ignore */ }
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        localStorage.setItem("weather:coords", JSON.stringify(c));
      },
      (err) => setError(err.message),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, [enabled]);
  return { coords, error };
}

type ManualLocation = { lat: number; lon: number; label: string };

function TomorrowWeatherWidget() {
  const [manual, setManual] = useState<ManualLocation | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("weather:manual");
      return raw ? (JSON.parse(raw) as ManualLocation) : null;
    } catch { return null; }
  });
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const { coords: geoCoords, error: geoError } = useGeolocation(!manual);
  const fetchWeather = useServerFn(getWeather);
  const geocode = useServerFn(geocodeLocation);

  const activeCoords: Coords | null = manual
    ? { lat: manual.lat, lon: manual.lon }
    : geoCoords;

  const { data, isLoading, error } = useQuery({
    queryKey: ["weather", activeCoords?.lat, activeCoords?.lon],
    queryFn: () => fetchWeather({ data: activeCoords! }),
    enabled: !!activeCoords,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const tomorrow = data?.forecast[0];
  const Icon = tomorrow ? WEATHER_ICONS[tomorrow.kind] : Sun;
  const fatal = (!manual && geoError) || (error as Error | null)?.message;

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const hit = await geocode({ data: { query: query.trim() } });
      const loc: ManualLocation = { lat: hit.lat, lon: hit.lon, label: hit.label };
      localStorage.setItem("weather:manual", JSON.stringify(loc));
      setManual(loc);
      setEditing(false);
      setQuery("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find that location");
    } finally {
      setSearching(false);
    }
  };

  const clearManual = () => {
    localStorage.removeItem("weather:manual");
    setManual(null);
  };

  return (
    <section className="bamboo-card p-5 relative overflow-hidden">
      <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <header className="flex items-center justify-between mb-4 relative gap-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg">Tomorrow's weather</h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[55%] text-right underline-offset-2 hover:underline"
          title="Set location"
        >
          {manual?.label ?? data?.location ?? (isLoading || !activeCoords ? "Set location" : "—")}
        </button>
      </header>

      {editing && (
        <form onSubmit={submitManual} className="mb-3 flex gap-2 relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, ZIP, or 'Paris, FR'"
            className="h-9"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!query.trim() || searching}>
            {searching ? "…" : "Set"}
          </Button>
          {manual && (
            <Button type="button" size="sm" variant="ghost" onClick={clearManual}>
              Use GPS
            </Button>
          )}
        </form>
      )}

      {fatal && !data ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
          <CloudOff className="h-5 w-5 shrink-0" />
          <span className="text-xs">
            {geoError
              ? "Location blocked. Tap the location label above to set one manually."
              : "Couldn't reach the weather service."}
          </span>
        </div>
      ) : !data || !tomorrow ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-6">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">Fetching tomorrow's forecast…</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <Icon className="h-9 w-9" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-4xl leading-none">{tomorrow.hi}°</div>
              <div className="text-xs text-muted-foreground mt-1 capitalize truncate">
                {tomorrow.kind === "cloudSun" ? "partly cloudy" : tomorrow.kind}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-1">
              <div>H {tomorrow.hi}° · L {tomorrow.lo}°</div>
              <div>{tomorrow.day}</div>
            </div>
          </div>
          {data.forecast.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-5">
              {data.forecast.map((d) => {
                const I = WEATHER_ICONS[d.kind];
                return (
                  <div key={d.day} className="rounded-xl border border-border bg-background/50 p-3 flex flex-col items-center gap-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.day}</div>
                    <I className="h-5 w-5 text-primary" />
                    <div className="text-xs">
                      <span className="font-medium">{d.hi}°</span>
                      <span className="text-muted-foreground"> / {d.lo}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SmartTravelCard({ title, location, startAt }: { title: string; location: string; startAt: string }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  return (
    <section className="bamboo-card p-0 overflow-hidden">
      <div className="relative h-32 bg-gradient-to-br from-primary/25 via-primary/10 to-secondary">
        <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 60" preserveAspectRatio="none">
          <defs>
            <pattern id="grid-tomorrow" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="60" fill="url(#grid-tomorrow)" />
          <path d="M0 40 Q 30 20 60 35 T 100 25" stroke="hsl(var(--primary))" strokeWidth="1.2" fill="none" opacity="0.7" />
          <circle cx="62" cy="32" r="2.4" fill="hsl(var(--primary))" />
        </svg>
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px]">
          <span className="rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-muted-foreground flex items-center gap-1">
            <Navigation className="h-3 w-3" /> Smart travel
          </span>
          <span className="rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-muted-foreground">
            {fmtTime(startAt)}
          </span>
        </div>
      </div>
      <div className="p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-xs text-muted-foreground truncate">{location}</div>
        </div>
        <Button asChild size="sm" className="rounded-full gap-1">
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <Navigation className="h-3.5 w-3.5" /> Open in Maps
          </a>
        </Button>
      </div>
    </section>
  );
}

export function TomorrowHomeScreen() {
  const { activeProfile, visibleEvents, visibleTasks, visibleGoals, toggleTask, loading } = useHousehold();

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const { tomorrowEvents, upcoming } = useMemo(() => {
    const sorted = [...visibleEvents].sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
    const t: typeof sorted = [];
    const u: typeof sorted = [];
    sorted.forEach((e) => {
      const d = new Date(e.start_at);
      if (isSameDay(d, tomorrow)) t.push(e);
      else if (d > tomorrow && !isSameDay(d, tomorrow)) u.push(e);
    });
    return { tomorrowEvents: t, upcoming: u.slice(0, 4) };
  }, [visibleEvents, tomorrow]);

  const tomorrowTasks = useMemo(
    () =>
      visibleTasks.filter((t) => {
        if (t.tier === "daily" || t.recurrence === "daily") return true;
        if (!t.due_at) return false;
        const due = new Date(t.due_at);
        return isSameDay(due, tomorrow);
      }),
    [visibleTasks, tomorrow],
  );
  const tomorrowGoals = useMemo(
    () => visibleGoals.filter((g) => g.tier === "daily" || g.tier === "weekly"),
    [visibleGoals],
  );

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const tomorrowDone = tomorrowTasks.filter((t) => t.done).length;

  const goalProgress = (() => {
    const set = tomorrowGoals;
    if (set.length === 0) return 0;
    const total = set.reduce((a, g) => a + Math.min(g.progress, g.target) / g.target, 0);
    return Math.round((total / set.length) * 100);
  })();

  const travelEvent = tomorrowEvents.find((e) => e.location && e.location.trim().length > 0);

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full">
      <section className="bamboo-card overflow-hidden mb-6 relative">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: activeProfile.color }} />
        <div className="p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
          <ProfileAvatar profile={activeProfile} size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl">Tomorrow, {activeProfile.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tomorrow.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
              {tomorrowEvents.length} {tomorrowEvents.length === 1 ? "event" : "events"} planned
            </p>
          </div>
          <EventDialog
            trigger={
              <Button className="rounded-full gap-1.5 self-start sm:self-center">
                <Sparkles className="h-4 w-4" /> Add event
              </Button>
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <section className="bamboo-card p-5 lg:col-span-2">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Tomorrow &amp; upcoming</h2>
            </div>
            <span className="text-xs text-muted-foreground">{tomorrowEvents.length} tomorrow</span>
          </header>

          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Tomorrow</div>
              {tomorrowEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center rounded-lg border border-dashed border-border">
                  An open day ahead. Plan something gentle.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tomorrowEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 rounded-xl p-3 hover:bg-secondary/60 transition-colors border border-transparent hover:border-border"
                    >
                      <div className="w-1 self-stretch rounded-full" style={{ background: activeProfile.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium truncate">{e.title}</span>
                          <span className="text-xs text-muted-foreground">{fmtTime(e.start_at)}</span>
                        </div>
                        {e.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {e.location}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {upcoming.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Coming up</div>
                <ul className="space-y-1.5">
                  {upcoming.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 text-sm py-1">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: activeProfile.color }} />
                      <span className="flex-1 truncate">{e.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {fmtDay(e.start_at)} · {fmtTime(e.start_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <TomorrowWeatherWidget />

        {travelEvent && travelEvent.location && (
          <div className="lg:col-span-3">
            <SmartTravelCard title={travelEvent.title} location={travelEvent.location} startAt={travelEvent.start_at} />
          </div>
        )}

        <section className="bamboo-card p-5 lg:col-span-3">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TargetIcon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Progress monitor</h2>
            </div>
            <span className="text-xs text-muted-foreground">{activeProfile.name} · tomorrow</span>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Ring
              value={pct(tomorrowDone, tomorrowTasks.length)}
              label="Tasks tomorrow"
              sublabel={`${tomorrowDone} of ${tomorrowTasks.length} done`}
            />
            <Ring
              value={goalProgress}
              label="Goal momentum"
              sublabel={`${tomorrowGoals.length} active goals`}
              color="hsl(var(--ring))"
            />
          </div>
        </section>

        <section className="bamboo-card p-5 lg:col-span-2">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Tomorrow's snapshot</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {tomorrowTasks.filter((t) => !t.done).length} open
            </span>
          </header>

          {tomorrowTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing on tomorrow's plate yet — add a daily or weekly to-do to prepare.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tomorrowTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-secondary/60 transition-colors"
                >
                  <Checkbox checked={t.done} onCheckedChange={(v) => toggleTask(t.id, Boolean(v))} />
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
                    {t.title}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                    {t.tier}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bamboo-card p-5">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TargetIcon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Goals</h2>
            </div>
            <span className="text-xs text-muted-foreground">{tomorrowGoals.length} active</span>
          </header>
          {tomorrowGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Plant a daily or weekly goal to track your momentum.
            </p>
          ) : (
            <ul className="space-y-3">
              {tomorrowGoals.map((g) => {
                const p = Math.min(100, Math.round((g.progress / g.target) * 100));
                return (
                  <li key={g.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`truncate ${g.done ? "line-through text-muted-foreground" : ""}`}>{g.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {g.progress}/{g.target}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${p}%`, background: activeProfile.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
