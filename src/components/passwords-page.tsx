import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household-store";
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
import { Copy, Eye, EyeOff, KeyRound, Plus, Search, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface PasswordRow {
  id: string;
  site_name: string;
  url: string | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  created_at: string;
}

const PwSchema = z.object({
  site_name: z.string().trim().min(1, "Name is required").max(150),
  url: z.string().trim().max(500).optional().or(z.literal("")),
  username: z.string().trim().max(255).optional().or(z.literal("")),
  password: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormState = z.infer<typeof PwSchema>;
const emptyForm: FormState = { site_name: "", url: "", username: "", password: "", notes: "" };

export function PasswordsPage() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PasswordRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const pwQ = useQuery({
    queryKey: ["passwords", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<PasswordRow[]> => {
      const { data, error } = await supabase
        .from("passwords")
        .select("*")
        .eq("owner_id", householdId)
        .order("site_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PasswordRow[];
    },
  });

  const removeM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("passwords").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["passwords", householdId] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (row: PasswordRow) => {
    setEditing(row);
    setForm({
      site_name: row.site_name,
      url: row.url ?? "",
      username: row.username ?? "",
      password: row.password ?? "",
      notes: row.notes ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    const parsed = PwSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        site_name: parsed.data.site_name,
        url: parsed.data.url || null,
        username: parsed.data.username || null,
        password: parsed.data.password || null,
        notes: parsed.data.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("passwords").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Password updated");
      } else {
        const { error } = await supabase
          .from("passwords")
          .insert({ owner_id: householdId, ...payload });
        if (error) throw error;
        toast.success("Password saved 🔒");
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["passwords", householdId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string | null, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const rows = pwQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      [p.site_name, p.url, p.username, p.notes]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Passwords</h1>
          <p className="text-sm text-muted-foreground">
            Websites, Wi-Fi, and anything else worth remembering.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditing(null);
              setForm(emptyForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 self-start sm:self-auto" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add password
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit password" : "New password"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={form.site_name}
                  onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                  placeholder="Website, Wi-Fi, safe code…"
                />
              </div>
              <div>
                <Label htmlFor="p-url">URL (optional)</Label>
                <Input
                  id="p-url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label htmlFor="p-user">Username (optional)</Label>
                <Input
                  id="p-user"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-pass">Password (optional)</Label>
                <Input
                  id="p-pass"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-notes">Notes (optional)</Label>
                <Textarea
                  id="p-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search passwords…"
          className="pl-9"
        />
      </div>

      {pwQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search ? "No passwords match your search." : "No passwords yet — add your first one."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const isShown = !!shown[p.id];
            return (
              <li key={p.id} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => openEdit(p)}
                      className="font-medium hover:underline text-left truncate"
                    >
                      {p.site_name}
                    </button>
                    {p.url && (
                      <a
                        href={p.url.startsWith("http") ? p.url : `https://${p.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground inline-flex items-center gap-0.5 hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{p.url}</span>
                      </a>
                    )}
                  </div>
                  {p.username && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs w-16">Username</span>
                      <span className="truncate flex-1">{p.username}</span>
                      <button
                        onClick={() => copy(p.username, "Username")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {p.password && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs w-16">Password</span>
                      <span className="truncate flex-1 font-mono">
                        {isShown ? p.password : "•".repeat(Math.min(p.password.length, 12))}
                      </span>
                      <button
                        onClick={() => setShown((s) => ({ ...s, [p.id]: !s[p.id] }))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isShown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => copy(p.password, "Password")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {p.notes && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1">
                      {p.notes}
                    </p>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete password?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the entry for “{p.site_name}”.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeM.mutate(p.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
