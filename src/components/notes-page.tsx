import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const notesQ = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("notes" as never)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Note[];
    },
  });

  const addM = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("notes" as never)
        .insert({ owner_id: user.id, content } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["notes", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't add note"),
  });

  const updateM = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("notes" as never)
        .update({ content } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", user?.id] }),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", user?.id] });
      toast.success("Note deleted");
    },
  });

  const addNote = () => {
    const v = draft.trim();
    if (!v) return;
    addM.mutate(v);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="font-display text-2xl flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-primary" /> Notes
        </h1>
        <p className="text-sm text-muted-foreground">Jot things down quickly.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-3 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a new note…"
          rows={3}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              addNote();
            }
          }}
        />
        <div className="flex justify-end">
          <Button onClick={addNote} disabled={!draft.trim() || addM.isPending} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add note
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        {notesQ.isLoading ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">Loading…</p>
        ) : (notesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            No notes yet. Add your first above.
          </p>
        ) : (
          (notesQ.data ?? []).map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onSave={(content) => updateM.mutate({ id: n.id, content })}
              onDelete={() => deleteM.mutate(n.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function NoteCard({
  note,
  onSave,
  onDelete,
}: {
  note: Note;
  onSave: (content: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(note.content);
  const dirty = value !== note.content;

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.min(8, Math.max(2, value.split("\n").length))}
        className="resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {new Date(note.updated_at).toLocaleString()}
        </span>
        <div className="flex gap-1">
          {dirty && (
            <Button size="sm" variant="outline" onClick={() => onSave(value)}>
              Save
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this note?")) onDelete();
            }}
            aria-label="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
