import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold, type Recurrence, type Tier } from "@/lib/household-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProfileAvatar } from "./profile-avatar";
import { Repeat, Plus, Trash2, Sparkles, Sun, Moon, Dumbbell, PlayCircle, X } from "lucide-react";
import { toast } from "sonner";

interface Routine {
  id: string;
  owner_id: string;
  profile_id: string;
  name: string;
  recurrence: Recurrence;
  tier: Tier;
  items: string[];
  notes: string | null;
  loaded_at: string | null;
}

const HABIT_IDEAS = [
  { icon: Sun, title: "Morning kickoff", items: ["Make bed", "Drink water", "5 min stretch", "Plan top 3 priorities"] },
  { icon: Moon, title: "Evening wind-down", items: ["Tidy main room", "Prep tomorrow's outfit", "Read 10 minutes", "Lights out by 10:30"] },
  { icon: Dumbbell, title: "Move every day", items: ["10 min walk", "Strength circuit", "Hydrate"] },
];

function nextDueFor(rec: Recurrence): string | null {
  if (rec === "none") return null;
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (d <= new Date()) {
    // keep today's 9am if in the past, that's fine — tasks page will show as due today
  }
  return d.toISOString();
}

export function RoutinesPage() {
  const { householdId, profiles, activeProfile, familyProfile, addTask, loading } = useHousehold();
  const qc = useQueryClient();

  const routinesQ = useQuery({
    queryKey: ["routines", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Routine[]> => {
      const { data, error } = await (supabase as any)
        .from("routines")
        .select("*")
        .eq("owner_id", householdId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        items: Array.isArray(r.items) ? r.items : [],
      })) as Routine[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: Omit<Routine, "id" | "owner_id">) => {
      const { error } = await (supabase as any).from("routines").insert({
        owner_id: householdId,
        profile_id: input.profile_id,
        name: input.name,
        recurrence: input.recurrence,
        tier: input.tier,
        items: input.items,
        notes: input.notes,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["routines", householdId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["routines", householdId] }),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("daily");
  const [profileId, setProfileId] = useState<string>("");
  const [items, setItems] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");

  const resetForm = (prefill?: { name?: string; items?: string[] }) => {
    setName(prefill?.name ?? "");
    setItems(prefill?.items ?? [""]);
    setRecurrence("daily");
    setProfileId(activeProfile?.id ?? familyProfile?.id ?? "");
    setNotes("");
  };

  const openWithPrefill = (prefill?: { name?: string; items?: string[] }) => {
    resetForm(prefill);
    setOpen(true);
  };

  if (loading || !activeProfile) {
    return <div className="px-5 py-10 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  const handleSave = async () => {
    const cleanItems = items.map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || cleanItems.length === 0) {
      toast.error("Add a name and at least one task");
      return;
    }
    const tier: Tier = recurrence === "none" ? "daily" : (recurrence as Tier);
    try {
      await createMut.mutateAsync({
        profile_id: profileId || activeProfile.id,
        name: name.trim(),
        recurrence,
        tier,
        items: cleanItems,
        notes: notes.trim() || null,
      });
      toast.success("Routine created");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save routine");
    }
  };

  const loadIntoTodos = async (r: Routine) => {
    try {
      const tier: Tier = r.recurrence === "none" ? "daily" : (r.tier ?? "daily");
      for (const title of r.items) {
        await addTask({
          profile_id: r.profile_id,
          title,
          tier,
          recurrence: r.recurrence,
          due_at: nextDueFor(r.recurrence),
        });
      }
      toast.success(`Added ${r.items.length} to-dos from "${r.name}"`);
    } catch {
      toast.error("Couldn't load routine into to-dos");
    }
  };

  const routines = routinesQ.data ?? [];

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Repeat className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl sm:text-3xl">Routines</h1>
          <p className="text-sm text-muted-foreground">
            Build daily blocks that grow into good habits. Small, repeatable, calming.
          </p>
        </div>
        <Button onClick={() => openWithPrefill()} className="gap-1.5">
          <Plus className="h-4 w-4" /> New routine
        </Button>
      </header>

      <section className="bamboo-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg">Habit starters</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Stack a couple of these into your day. Daily routines compound — even three tiny actions repeated build momentum.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HABIT_IDEAS.map((idea) => (
            <button
              key={idea.title}
              onClick={() => openWithPrefill({ name: idea.title, items: [...idea.items, ""] })}
              className="text-left rounded-xl border border-border bg-secondary/30 p-3 hover:bg-secondary/60 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <idea.icon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{idea.title}</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {idea.items.map((i) => (
                  <li key={i}>· {i}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </section>

      <section className="bamboo-card p-4 sm:p-5">
        <h2 className="font-display text-lg mb-3">Your routines</h2>
        {routines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No routines yet. Pick a habit starter above, or create your own.
          </p>
        ) : (
          <ul className="space-y-3">
            {routines.map((r) => {
              const p = profiles.find((x) => x.id === r.profile_id);
              return (
                <li key={r.id} className="rounded-xl border border-border p-3 sm:p-4 bg-background/40">
                  <div className="flex items-start gap-3">
                    {p && <ProfileAvatar profile={p} size={28} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.name}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Repeat className="h-2.5 w-2.5" /> {r.recurrence}
                        </span>
                        <span className="text-xs text-muted-foreground">{r.items.length} tasks</span>
                      </div>
                      <ul className="mt-2 text-sm text-muted-foreground space-y-0.5">
                        {r.items.map((it, i) => (
                          <li key={i}>· {it}</li>
                        ))}
                      </ul>
                      {r.notes && <p className="mt-2 text-xs text-muted-foreground italic">{r.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button size="sm" onClick={() => loadIntoTodos(r)} className="gap-1.5">
                        <PlayCircle className="h-4 w-4" /> Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMut.mutate(r.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New routine</DialogTitle>
            <DialogDescription>
              Name your block, pick a cadence, and list the tasks. Loading it adds each task to that profile's to-dos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Routine name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning kickoff" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Repeats</label>
                <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="none">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">For</label>
                <Select value={profileId || activeProfile.id} onValueChange={setProfileId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tasks in this block</label>
              <div className="space-y-2 mt-1">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={it}
                      onChange={(e) => {
                        const copy = [...items];
                        copy[i] = e.target.value;
                        setItems(copy);
                      }}
                      placeholder={`Task ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      disabled={items.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, ""])} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add task
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes (optional)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this matters to you…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending}>Save routine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
