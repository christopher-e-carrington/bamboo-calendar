import { useState } from "react";
import { useHousehold } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { PinDialog } from "./pin-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check, Lock, LogOut } from "lucide-react";
import type { Profile } from "@/lib/household-store";
import { supabase } from "@/integrations/supabase/client";

export function ProfileSwitcher() {
  const { profiles, activeProfile, activeProfileId, setActiveProfileId } = useHousehold();
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const choose = (p: Profile) => {
    setOpen(false);
    if (p.pin && p.id !== activeProfileId) {
      setPinFor(p);
      setPinOpen(true);
    } else {
      setActiveProfileId(p.id);
    }
  };

  if (!activeProfile) return null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 rounded-full bamboo-card pl-1 pr-3 py-1 hover:shadow-md transition-shadow">
            <ProfileAvatar profile={activeProfile} size={32} />
            <span className="font-medium text-sm hidden sm:inline">{activeProfile.name}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <div className="px-2 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Switch profile
          </div>
          <div className="space-y-1">
            {profiles.map((p) => {
              const active = p.id === activeProfileId;
              return (
                <button
                  key={p.id}
                  onClick={() => choose(p)}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary transition-colors text-left"
                >
                  <ProfileAvatar profile={p} size={36} ring={active} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {p.name}
                      {p.pin && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border mt-2 pt-2">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <PinDialog
        profile={pinFor}
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSuccess={() => {
          if (pinFor) setActiveProfileId(pinFor.id);
          setPinOpen(false);
        }}
      />
    </>
  );
}
