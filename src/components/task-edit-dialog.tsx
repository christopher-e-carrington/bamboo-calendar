import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHousehold, type TaskItem, type Recurrence, type Tier, TIERS } from "@/lib/household-store";
import { toast } from "sonner";
import { Pencil, Repeat } from "lucide-react";

interface Props {
  task: TaskItem;
  trigger: ReactNode;
}

const TIER_LABEL: Record<Tier, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function nextWeeklyDue(weekday: number): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d.toISOString();
}

function nextMonthlyDue(dayOfMonth: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 9, 0, 0, 0);
  if (d <= now) d.setMonth(d.getMonth() + 1);
  if (d.getDate() !== dayOfMonth) d.setDate(0);
  return d.toISOString();
}

export function TaskEditDialog({ task, trigger }: Props) {
  const { updateTask } = useHousehold();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [tier, setTier] = useState<Tier>(task.tier);
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);
  const [weekday, setWeekday] = useState<number>(
    task.due_at ? new Date(task.due_at).getDay() : new Date().getDay()
  );
  const [monthDay, setMonthDay] = useState<number>(
    task.due_at ? new Date(task.due_at).getDate() : new Date().getDate()
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      let due_at: string | null = task.due_at ?? null;
      if (recurrence === "weekly") due_at = nextWeeklyDue(weekday);
      else if (recurrence === "monthly" || recurrence === "quarterly" || recurrence === "yearly")
        due_at = nextMonthlyDue(monthDay);
      else if (recurrence === "daily") due_at = null;
      else if (recurrence === "none") due_at = null;

      await updateTask(task.id, {
        title: title.trim(),
        tier,
        recurrence,
        due_at,
      });
      setOpen(false);
      toast.success("Task updated");
    } catch {
      toast.error("Couldn't update task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
                <SelectTrigger>
                  <div className="flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {recurrence === "weekly" && (
            <div className="space-y-1.5">
              <Label>Day of week</Label>
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(recurrence === "monthly" || recurrence === "quarterly" || recurrence === "yearly") && (
            <div className="space-y-1.5">
              <Label>Day of month</Label>
              <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
