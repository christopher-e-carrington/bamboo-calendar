import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookHeart, Plus, Search, MapPin, Star, Trash2, Pencil, X, Calendar as CalendarIcon,
  Smile, Meh, Frown, Heart, Sun, Cloud, CloudRain, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface JournalEntry {
  id: string;
  owner_id: string;
  profile_id: string | null;
  title: string | null;
  content: string;
  mood: string | null;
  location: string | null;
  tags: string[];
  entry_date: string;
  weather: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

const MOODS = [
  { id: "great", label: "Great", icon: Heart, color: "text-rose-500" },
  { id: "good", label: "Good", icon: Smile, color: "text-emerald-500" },
  { id: "okay", label: "Okay", icon: Meh, color: "text-amber-500" },
  { id: "low", label: "Low", icon: Frown, color: "text-sky-500" },
  { id: "energized", label: "Energized", icon: Zap, color: "text-violet-500" },
];

const WEATHERS = [
  { id: "sunny", label: "Sunny", icon: Sun },
  { id: "cloudy", label: "Cloudy", icon: Cloud },
  { id: "rainy", label: "Rainy", icon: CloudRain },
  { id: "stormy", label: "Stormy", icon: Zap },
];

const moodMeta = (id: string | null) => MOODS.find((m) => m.id === id);
const weatherMeta = (id: string | null) => WEATHERS.find((w) => w.id === id);

type Filter = "all" | "favorites";

export function JournalPage() {
  const { householdId, activeProfileId } = useHousehold();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState<string>("any");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const entriesQ = useQuery({
    queryKey: ["journal", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<JournalEntry[]> => {
      const { data, error } = await supabase
        .from("journal_entries" as never)
        .select("*")
        .eq("owner_id", householdId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as JournalEntry[];
    },
  });

  const entries = entriesQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const loc = locationFilter.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return entries.filter((e) => {
      if (filter === "favorites" && !e.is_favorite) return false;
      if (moodFilter !== "any" && e.mood !== moodFilter) return false;
      const ts = new Date(e.entry_date).getTime();
      if (from !== null && ts < from) return false;
      if (to !== null && ts > to) return false;
      if (loc && !(e.location ?? "").toLowerCase().includes(loc)) return false;
      if (q) {
        const hay = [
          e.title ?? "",
          e.content ?? "",
          e.location ?? "",
          (e.tags ?? []).join(" "),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, dateFrom, dateTo, locationFilter, moodFilter, filter]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => (e.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [entries]);

  const upsertM = useMutation({
    mutationFn: async (payload: Partial<JournalEntry> & { id?: string }) => {
      if (!householdId) throw new Error("No household");
      const row = {
        owner_id: householdId,
        profile_id: payload.profile_id ?? activeProfileId ?? null,
        title: payload.title ?? null,
        content: payload.content ?? "",
        mood: payload.mood ?? null,
        location: payload.location ?? null,
        tags: payload.tags ?? [],
        entry_date: payload.entry_date ?? new Date().toISOString(),
        weather: payload.weather ?? null,
        is_favorite: payload.is_favorite ?? false,
      };
      if (payload.id) {
        const { error } = await supabase
          .from("journal_entries" as never)
          .update(row as never)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("journal_entries" as never).insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal", householdId] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save entry"),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal", householdId] });
      toast.success("Entry deleted");
    },
  });

  const favM = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase
        .from("journal_entries" as never)
        .update({ is_favorite: val } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal", householdId] }),
  });

  const clearFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo(""); setLocationFilter(""); setMoodFilter("any"); setFilter("all");
  };

  const hasFilters = search || dateFrom || dateTo || locationFilter || moodFilter !== "any" || filter !== "all";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2">
            <BookHeart className="h-5 w-5 text-primary" /> Journal
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} — capture your day, thoughts, and moments.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New entry
        </Button>
      </header>

      {/* Search + filters */}
      <section className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by keyword, title, tag…"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Location</label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Anywhere"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Mood</label>
            <Select value={moodFilter} onValueChange={setMoodFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any mood</SelectItem>
                {MOODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >All</Button>
          <Button
            size="sm"
            variant={filter === "favorites" ? "default" : "outline"}
            onClick={() => setFilter("favorites")}
            className="gap-1"
          ><Star className="h-3.5 w-3.5" /> Favorites</Button>
          {allTags.length > 0 && allTags.slice(0, 8).map((t) => (
            <Badge
              key={t}
              variant={search === `#${t}` ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setSearch(search === `#${t}` ? "" : `#${t}`)}
            >#{t}</Badge>
          ))}
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </section>

      {/* Entries */}
      <section className="space-y-3">
        {entriesQ.isLoading ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/30">
            <BookHeart className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {entries.length === 0 ? "Your journal is empty. Start with your first entry." : "No entries match your filters."}
            </p>
          </div>
        ) : (
          filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onEdit={() => setEditing(e)}
              onDelete={() => {
                if (confirm("Delete this journal entry?")) deleteM.mutate(e.id);
              }}
              onToggleFav={() => favM.mutate({ id: e.id, val: !e.is_favorite })}
            />
          ))
        )}
      </section>

      {(creating || editing) && (
        <EntryDialog
          entry={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => upsertM.mutate({ ...payload, id: editing?.id })}
          saving={upsertM.isPending}
        />
      )}
    </div>
  );
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
  onToggleFav,
}: {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const preview = entry.content.length > 220 && !expanded
    ? entry.content.slice(0, 220) + "…"
    : entry.content;

  return (
    <article className="rounded-2xl border border-border bg-card/70 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.title && <h3 className="font-medium truncate">{entry.title}</h3>}
            {mood && <mood.icon className={`h-4 w-4 ${mood.color}`} />}
            {weather && <weather.icon className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(entry.entry_date), "PPP")}
            </span>
            {entry.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {entry.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={onToggleFav} aria-label="Favorite">
            <Star className={`h-4 w-4 ${entry.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {entry.content && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {preview}
          {entry.content.length > 220 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="ml-1 text-primary hover:underline text-xs"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </p>
      )}

      {entry.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {entry.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
          ))}
        </div>
      )}
    </article>
  );
}

function EntryDialog({
  entry,
  onClose,
  onSave,
  saving,
}: {
  entry: JournalEntry | null;
  onClose: () => void;
  onSave: (payload: Partial<JournalEntry>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [mood, setMood] = useState<string | null>(entry?.mood ?? null);
  const [weather, setWeather] = useState<string | null>(entry?.weather ?? null);
  const [location, setLocation] = useState(entry?.location ?? "");
  const [tagsInput, setTagsInput] = useState((entry?.tags ?? []).join(", "));
  const [entryDate, setEntryDate] = useState(
    entry ? format(new Date(entry.entry_date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );

  const submit = () => {
    if (!content.trim() && !title.trim()) {
      toast.error("Add a title or some content first");
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);
    onSave({
      title: title.trim() || null,
      content,
      mood,
      weather,
      location: location.trim() || null,
      tags,
      entry_date: new Date(entryDate).toISOString(),
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "New journal entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="text-base font-medium"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={10}
            className="resize-y"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date & time</label>
              <Input
                type="datetime-local"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Location</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Home, Central Park"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mood</label>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(mood === m.id ? null : m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition ${
                    mood === m.id ? "border-primary bg-primary/10" : "border-border bg-background"
                  }`}
                >
                  <m.icon className={`h-3.5 w-3.5 ${m.color}`} /> {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Weather</label>
            <div className="flex gap-2 flex-wrap">
              {WEATHERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWeather(weather === w.id ? null : w.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition ${
                    weather === w.id ? "border-primary bg-primary/10" : "border-border bg-background"
                  }`}
                >
                  <w.icon className="h-3.5 w-3.5" /> {w.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="gratitude, travel, reflection"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
