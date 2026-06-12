import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useHousehold } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Plus, Trash2, UserPlus, Mail } from "lucide-react";
import { toast } from "sonner";
import { HouseholdInvites } from "./household-invites";

const PALETTE = ["#7BA37A", "#A7C29A", "#C9A36B", "#E8B774", "#9CB89A", "#B58A6B", "#8FB4C8", "#D49AA6"];

export function ManageProfilesDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { profiles, familyProfile, addProfile, updateProfile, removeProfile } = useHousehold();
  const [open, setOpen] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProfileRole>("kid");
  const [color, setColor] = useState(PALETTE[3]);
  const [birthday, setBirthday] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addProfile({ name, role, color, birthday: birthday || null });
      toast.success(`${name} added`);
      setName("");
      setBirthday("");
    } catch (e) {
      toast.error("Could not add profile");
    } finally {
      setBusy(false);
    }
  };

  const saveBirthday = async (id: string, value: string) => {
    try {
      await updateProfile(id, { birthday: value || null });
      toast.success("Birthday saved");
    } catch {
      toast.error("Could not save birthday");
    }
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Remove ${label}? Their events and tasks will also be deleted.`)) return;
    try {
      await removeProfile(id);
      toast.success(`${label} removed`);
    } catch {
      toast.error("Could not remove profile");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Manage
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Household profiles</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
          {profiles.map((p) => {
            const isHousehold = p.id === familyProfile?.id;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-2">
                <ProfileAvatar profile={p} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {isHousehold ? "shared · combined view" : p.role}
                  </div>
                  {!isHousehold && (
                    <div className="pt-1.5 flex items-center gap-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Birthday</Label>
                      <Input
                        type="date"
                        defaultValue={p.birthday ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if ((p.birthday ?? "") !== v) saveBirthday(p.id, v);
                        }}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isHousehold}
                  onClick={() => remove(p.id, p.name)}
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setShowInvites((v) => !v)}
          >
            <Mail className="h-4 w-4" />
            {showInvites ? "Hide invites" : "Invite new user"}
          </Button>
          {showInvites && (
            <div className="pt-3">
              <HouseholdInvites />
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Add profile</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grandma" />
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ProfileRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="kid">Kid</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{
                      background: c,
                      borderColor: color === c ? "var(--foreground)" : "transparent",
                    }}
                    aria-label={`Pick color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Birthday (optional)</Label>
              <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
          </div>
          <Button onClick={submit} disabled={!name.trim() || busy} className="w-full gap-1.5">
            <Plus className="h-4 w-4" /> Add profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
