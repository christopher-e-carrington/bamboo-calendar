import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHousehold } from "@/lib/household-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Trash2,
  Pencil,
  FolderKanban,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import { toast } from "sonner";

type ProjectStatus = "planning" | "active" | "on_hold" | "done";

interface ProjectRow {
  id: string;
  owner_id: string;
  profile_id: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS: Record<ProjectStatus, { label: string; tone: string }> = {
  planning: { label: "Planning", tone: "bg-amber-100 text-amber-900" },
  active: { label: "Active", tone: "bg-emerald-100 text-emerald-900" },
  on_hold: { label: "On hold", tone: "bg-slate-200 text-slate-800" },
  done: { label: "Complete", tone: "bg-primary/15 text-primary" },
};

const PALETTE = ["#7BA37A", "#A7C29A", "#C9A36B", "#E8B774", "#8FA9C4", "#B68FC4", "#D08585"];

export function ProjectsPage() {
  const { user } = useAuth();
  const { profiles, activeProfile } = useHousehold();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");

  const projectsQ = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects" as never)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
  });

  const stepsQ = useQuery({
    queryKey: ["project_steps", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<StepRow[]> => {
      const { data, error } = await supabase
        .from("project_steps" as never)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StepRow[];
    },
  });

  const stepsByProject = useMemo(() => {
    const map: Record<string, StepRow[]> = {};
    for (const s of stepsQ.data ?? []) {
      (map[s.project_id] ??= []).push(s);
    }
    return map;
  }, [stepsQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects", user?.id] });
    qc.invalidateQueries({ queryKey: ["project_steps", user?.id] });
  };

  const createM = useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      profile_id?: string | null;
      color: string;
      due_date?: string | null;
      status: ProjectStatus;
      steps: string[];
    }) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("projects" as never)
        .insert({
          owner_id: user.id,
          title: input.title,
          description: input.description ?? null,
          profile_id: input.profile_id ?? null,
          color: input.color,
          due_date: input.due_date ?? null,
          status: input.status,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const projectId = (data as unknown as { id: string }).id;
      const steps = input.steps.filter((t) => t.trim().length > 0);
      if (steps.length > 0) {
        const { error: stepErr } = await supabase
          .from("project_steps" as never)
          .insert(
            steps.map((title, i) => ({
              project_id: projectId,
              title: title.trim(),
              sort_order: i,
            })) as never,
          );
        if (stepErr) throw stepErr;
      }
      return projectId;
    },
    onSuccess: () => {
      toast.success("Project created");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't create project"),
  });

  const updateProjectM = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProjectRow> }) => {
      const { error } = await supabase
        .from("projects" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || "Couldn't update project"),
  });

  const deleteProjectM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      invalidate();
    },
  });

  const addStepM = useMutation({
    mutationFn: async ({ project_id, title }: { project_id: string; title: string }) => {
      const existing = stepsByProject[project_id] ?? [];
      const { error } = await supabase.from("project_steps" as never).insert({
        project_id,
        title,
        sort_order: existing.length,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleStepM = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("project_steps" as never)
        .update({ done, completed_at: done ? new Date().toISOString() : null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateStepM = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("project_steps" as never)
        .update({ title } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteStepM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_steps" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const findProfile = (id?: string | null) => (id ? profiles.find((p) => p.id === id) : undefined);

  const projects = (projectsQ.data ?? []).filter((p) => filter === "all" || p.status === filter);

  // Overall stats
  const allSteps = stepsQ.data ?? [];
  const totalProjects = projectsQ.data?.length ?? 0;
  const activeProjects = projectsQ.data?.filter((p) => p.status === "active").length ?? 0;
  const totalSteps = allSteps.length;
  const doneSteps = allSteps.filter((s) => s.done).length;
  const overallPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-7xl mx-auto w-full space-y-6">
      <header className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Break big things into small steps · watch progress grow
            </p>
          </div>
        </div>
        <NewProjectDialog
          defaultProfileId={activeProfile?.id ?? null}
          profiles={profiles}
          onCreate={(input) => createM.mutate(input)}
        />
      </header>

      {/* Overview */}
      <section className="bamboo-card p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Projects" value={totalProjects} accent="text-primary" />
          <Stat label="Active" value={activeProjects} accent="text-emerald-600" />
          <Stat label="Steps done" value={`${doneSteps}/${totalSteps}`} accent="text-amber-700" />
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Overall progress
            </span>
            <span>{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "planning", "on_hold", "done"] as const).map((f) => {
          const label = f === "all" ? "All" : STATUS[f].label;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/60 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Projects list */}
      {projectsQ.isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="bamboo-card p-10 text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <FolderKanban className="h-6 w-6" />
          </div>
          <p className="font-display text-lg">No projects yet</p>
          <p className="text-sm text-muted-foreground">
            Start your first project — kitchen reno, summer trip, a side hustle.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((p) => {
            const steps = stepsByProject[p.id] ?? [];
            const done = steps.filter((s) => s.done).length;
            const pct = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
            const isOpen = expanded[p.id] ?? true;
            const owner = findProfile(p.profile_id);
            return (
              <article
                key={p.id}
                className="bamboo-card overflow-hidden flex flex-col"
                style={{ borderTopColor: p.color, borderTopWidth: 4 }}
              >
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [p.id]: !isOpen }))}
                      className="flex items-start gap-2 text-left flex-1 min-w-0"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h2 className="font-display text-lg leading-tight truncate">{p.title}</h2>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {owner && <ProfileAvatar profile={owner} size={26} />}
                      <EditProjectDialog
                        project={p}
                        profiles={profiles}
                        onSave={(patch) => updateProjectM.mutate({ id: p.id, patch })}
                      />
                      <DeleteProjectButton onConfirm={() => deleteProjectM.mutate(p.id)} title={p.title} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS[p.status].tone}`}
                    >
                      {STATUS[p.status].label}
                    </span>
                    <Select
                      value={p.status}
                      onValueChange={(v) =>
                        updateProjectM.mutate({ id: p.id, patch: { status: v as ProjectStatus } })
                      }
                    >
                      <SelectTrigger className="h-7 w-[120px] text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS) as ProjectStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {STATUS[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {p.due_date && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(p.due_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {done} of {steps.length} step{steps.length === 1 ? "" : "s"}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 border-t border-border/60 pt-3 space-y-2">
                    {steps.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">
                        No steps yet — add the first one below.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {steps.map((s) => (
                          <StepRowItem
                            key={s.id}
                            step={s}
                            onToggle={(done) => toggleStepM.mutate({ id: s.id, done })}
                            onRename={(title) => updateStepM.mutate({ id: s.id, title })}
                            onDelete={() => deleteStepM.mutate(s.id)}
                          />
                        ))}
                      </ul>
                    )}
                    <AddStepInput
                      onAdd={(title) => addStepM.mutate({ project_id: p.id, title })}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="text-center">
      <div className={`font-display text-2xl ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function StepRowItem({
  step,
  onToggle,
  onRename,
  onDelete,
}: {
  step: StepRow;
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(step.title);

  const commit = () => {
    const v = value.trim();
    if (v && v !== step.title) onRename(v);
    setEditing(false);
  };

  return (
    <li className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60 transition-colors">
      <Checkbox checked={step.done} onCheckedChange={(v) => onToggle(Boolean(v))} />
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(step.title);
              setEditing(false);
            }
          }}
          className="h-7 text-sm flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 text-left text-sm ${step.done ? "line-through text-muted-foreground" : ""}`}
        >
          {step.title}
        </button>
      )}
      {step.done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      )}
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        aria-label="Delete step"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function AddStepInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        onAdd(v);
        setValue("");
      }}
      className="flex items-center gap-2 pt-1"
    >
      <Plus className="h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a step…"
        className="h-8 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={!value.trim()}>
        Add
      </Button>
    </form>
  );
}

