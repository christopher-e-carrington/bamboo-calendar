import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WeatherKind = "sun" | "cloudSun" | "cloud" | "rain" | "snow" | "storm" | "fog";

export interface WeatherPayload {
  location: string;
  today: {
    kind: WeatherKind;
    description: string;
    temp: number;
    hi: number;
    lo: number;
    wind: number;
    humidity: number;
  };
  forecast: Array<{ day: string; kind: WeatherKind; hi: number; lo: number }>;
}

function mapOwm(id: number, icon?: string): WeatherKind {
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "fog";
  if (id === 800) return "sun";
  if (id === 801 || id === 802) return "cloudSun";
  if (id >= 803) return "cloud";
  return icon?.includes("d") ? "sun" : "cloud";
}

function dayLabel(date: Date, offset: number) {
  if (offset === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export const getWeather = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) throw new Error("OPENWEATHER_API_KEY is not configured");

    const base = "https://api.openweathermap.org/data/2.5";
    const qs = `lat=${data.lat}&lon=${data.lon}&units=imperial&appid=${key}`;

    const [curRes, fcRes] = await Promise.all([
      fetch(`${base}/weather?${qs}`),
      fetch(`${base}/forecast?${qs}`),
    ]);
    if (!curRes.ok) throw new Error(`Weather API error: ${curRes.status}`);
    if (!fcRes.ok) throw new Error(`Forecast API error: ${fcRes.status}`);

    const cur = (await curRes.json()) as {
      name: string;
      weather: Array<{ id: number; icon: string; description: string }>;
      main: { temp: number; temp_max: number; temp_min: number; humidity: number };
      wind: { speed: number };
    };
    const fc = (await fcRes.json()) as {
      list: Array<{
        dt: number;
        main: { temp_max: number; temp_min: number };
        weather: Array<{ id: number; icon: string }>;
      }>;
    };

    // Group forecast entries by local day, take next 3 days (excluding today)
    const today = new Date().toISOString().slice(0, 10);
    const byDay = new Map<string, { hi: number; lo: number; ids: number[]; icons: string[]; date: Date }>();
    for (const entry of fc.list) {
      const d = new Date(entry.dt * 1000);
      const key = d.toISOString().slice(0, 10);
      if (key === today) continue;
      const slot = byDay.get(key) ?? {
        hi: -Infinity,
        lo: Infinity,
        ids: [],
        icons: [],
        date: d,
      };
      slot.hi = Math.max(slot.hi, Math.round(entry.main.temp_max));
      slot.lo = Math.min(slot.lo, Math.round(entry.main.temp_min));
      slot.ids.push(entry.weather[0]?.id ?? 800);
      slot.icons.push(entry.weather[0]?.icon ?? "01d");
      byDay.set(key, slot);
    }
    const forecast = Array.from(byDay.values())
      .slice(0, 3)
      .map((s, i) => {
        // pick middle-of-day-ish dominant condition
        const id = s.ids[Math.floor(s.ids.length / 2)] ?? 800;
        return {
          day: dayLabel(s.date, i + 1),
          kind: mapOwm(id),
          hi: s.hi,
          lo: s.lo,
        };
      });

    const w = cur.weather[0] ?? { id: 800, icon: "01d", description: "Clear" };
    const payload: WeatherPayload = {
      location: cur.name,
      today: {
        kind: mapOwm(w.id, w.icon),
        description: w.description,
        temp: Math.round(cur.main.temp),
        hi: Math.round(cur.main.temp_max),
        lo: Math.round(cur.main.temp_min),
        wind: Math.round(cur.wind.speed),
        humidity: cur.main.humidity,
      },
      forecast,
    };
    return payload;
  });
