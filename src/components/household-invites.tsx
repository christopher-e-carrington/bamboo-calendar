import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household-store";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Mail, Trash2, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";

type Invitation = {
  id: string;
  token: string;
  invited_email: string | null;
  invited_name: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  profile_id: string | null;
};

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function HouseholdInvites() {
  const { user } = useAuth();
  const { householdId, isHouseholdOwner, profiles } = useHousehold();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState<string>("__new__");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const invitesQ = useQuery({
    queryKey: ["invites", householdId],
    enabled: !!user && isHouseholdOwner,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("household_invitations")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(token);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(null), 2000);
  };

  const mailLink = (inv: Invitation) => {
    const subject = encodeURIComponent("Join our household calendar on Bamboo");
    const body = encodeURIComponent(
      `Hi${inv.invited_name ? ` ${inv.invited_name}` : ""},\n\n` +
        `You've been invited to join our household calendar. ` +
        `Click the link below to set up your account:\n\n${inviteLink(inv.token)}\n\n` +
        `This invitation expires on ${new Date(inv.expires_at).toLocaleDateString()}.`,
    );
    const to = inv.invited_email ? encodeURIComponent(inv.invited_email) : "";
    return `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const createInvite = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const token = randomToken();
      const isClaim = profileId !== "__new__";
      const claimProfile = isClaim ? profiles.find((p) => p.id === profileId) : null;
      const { error } = await supabase.from("household_invitations").insert({
        household_id: householdId,
        token,
        invited_email: email.trim() || null,
        invited_name: name.trim() || (claimProfile?.name ?? null),
        profile_id: isClaim ? profileId : null,
      });
      if (error) throw error;
      setName("");
      setEmail("");
      setProfileId("__new__");
      toast.success("Invite created — copy the link to share");
      qc.invalidateQueries({ queryKey: ["invites", householdId] });
    } catch (e) {
      console.error(e);
      toast.error("Could not create invite");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("household_invitations").delete().eq("id", id);
    if (error) {
      toast.error("Could not revoke");
      return;
    }
    toast.success("Invite revoked");
    qc.invalidateQueries({ queryKey: ["invites", householdId] });
  };

  if (!isHouseholdOwner) {
    return (
      <div className="text-sm text-muted-foreground">
        Only the household creator can invite new members.
      </div>
    );
  }

  const invites = invitesQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4 bg-secondary/30 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserPlus className="h-4 w-4 text-primary" /> Invite someone
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label htmlFor="invite-name" className="text-xs">Name (optional)</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aunt Lin"
            />
          </div>
          <div>
            <Label htmlFor="invite-email" className="text-xs">Email (optional)</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@example.com"
            />
          </div>
        </div>
        <Button onClick={createInvite} disabled={creating} className="w-full sm:w-auto">
          {creating ? "Creating…" : "Create invite link"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          You'll get a shareable link to send them. They'll sign up, fill in their details,
          and join your household.
        </p>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Active invites
        </h4>
        {invitesQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
        ) : invites.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No invites yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const accepted = inv.status === "accepted";
              return (
                <li
                  key={inv.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {inv.invited_name || inv.invited_email || "Anonymous invite"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {accepted
                        ? `Joined ${new Date(inv.created_at).toLocaleDateString()}`
                        : expired
                          ? "Expired"
                          : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                      {inv.invited_email && !accepted && ` · ${inv.invited_email}`}
                    </div>
                  </div>
                  {!accepted && !expired && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Copy link"
                        onClick={() => copyLink(inv.token)}
                      >
                        {copied === inv.token ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <a href={mailLink(inv)} title="Send via email">
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Mail className="h-4 w-4" />
                        </Button>
                      </a>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    title="Revoke"
                    onClick={() => revoke(inv.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
