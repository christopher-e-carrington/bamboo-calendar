import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImagePlus, MapPin, Plus, Trash2, Clock, Calendar as CalIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export type Memory = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  memory_date: string; // YYYY-MM-DD
  memory_time: string | null; // HH:MM:SS
  location: string | null;
  photo_url: string | null;
  created_at: string;
};

const MemorySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  memory_date: z.string().min(1, "Date is required"),
  memory_time: z.string().optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
});

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MemoryFormDialog({
  trigger,
  initial,
  onSaved,
}: {
  trigger: React.ReactNode;
  initial?: Memory;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    memory_date: initial?.memory_date ?? todayISO(),
    memory_time: initial?.memory_time?.slice(0, 5) ?? "",
    location: initial?.location ?? "",
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("memory-photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("memory-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (e) {
      toast.error("Upload failed");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    const parsed = MemorySchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        owner_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        memory_date: parsed.data.memory_date,
        memory_time: parsed.data.memory_time || null,
        location: parsed.data.location || null,
        photo_url: photoUrl,
      };
      if (initial) {
        const { error } = await supabase.from("memories").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("Memory updated");
      } else {
        const { error } = await supabase.from("memories").insert(payload);
        if (error) throw error;
        toast.success("Memory saved 🌿");
      }
      setOpen(false);
      onSaved();
      if (!initial) {
        setForm({ title: "", description: "", memory_date: todayISO(), memory_time: "", location: "" });
        setPhotoUrl(null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not save memory");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit memory" : "New memory"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Photo</Label>
            <div
              className="mt-1.5 relative rounded-xl border border-dashed border-border bg-secondary/40 aspect-video grid place-items-center overflow-hidden cursor-pointer hover:bg-secondary/60 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="memory" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="text-muted-foreground text-sm flex flex-col items-center gap-1">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                  <span>{uploading ? "Uploading…" : "Tap to upload photo"}</span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                  e.target.value = "";
                }}
              />
            </div>
            {photoUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-7 text-xs text-muted-foreground"
                onClick={() => setPhotoUrl(null)}
              >
                Remove photo
              </Button>
            )}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Beach picnic"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Day</Label>
              <Input
                id="date"
                type="date"
                value={form.memory_date}
                onChange={(e) => setForm({ ...form, memory_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={form.memory_time}
                onChange={(e) => setForm({ ...form, memory_time: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Bondi Beach"
            />
          </div>

          <div>
            <Label htmlFor="desc">Notes</Label>
            <Textarea
              id="desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What made it special…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || uploading}>
            {busy ? "Saving…" : initial ? "Save" : "Add memory"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MemoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .order("memory_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Memory[];
    },
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Memory removed");
      qc.invalidateQueries({ queryKey: ["memories", user?.id] });
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories", user?.id] });

  const grouped = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of memories) {
      const key = m.memory_date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [memories]);

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Memories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capture moments with a photo, time and place.
          </p>
        </div>
        <MemoryFormDialog
          trigger={
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> New
            </Button>
          }
          onSaved={invalidate}
        />
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Loading memories…</div>
      ) : memories.length === 0 ? (
        <div className="bamboo-card p-10 text-center">
          <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No memories yet. Start by capturing today.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([month, items]) => {
            const [y, m] = month.split("-").map(Number);
            const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            });
            return (
              <section key={month}>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  {label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((mem) => (
                    <article
                      key={mem.id}
                      className="bamboo-card overflow-hidden flex flex-col group"
                    >
                      {mem.photo_url ? (
                        <div className="aspect-[4/3] bg-muted overflow-hidden">
                          <img
                            src={mem.photo_url}
                            alt={mem.title}
                            loading="lazy"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-muted grid place-items-center text-muted-foreground">
                          <ImagePlus className="h-7 w-7" />
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-medium leading-tight">{mem.title}</h3>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalIcon className="h-3 w-3" /> {formatDate(mem.memory_date)}
                          </span>
                          {mem.memory_time && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatTime(mem.memory_time)}
                            </span>
                          )}
                          {mem.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {mem.location}
                            </span>
                          )}
                        </div>
                        {mem.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                            {mem.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                          <MemoryFormDialog
                            trigger={
                              <Button size="sm" variant="ghost" className="h-8">
                                Edit
                              </Button>
                            }
                            initial={mem}
                            onSaved={invalidate}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 ml-auto text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove "{mem.title}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeMutation.mutate(mem.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
