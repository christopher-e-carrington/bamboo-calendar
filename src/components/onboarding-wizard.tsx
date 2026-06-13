import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHousehold } from "@/lib/household-store";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Leaf, Users, Building2, ArrowRight, ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const PALETTE = ["#7BA37A", "#A7C29A", "#C9A36B", "#E8B774", "#9CB89A", "#B58A6B", "#8FB4C8", "#D49AA6"];

type OrgKind = "household" | "organization";

const initialsOf = (name: string) => {
  const clean = name.trim().replace(/[^A-Za-z ]/g, "");
  if (!clean) return "NP";
  const parts = clean.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (first + last).toUpperCase() || "NP";
};

const STORAGE_KEY = (uid: string) => `bamboo.onboarded.${uid}`;

export function OnboardingWizard({ user }: { user: User }) {
  const { householdId, isHouseholdOwner, profiles, loading } = useHousehold();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // step 0: self contact
  const [myName, setMyName] = useState("");
  const [myEmail, setMyEmail] = useState(user.email ?? "");
  const [myPhone, setMyPhone] = useState("");
  const [myAddress, setMyAddress] = useState("");
  const [myBirthday, setMyBirthday] = useState("");

  // step 1: org kind
  const [orgKind, setOrgKind] = useState<OrgKind>("household");

  // step 2: count + step 3: names
  const [memberCount, setMemberCount] = useState<number>(2);
  const [memberNames, setMemberNames] = useState<string[]>(["", ""]);

  // step 4: extras
  const [extras, setExtras] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!isHouseholdOwner) return;
    if (typeof window === "undefined") return;
    const flagged = window.localStorage.getItem(STORAGE_KEY(user.id));
    if (flagged) return;
    setOpen(true);
  }, [loading, isHouseholdOwner, user.id]);

  useEffect(() => {
    setMemberNames((prev) => {
      const next = [...prev];
      while (next.length < memberCount) next.push("");
      next.length = memberCount;
      return next;
    });
  }, [memberCount]);

  const markDone = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY(user.id), "1");
    setOpen(false);
  };

  const skip = () => {
    if (!confirm("Skip setup? You can manage profiles later from the sidebar.")) return;
    markDone();
  };

  const canNext = () => {
    if (step === 0) return myName.trim().length > 0;
    if (step === 2) return memberCount >= 1 && memberCount <= 20;
    if (step === 3) return memberNames.every((n) => n.trim().length > 0);
    return true;
  };

  const finish = async () => {
    setBusy(true);
    try {
      // 1. Wipe the default auto-generated profiles for this household so we start clean.
      await supabase.from("household_profiles").delete().eq("owner_id", householdId);

      // 2. Build the new profile set
      const sharedLabel = orgKind === "household" ? "Household" : "Shared";
      type NewProfile = {
        owner_id: string;
        name: string;
        role: "shared" | "parent";
        color: string;
        initials: string;
        sort_order: number;
        birthday: string | null;
      };
      const rows: NewProfile[] = [];
      let order = 0;
      // Shared / household account
      rows.push({
        owner_id: householdId,
        name: sharedLabel,
        role: "shared",
        color: PALETTE[0],
        initials: orgKind === "household" ? "HH" : "SH",
        sort_order: order++,
        birthday: null,
      });
      // Self
      rows.push({
        owner_id: householdId,
        name: myName.trim(),
        role: "shared",
        color: PALETTE[1 % PALETTE.length],
        initials: initialsOf(myName),
        sort_order: order++,
        birthday: myBirthday || null,
      });
      // Other members
      memberNames.forEach((n, i) => {
        const name = n.trim();
        if (!name) return;
        rows.push({
          owner_id: householdId,
          name,
          role: "shared",
          color: PALETTE[(i + 2) % PALETTE.length],
          initials: initialsOf(name),
          sort_order: order++,
          birthday: null,
        });
      });
      // Extras
      extras.forEach((n, i) => {
        const name = n.trim();
        if (!name) return;
        rows.push({
          owner_id: householdId,
          name,
          role: "shared",
          color: PALETTE[(i + 4) % PALETTE.length],
          initials: initialsOf(name),
          sort_order: order++,
          birthday: null,
        });
      });

      const { error: insErr } = await supabase
        .from("household_profiles")
        .insert(rows as never);
      if (insErr) throw insErr;

      // 3. Save self into contacts
      const { error: cErr } = await supabase.from("contacts").insert({
        owner_id: householdId,
        name: myName.trim(),
        email: myEmail.trim() || null,
        phone: myPhone.trim() || null,
        address: myAddress.trim() || null,
        birthday: myBirthday || null,
        notes: "Account owner",
      } as never);
      if (cErr) throw cErr;

      qc.invalidateQueries({ queryKey: ["profiles", householdId] });
      qc.invalidateQueries({ queryKey: ["contacts", householdId] });
      qc.invalidateQueries({ queryKey: ["events", householdId] });

      toast.success("You're all set!", { description: "Your profiles are ready." });
      markDone();
    } catch (e) {
      toast.error("Couldn't complete setup", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  // Don't render if nothing to show — avoid flashing for joined members or returning users.
  if (!open) return null;
  // Safety: if profiles aren't loaded yet, hold off (we need householdId)
  if (!householdId) return null;
  void profiles; // referenced for future-proofing

  const totalSteps = 5;
  const sharedLabel = orgKind === "household" ? "Household" : "Shared";

  return (
    <Dialog open={open} onOpenChange={() => { /* lock; user finishes or skips */ }}>
      <DialogContent
        className="sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Leaf className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Welcome to Bamboo</span>
          </div>
          <DialogTitle className="font-display text-2xl">
            {step === 0 && "Tell us about you"}
            {step === 1 && "Who's this for?"}
            {step === 2 && `How many people in your ${orgKind}?`}
            {step === 3 && "Add their names"}
            {step === 4 && "Any other profiles?"}
          </DialogTitle>
          <DialogDescription>Step {step + 1} of {totalSteps}</DialogDescription>
        </DialogHeader>

        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full name</Label>
              <Input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={myEmail} onChange={(e) => setMyEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={myPhone} onChange={(e) => setMyPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Textarea value={myAddress} onChange={(e) => setMyAddress(e.target.value)} rows={2} placeholder="Street, City, State" />
            </div>
            <div>
              <Label className="text-xs">Birthday</Label>
              <Input type="date" value={myBirthday} onChange={(e) => setMyBirthday(e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {(["household", "organization"] as OrgKind[]).map((k) => {
              const Icon = k === "household" ? Users : Building2;
              const selected = orgKind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOrgKind(k)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-6 w-6 text-primary mb-2" />
                  <div className="font-medium capitalize">{k}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {k === "household" ? "Family or roommates sharing a home." : "Team, club, or business."}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Including yourself, how many people will use this {orgKind}? You can always add more later.
            </p>
            <div className="flex items-center gap-3 justify-center py-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMemberCount(Math.max(1, memberCount - 1))}
                disabled={memberCount <= 1}
              >
                −
              </Button>
              <div className="font-display text-5xl w-20 text-center tabular-nums">{memberCount}</div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMemberCount(Math.min(20, memberCount + 1))}
                disabled={memberCount >= 20}
              >
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              We'll create a shared "{sharedLabel}" account plus one profile per person.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You'll be added as <span className="font-medium text-foreground">{myName || "you"}</span>. Add the other {Math.max(0, memberCount - 1)} {memberCount - 1 === 1 ? "person" : "people"}:
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
              {Array.from({ length: Math.max(0, memberCount - 1) }).map((_, i) => (
                <div key={i}>
                  <Label className="text-xs">Person {i + 2}</Label>
                  <Input
                    value={memberNames[i] ?? ""}
                    onChange={(e) => {
                      const next = [...memberNames];
                      next[i] = e.target.value;
                      setMemberNames(next);
                    }}
                    placeholder={orgKind === "household" ? "e.g. Alex" : "e.g. Sam Lee"}
                  />
                </div>
              ))}
              {memberCount === 1 && (
                <p className="text-xs text-muted-foreground italic">Just you for now — that's totally fine.</p>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Want extra profiles for things like <em>Work</em>, <em>Business</em>, or <em>Travel</em>? Add any you'd like — or skip and add them later from Manage Profiles.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto -mx-1 px-1">
              {extras.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => {
                      const next = [...extras];
                      next[i] = e.target.value;
                      setExtras(next);
                    }}
                    placeholder="Profile name"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setExtras(extras.filter((_, idx) => idx !== i))}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setExtras([...extras, ""])}
              disabled={extras.length >= 8}
            >
              <Plus className="h-4 w-4" /> Add a profile
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 gap-2">
          <Button variant="ghost" size="sm" onClick={skip} disabled={busy}>
            Skip for now
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext() || busy} className="gap-1.5">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={busy} className="gap-1.5">
                {busy ? "Setting up…" : (<>Finish <Check className="h-4 w-4" /></>)}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
