import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHousehold, type Profile } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Lock, LockOpen, Settings2, Check, Palette } from "lucide-react";
import { toast } from "sonner";
import { THEMES, useTheme, type ThemeId } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

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

function ViewMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-medium">View</div>
          <div className="text-xs text-muted-foreground">Pick a color scheme for the app.</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTheme(t.id as ThemeId);
                toast.success(`Theme: ${t.name}`);
              }}
              className={cn(
                "text-left rounded-lg border p-2.5 transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border bg-background",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{t.name}</div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{t.description}</div>
              <div className="mt-2 flex gap-1">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </button>
          );
        })}
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
          <SheetTitle className="font-display">Settings</SheetTitle>
          <SheetDescription>
            Manage profile PINs and choose how the app looks.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <ViewMenu />
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground px-1">Profiles</div>
            {profiles.map((p) => (
              <PinRow key={p.id} profile={p} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
