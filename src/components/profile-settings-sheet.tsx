import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHousehold, type Profile } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { Lock, LockOpen, Settings2, Check, Palette, ChevronDown, User, Eye, Shield, LayoutGrid, Users as UsersIcon, Share2, Plus, CalendarCheck, MonitorSmartphone } from "lucide-react";
import { DISPLAYS, useDisplay, type DisplayId } from "@/lib/display-store";
import { GoogleCalendarMenu } from "./google-calendar-settings";
import { toast } from "sonner";
import { THEMES, useTheme, type ThemeId, type CustomThemeColors } from "@/lib/theme-store";
import { Trash2, Sparkles, Pencil, PanelLeft, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ALWAYS_VISIBLE_PAGES } from "./app-sidebar";
import { useHiddenPages } from "@/lib/hidden-pages-store";
import { Checkbox } from "@/components/ui/checkbox";
import { ManageProfilesDialog } from "./manage-profiles-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function NicknameRow({ profile }: { profile: Profile }) {
  const { updateProfile } = useHousehold();
  const [value, setValue] = useState(profile.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = (profile.nickname ?? "") !== value;

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(profile.id, { nickname: value.trim() || null });
      toast.success("Nickname updated");
    } catch {
      toast.error("Couldn't save nickname");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nickname (display name)"
        className="h-8 text-sm"
        maxLength={40}
      />
      <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}


