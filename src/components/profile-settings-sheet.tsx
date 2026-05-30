import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHousehold, type Profile } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Lock, LockOpen, Settings2 } from "lucide-react";
import { toast } from "sonner";

function PinRow({ profile }: { profile: Profile }) {
  const { setProfilePin } = useHousehold();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN must be 4 digits");
      return;
    }
    setBusy(true);
    try {
      await setProfilePin(profile.id, pin);
      toast.success(`PIN set for ${profile.name}`);
      setPin("");
    } catch {
      toast.error("Could not save PIN");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await setProfilePin(profile.id, null);
      toast.success(`PIN removed from ${profile.name}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar profile={profile} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{profile.name}</div>
          <div className="text-xs text-muted-foreground capitalize flex items-center gap-1">
            {profile.pin ? (
              <>
                <Lock className="h-3 w-3" /> Protected
              </>
            ) : (
              <>
                <LockOpen className="h-3 w-3" /> Open
              </>
            )}
            · {profile.role}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder={profile.pin ? "Update 4-digit PIN" : "Set 4-digit PIN"}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <Button size="sm" onClick={save} disabled={busy || pin.length !== 4}>
          Save
        </Button>
        {profile.pin && (
          <Button size="sm" variant="ghost" onClick={clear} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProfileSettingsSheet({ trigger }: { trigger?: React.ReactNode }) {
  const { profiles } = useHousehold();
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label="Profile settings">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Profile settings</SheetTitle>
          <SheetDescription>
            Add a 4-digit PIN to a profile to require it before switching.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {profiles.map((p) => (
            <PinRow key={p.id} profile={p} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
