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
import { Download, FileText, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface DocRow {
  id: string;
  name: string;
  doc_date: string | null;
  details: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const DocSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  doc_date: z.string().optional().or(z.literal("")),
  details: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

function formatSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentsPage() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", doc_date: "", details: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const docsQ = useQuery({
    queryKey: ["documents", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<DocRow[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("owner_id", householdId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const removeM = useMutation({
    mutationFn: async (doc: DocRow) => {
      if (doc.file_path) await supabase.storage.from("documents").remove([doc.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", householdId] }),
  });

  const submit = async () => {
    const parsed = DocSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      let file_path: string | null = null;
      let file_name: string | null = null;
      let mime_type: string | null = null;
      let size_bytes: number | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${householdId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        file_path = path;
        file_name = file.name;
        mime_type = file.type || null;
        size_bytes = file.size;
      }
      const { error } = await supabase.from("documents").insert({
        owner_id: householdId,
        name: parsed.data.name,
        doc_date: parsed.data.doc_date || null,
        details: parsed.data.details || null,
        notes: parsed.data.notes || null,
        file_path,
        file_name,
        mime_type,
        size_bytes,
      });
      if (error) throw error;
      toast.success("Document saved 🌿");
      setForm({ name: "", doc_date: "", details: "", notes: "" });
      setFile(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["documents", householdId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const download = async (doc: DocRow) => {
    if (!doc.file_path) return;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error("Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const docs = docsQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.name, d.details, d.notes, d.file_name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [docs, search]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Keep important paperwork safe and searchable.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 self-start sm:self-auto">
              <Plus className="h-4 w-4" /> Add document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New document</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="d-name">Name</Label>
                <Input
                  id="d-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Passport, Lease, Insurance…"
                />
              </div>
              <div>
                <Label htmlFor="d-date">Date</Label>
                <Input
                  id="d-date"
                  type="date"
                  value={form.doc_date}
                  onChange={(e) => setForm({ ...form, doc_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="d-details">Details</Label>
                <Textarea
                  id="d-details"
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  placeholder="What this document is or is for"
                />
              </div>
              <div>
                <Label htmlFor="d-notes">Notes</Label>
                <Textarea
                  id="d-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional information"
                />
              </div>
              <div>
                <Label htmlFor="d-file" className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> File (optional)
                </Label>
                <Input
                  id="d-file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          placeholder="Search documents…"
          className="pl-9"
        />
      </div>

      {docsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search ? "No documents match your search." : "No documents yet — add your first one."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-start gap-3"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="font-medium truncate">{d.name}</h3>
                  {d.doc_date && (
                    <span className="text-xs text-muted-foreground">{formatDate(d.doc_date)}</span>
                  )}
                </div>
                {d.details && (
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                    {d.details}
                  </p>
                )}
                {d.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap">
                    {d.notes}
                  </p>
                )}
                {d.file_name && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {d.file_name} · {formatSize(d.size_bytes)}
                  </p>
                )}
              </div>
              <div className="flex gap-1 sm:flex-col">
                {d.file_path && (
                  <Button size="sm" variant="ghost" onClick={() => download(d)} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    <span className="sm:hidden">Open</span>
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete document?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove “{d.name}” and any attached file.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeM.mutate(d)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
