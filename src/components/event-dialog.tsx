import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHousehold } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { CalendarPlus, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function nowLocalRounded() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addHourLocal(local: string) {
  const d = new Date(local);
  d.setHours(d.getHours() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventDialog({
  trigger,
  initialDate,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  trigger?: React.ReactNode;
  initialDate?: Date;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const { profiles, activeProfile, familyProfile, addEvent } = useHousehold();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = setControlledOpen ?? setUncontrolled;

  const [title, setTitle] = useState("");
  const [profileId, setProfileId] = useState<string>("");
  const [start, setStart] = useState(nowLocalRounded());
  const [end, setEnd] = useState(addHourLocal(nowLocalRounded()));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const s = initialDate
        ? `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}T09:00`
        : nowLocalRounded();
      setStart(s);
      setEnd(addHourLocal(s));
      setProfileId(activeProfile?.id ?? familyProfile?.id ?? profiles[0]?.id ?? "");
    }
  }, [open, initialDate, activeProfile, familyProfile, profiles]);

  const submit = async () => {
    if (!title.trim() || !profileId || !start) return;
    setBusy(true);
    try {
      await addEvent({
        profile_id: profileId,
        title: title.trim(),
        start_at: new Date(start).toISOString(),
        end_at: end ? new Date(end).toISOString() : null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Event planted 🌱");
      setOpen(false);
      setTitle("");
      setLocation("");
      setNotes("");
    } catch {
      toast.error("Could not save event");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            New event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="ev-title" className="text-xs">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Soccer practice, dinner with Sam…"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">For</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger><SelectValue placeholder="Pick a profile" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <ProfileAvatar profile={p} size={18} />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-start" className="text-xs">Starts</Label>
              <Input
                id="ev-start"
                type="datetime-local"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (!end || new Date(end) <= new Date(e.target.value)) {
                    setEnd(addHourLocal(e.target.value));
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="ev-end" className="text-xs">Ends</Label>
              <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="ev-loc" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Location
            </Label>
            <Input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <Label htmlFor="ev-notes" className="text-xs">Notes</Label>
            <Textarea
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bring cleats, snacks…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim() || !profileId || busy} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            {busy ? "Saving…" : "Add event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
