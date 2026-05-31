import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHousehold } from "@/lib/household-store";
import { HouseholdInvites } from "./household-invites";
import { ManageProfilesDialog } from "./manage-profiles-dialog";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

type Member = { id: string; user_id: string; display_name: string | null; role: string; created_at: string };

export function HouseholdPage() {
  const { user } = useAuth();
  const { householdId, isHouseholdOwner } = useHousehold();

  const membersQ = useQuery({
    queryKey: ["members", householdId],
    enabled: !!user,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("household_members")
        .select("id,user_id,display_name,role,created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Household</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isHouseholdOwner
              ? "Invite people to share this calendar and manage profiles."
              : "You're a member of this shared household."}
          </p>
        </div>
        <ManageProfilesDialog
          trigger={<Button variant="outline">Manage profiles</Button>}
        />
      </div>

      <section className="bamboo-card p-5">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Members
        </h2>
        {membersQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-medium">{isHouseholdOwner ? "You" : "Household owner"}</span>
              <span className="text-xs text-muted-foreground">creator</span>
            </li>
            {(membersQ.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span>{m.display_name || "Member"}</span>
                {m.user_id === user?.id && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bamboo-card p-5">
        <h2 className="font-display text-lg mb-3">Invite new members</h2>
        <HouseholdInvites />
      </section>
    </div>
  );
}