function UsersMenu() {
  const { profiles, familyProfile, removeProfile } = useHousehold();
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const shareAccount = async (profile: Profile) => {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    setBusyId(profile.id);
    try {
      const token = randomToken();
      const { error } = await supabase.from("household_invitations").insert({
        household_id: user.id,
        token,
        invited_name: profile.name,
        invited_email: null,
      });
      if (error) throw error;
      const link = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success(`Invite link for ${profile.name} copied — send it to them`);
    } catch (e) {
      console.error(e);
      toast.error("Could not create share link");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await removeProfile(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
      setConfirmDelete(null);
    } catch {
      toast.error("Could not remove user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div>
        <div className="text-sm font-medium">Users</div>
        <div className="text-xs text-muted-foreground">
          Set a nickname to change what's displayed, share an account to let someone take control
          of their own profile, or remove a user from this household.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {profiles.map((p) => {
          const isShared = p.id === familyProfile?.id;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2"
            >
              <div className="flex items-center gap-3">
                <ProfileAvatar profile={p} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  {isShared && (
                    <div className="text-[11px] text-muted-foreground">Shared · combined view</div>
                  )}
                </div>
                {!isShared && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busyId === p.id}
                      onClick={() => shareAccount(p)}
                    >
                      {busyId === p.id ? (
                        <>Sharing…</>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" /> Share
                        </>
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(p)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <NicknameRow profile={p} />
            </div>
          );
        })}
      </div>
      <ManageProfilesDialog
        trigger={
          <Button variant="default" size="sm" className="w-full gap-1.5">
            <Plus className="h-4 w-4" /> Add new user
          </Button>
        }
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {confirmDelete?.name} from your household, along with
              their events, tasks, and other data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Yes, delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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

const MAX_BG_BYTES = 1_500_000; // ~1.5 MB after downscale

async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not load image"));
    i.src = dataUrl;
  });
  const MAX_DIM = 1920;
  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > MAX_BG_BYTES && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

function ViewMenu() {
  const {
    theme,
    setTheme,
    defaultTheme,
    setDefaultTheme,
    customThemes,
    saveCustomTheme,
    updateCustomTheme,
    deleteCustomTheme,
  } = useTheme();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const DEFAULT_COLORS: CustomThemeColors = {
    background: "#f6f1e4",
    foreground: "#2a2a22",
    card: "#fbf7ec",
    primary: "#7a9a72",
    accent: "#c2a878",
    border: "#e2dac6",
  };
  const [colors, setColors] = useState<CustomThemeColors>(DEFAULT_COLORS);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [cardOpacity, setCardOpacity] = useState<number>(1);

  // Per-view sidebar customization
  const [sidebarEnabled, setSidebarEnabled] = useState(false);
  const [sidebarColor, setSidebarColor] = useState<string>("#f6f1e4");
  const [sidebarOpacity, setSidebarOpacity] = useState<number>(1);

  const COLOR_FIELDS: { key: keyof CustomThemeColors; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "foreground", label: "Text" },
    { key: "card", label: "Card" },
    { key: "primary", label: "Primary" },
    { key: "accent", label: "Accent" },
    { key: "border", label: "Border" },
  ];

  const resetForm = () => {
    setCreating(false);
    setEditingId(null);
    setName("");
    setColors(DEFAULT_COLORS);
    setBackgroundImage(null);
    setCardOpacity(1);
    setSidebarEnabled(false);
    setSidebarColor("#f6f1e4");
    setSidebarOpacity(1);
  };

  const startEdit = (c: (typeof customThemes)[number]) => {
    setEditingId(c.id);
    setCreating(true);
    setName(c.name);
    setColors(c.colors);
    setBackgroundImage(c.backgroundImage ?? null);
    setCardOpacity(c.cardOpacity ?? 1);
    const hasSidebar = !!c.sidebarColor;
    setSidebarEnabled(hasSidebar);
    setSidebarColor(c.sidebarColor ?? c.colors.background);
    setSidebarOpacity(typeof c.sidebarOpacity === "number" ? c.sidebarOpacity : 1);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give your theme a name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        colors,
        backgroundImage,
        cardOpacity,
        sidebarColor: sidebarEnabled ? sidebarColor : null,
        sidebarOpacity: sidebarEnabled ? sidebarOpacity : null,
      };
      const result = editingId
        ? await updateCustomTheme(editingId, payload)
        : await saveCustomTheme(payload);
      if (!result) {
        toast.error(editingId ? "Couldn't update theme" : "Couldn't save theme");
        return;
      }
      toast.success(editingId ? `Updated ${trimmed}` : `Saved theme: ${trimmed}`);
      resetForm();
    } finally {
      setSaving(false);
    }
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      setBackgroundImage(dataUrl);
      toast.success("Background image added");
    } catch {
      toast.error("Couldn't load that image");
    }
  };

  const cardPreview = (() => {
    const h = colors.card.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${cardOpacity})`;
  })();

  const allOptions = [
    ...THEMES.map((t) => ({
      id: t.id as string,
      name: t.name,
      description: t.description,
      swatches: [...t.swatches] as string[],
      custom: false as const,
      themeRef: null as null,
    })),
    ...customThemes.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.backgroundImage ? "Custom · with background image" : "Custom · shared with household",
      swatches: [c.colors.background, c.colors.primary, c.colors.accent, c.colors.foreground],
      custom: true as const,
      themeRef: c,
    })),
  ];

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-medium">View</div>
          <div className="text-xs text-muted-foreground">Pick a color scheme — tap the star to make one the default on this device.</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {allOptions.map((t) => {
          const active = theme === t.id;
          const isDefault = defaultTheme === t.id;
          return (
            <div
              key={t.id}
              className={cn(
                "relative text-left rounded-lg border p-2.5 transition-colors hover:border-primary/60",
                active ? "border-primary bg-primary/5" : "border-border bg-background",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setTheme(t.id as ThemeId);
                  toast.success(`Theme: ${t.name}`);
                }}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate pr-16 flex items-center gap-1.5">
                    {t.name}
                    {isDefault && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-primary/80 border border-primary/30 rounded px-1 py-px">
                        Default
                      </span>
                    )}
                  </div>
                  {active && <Check className="h-4 w-4 text-primary shrink-0" />}
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
              <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                <button
                  type="button"
                  aria-label={isDefault ? `Unset ${t.name} as default on this device` : `Set ${t.name} as default on this device`}
                  title={isDefault ? "Default on this device" : "Set as default on this device"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDefault) {
                      setDefaultTheme(null);
                      toast.success("Default cleared on this device");
                    } else {
                      setDefaultTheme(t.id as ThemeId);
                      toast.success(`Default on this device: ${t.name}`);
                    }
                  }}
                  className={cn(
                    "h-6 w-6 rounded-md flex items-center justify-center hover:bg-primary/10",
                    isDefault ? "text-primary" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} />
                </button>
                {t.custom && t.themeRef && (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${t.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(t.themeRef!);
                      }}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${t.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${t.name}"? This will remove it for everyone in your household.`)) {
                          if (defaultTheme === t.id) setDefaultTheme(null);
                          deleteCustomTheme(t.id);
                          toast.success(`Deleted ${t.name}`);
                        }
                      }}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!creating ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => {
            resetForm();
            setCreating(true);
          }}
        >
          <Sparkles className="h-4 w-4" /> Create custom scheme
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="custom-theme-name" className="text-xs">
              Theme name
            </Label>
            <Input
              id="custom-theme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunset"
              maxLength={40}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`color-${f.key}`} className="text-[11px] text-muted-foreground">
                  {f.label}
                </Label>
                <div className="flex items-center gap-2 rounded-md border border-input px-2 py-1">
                  <input
                    id={`color-${f.key}`}
                    type="color"
                    value={colors[f.key]}
                    onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value }))}
                    className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-xs font-mono uppercase text-muted-foreground">
                    {colors[f.key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="card-opacity" className="text-xs">
                Card opacity
              </Label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {Math.round(cardOpacity * 100)}%
              </span>
            </div>
            <input
              id="card-opacity"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={cardOpacity}
              onChange={(e) => setCardOpacity(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="text-[11px] text-muted-foreground">
              Slide to fade cards from solid to fully transparent.
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Background image</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <span className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-xs hover:bg-accent/30">
                  {backgroundImage ? "Replace image…" : "Upload image…"}
                </span>
              </label>
              {backgroundImage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setBackgroundImage(null)}
                >
                  Remove
                </Button>
              )}
            </div>
            {backgroundImage && (
              <div
                className="h-20 w-full rounded-md border border-border bg-cover bg-center"
                style={{ backgroundImage: `url(${backgroundImage})` }}
              />
            )}
          </div>

          <div
            className="relative rounded-md border p-3 text-sm overflow-hidden"
            style={{
              backgroundColor: colors.background,
              color: colors.foreground,
              borderColor: colors.border,
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div
              className="rounded-md p-2"
              style={{
                backgroundColor: cardPreview,
                color: colors.foreground,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="font-medium">Preview card</div>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: colors.primary, color: "#fff" }}>
                  Primary
                </span>
                <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: colors.accent, color: "#fff" }}>
                  Accent
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border p-2.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <PanelLeft className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-xs font-medium">Side menu</div>
                <div className="text-[11px] text-muted-foreground">
                  Custom color &amp; transparency for the left menu in this view.
                </div>
              </div>
              <Checkbox
                checked={sidebarEnabled}
                onCheckedChange={(checked) => setSidebarEnabled(!!checked)}
                aria-label="Use custom side menu color for this view"
              />
            </div>
            <div className={cn("space-y-2", !sidebarEnabled && "opacity-50 pointer-events-none")}>
              <div className="flex items-center gap-2 rounded-md border border-input px-2 py-1">
                <input
                  type="color"
                  value={sidebarColor}
                  onChange={(e) => setSidebarColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-xs font-mono uppercase text-muted-foreground flex-1">
                  {sidebarColor}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Transparency</Label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {Math.round(sidebarOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={sidebarOpacity}
                  onChange={(e) => setSidebarOpacity(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving…" : editingId ? "Update" : "Save & apply"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
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

function DeleteAccountMenu() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      const { deleteMyAccount } = await import("@/lib/account.functions");
      await deleteMyAccount();
      toast.success("Your account has been deleted");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      toast.error("Could not delete account");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-3">
      <div>
        <div className="text-sm font-medium text-destructive">Delete account</div>
        <div className="text-xs text-muted-foreground">
          Permanently removes your account and every piece of data associated with it. You can sign
          up again later with the same email if you'd like a fresh start.
        </div>
      </div>
      <Button
        variant="destructive"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => setStep(1)}
        disabled={busy}
      >
        <Trash2 className="h-4 w-4" /> Delete my account
      </Button>

      <AlertDialog open={step === 1} onOpenChange={(o) => !o && !busy && setStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently erase your household, profiles, events, tasks, notes, contacts,
              documents, passwords, memories, and every other piece of information tied to your
              account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setStep(2);
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              I understand, continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={step === 2} onOpenChange={(o) => !o && !busy && setStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure? Once you click delete, your account and all data are gone
              for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Yes, delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DisplaysMenu() {
  const { display, detected, assigned, assignDisplay, clearAssignment } = useDisplay();
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div>
        <div className="text-sm font-medium">Displays</div>
        <div className="text-xs text-muted-foreground">
          Pick the layout that best fits this device. Bamboo tries to detect it automatically —
          your choice sticks on this device until you change it.
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Detected: <span className="font-medium text-foreground">{DISPLAYS.find((d) => d.id === detected)?.name ?? detected}</span>
        {assigned && <> · Assigned: <span className="font-medium text-foreground">{DISPLAYS.find((d) => d.id === assigned)?.name ?? assigned}</span></>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DISPLAYS.map((d) => {
          const active = display === d.id;
          const isAssigned = assigned === d.id;
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                assignDisplay(d.id as DisplayId);
                toast.success(`Display: ${d.name}`);
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border bg-background",
              )}
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  {isAssigned && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-primary/80 border border-primary/30 rounded px-1 py-px">
                      Assigned
                    </span>
                  )}
                  {active && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{d.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      {assigned && (
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { clearAssignment(); toast.success("Back to auto-detect"); }}>
          Reset to auto-detect
        </Button>
      )}
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
          <SettingsSection title="Default profile" icon={User}>
            <DefaultProfileMenu />
          </SettingsSection>
          <SettingsSection title="Users" icon={UsersIcon}>
            <UsersMenu />
          </SettingsSection>
          <SettingsSection title="View" icon={Eye}>
            <ViewMenu />
          </SettingsSection>
          <SettingsSection title="Pages" icon={LayoutGrid}>
            <PagesMenu />
          </SettingsSection>
          <SettingsSection title="Google Calendar" icon={CalendarCheck}>
            <GoogleCalendarMenu />
          </SettingsSection>
          <SettingsSection title="Profile PINs" icon={Shield}>
            <div className="space-y-3">
              {profiles.map((p) => (
                <PinRow key={p.id} profile={p} />
              ))}
            </div>
          </SettingsSection>
          <SettingsSection title="Delete account" icon={Trash2}>
            <DeleteAccountMenu />
          </SettingsSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
