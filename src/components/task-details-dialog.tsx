import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useHousehold, type TaskItem } from "@/lib/household-store";
import { toast } from "sonner";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { TaskEditDialog } from "./task-edit-dialog";

interface Props {
  task: TaskItem;
  trigger: ReactNode;
}

const OCCURRENCE_COUNT: Record<string, number> = {
  daily: 30,
  weekly: 12,
  monthly: 12,
  quarterly: 4,
  yearly: 3,
};

function addInterval(date: Date, rec: string, i: number): Date {
  const d = new Date(date);
  if (rec === "daily") d.setDate(d.getDate() + i);
  else if (rec === "weekly") d.setDate(d.getDate() + i * 7);
  else if (rec === "monthly") d.setMonth(d.getMonth() + i);
  else if (rec === "quarterly") d.setMonth(d.getMonth() + i * 3);
  else if (rec === "yearly") d.setFullYear(d.getFullYear() + i);
  return d;
}

export function TaskDetailsDialog({ task, trigger }: Props) {
  const { addEvent, profiles, deleteTask } = useHousehold();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [scope, setScope] = useState<"once" | "all">("once");
  const [saving, setSaving] = useState(false);

  const isRecurring = task.recurrence && task.recurrence !== "none";
  const profile = profiles.find((p) => p.id === task.profile_id);

  const submit = async () => {
    if (!time) {
      toast.error("Pick a time");
      return;
    }
    setSaving(true);
    try {
      const [hh, mm] = time.split(":").map(Number);
      const base = task.due_at ? new Date(task.due_at) : new Date();
      base.setHours(hh, mm, 0, 0);

      const count = isRecurring && scope === "all" ? (OCCURRENCE_COUNT[task.recurrence] ?? 1) : 1;

      for (let i = 0; i < count; i++) {
        const start = addInterval(base, task.recurrence, i);
        const end = new Date(start.getTime() + duration * 60_000);
        await addEvent({
          profile_ids: [task.profile_id],
          title: task.title,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          notes: `From to-do · ${duration} min`,
        });
      }
      toast.success(
        count > 1 ? `Added ${count} events to ${profile?.name ?? "calendar"}` : "Added to calendar",
      );
      setOpen(false);
    } catch (e) {
      toast.error("Couldn't add to calendar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Task details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{task.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {profile?.name ?? "Unassigned"} ·{" "}
              {isRecurring ? `repeats ${task.recurrence}` : "one-time"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-time">Time</Label>
              <Input
                id="task-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-duration">Duration (min)</Label>
              <Input
                id="task-duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 30))}
              />
            </div>
          </div>

          {isRecurring && (
            <div className="space-y-2">
              <Label>Apply to</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as "once" | "all")}>
                <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                  <RadioGroupItem value="once" id="scope-once" />
                  <Label htmlFor="scope-once" className="font-normal cursor-pointer flex-1">
                    Just this one occurrence
                  </Label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="font-normal cursor-pointer flex-1">
                    All upcoming occurrences
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <div className="flex gap-2 sm:mr-auto">
            <TaskEditDialog
              task={task}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"?`)) {
                  deleteTask(task.id);
                  setOpen(false);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Adding…" : "Add to calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