function NewProjectDialog({
  defaultProfileId,
  profiles,
  onCreate,
}: {
  defaultProfileId: string | null;
  profiles: ReturnType<typeof useHousehold>["profiles"];
  onCreate: (input: {
    title: string;
    description?: string;
    profile_id: string | null;
    color: string;
    due_date: string | null;
    status: ProjectStatus;
    steps: string[];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [profileId, setProfileId] = useState<string | null>(defaultProfileId);
  const [color, setColor] = useState(PALETTE[0]);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [stepsText, setStepsText] = useState("");

  const reset = () => {
    setTitle("");
    setDescription("");
    setProfileId(defaultProfileId);
    setColor(PALETTE[0]);
    setDueDate("");
    setStatus("active");
    setStepsText("");
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error("Give your project a title");
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      profile_id: profileId,
      color,
      due_date: dueDate || null,
      status,
      steps: stepsText.split("\n"),
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" /> New project
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kitchen refresh"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about the goal of this project"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assign to</label>
              <Select value={profileId ?? "none"} onValueChange={(v) => setProfileId(v === "none" ? null : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nickname || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Target date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              First steps (one per line)
            </label>
            <Textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={"Sketch the layout\nMeasure cabinets\nPick a paint color"}
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground">
              You can keep adding and editing steps after creating the project.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({
  project,
  profiles,
  onSave,
}: {
  project: ProjectRow;
  profiles: ReturnType<typeof useHousehold>["profiles"];
  onSave: (patch: Partial<ProjectRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [profileId, setProfileId] = useState<string | null>(project.profile_id);
  const [color, setColor] = useState(project.color);
  const [dueDate, setDueDate] = useState(project.due_date ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setTitle(project.title);
          setDescription(project.description ?? "");
          setProfileId(project.profile_id);
          setColor(project.color);
          setDueDate(project.due_date ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Edit project"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={profileId ?? "none"} onValueChange={(v) => setProfileId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nickname || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${
                  color === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) {
                toast.error("Title required");
                return;
              }
              onSave({
                title: title.trim(),
                description: description.trim() || null,
                profile_id: profileId,
                color,
                due_date: dueDate || null,
              });
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectButton({ onConfirm, title }: { onConfirm: () => void; title: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="Delete project"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the project and all of its steps. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
