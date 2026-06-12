import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHousehold, type Profile } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Lock, LockOpen, Settings2, Check, Palette, ChevronDown, User, Eye, Shield, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { THEMES, useTheme, type ThemeId } from "@/lib/theme-store";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ALWAYS_VISIBLE_PAGES } from "./app-sidebar";
import { useHiddenPages } from "@/lib/hidden-pages-store";
import { Checkbox } from "@/components/ui/checkbox";

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

function DefaultProfileMenu() {
  const { profiles, defaultProfileId, setDefaultProfileId, familyProfile } = useHousehold();
  const current = defaultProfileId || familyProfile?.id || "";
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div>
        <div className="text-sm font-medium">Default profile</div>
        <div className="text-xs text-muted-foreground">
          Loads this profile each time you open the app. Saved to this device for your account.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {profiles.map((p) => {
          const active = current === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDefaultProfileId(p.id);
                toast.success(`Default profile: ${p.name}`);
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border bg-background",
              )}
            >
              <ProfileAvatar profile={p} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{p.role}</div>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-background/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{title}</div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-3 pb-3 border-t border-border/60 space-y-3">{children}</div>}
    </div>
  );
}

function PagesMenu() {
  const { hidden, togglePage } = useHiddenPages();
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div>
        <div className="text-sm font-medium">Pages</div>
        <div className="text-xs text-muted-foreground">
          Hide pages from the sidebar. Their data and features stay active — they're just out of sight.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {NAV_ITEMS.map((item) => {
          const locked = ALWAYS_VISIBLE_PAGES.has(item.id);
          const isHidden = hidden.includes(item.id);
          const checkboxId = `hide-page-${item.id}`;
          return (
            <label
              key={item.id}
              htmlFor={checkboxId}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors",
                locked ? "opacity-60" : "hover:border-border hover:bg-muted/40 cursor-pointer",
              )}
            >
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0 text-sm">{item.title}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Hide page</span>
                <Checkbox
                  id={checkboxId}
                  checked={isHidden}
                  disabled={locked}
                  onCheckedChange={(v) => togglePage(item.id, !!v)}
                />
              </div>
            </label>
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
            Manage your default view, appearance, and profile security.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <SettingsSection title="Default profile" icon={User} defaultOpen>
            <DefaultProfileMenu />
          </SettingsSection>
          <SettingsSection title="View" icon={Eye}>
            <ViewMenu />
          </SettingsSection>
          <SettingsSection title="Pages" icon={LayoutGrid}>
            <PagesMenu />
          </SettingsSection>
          <SettingsSection title="Profile PINs" icon={Shield}>
            <div className="space-y-3">
              {profiles.map((p) => (
                <PinRow key={p.id} profile={p} />
              ))}
            </div>
          </SettingsSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
