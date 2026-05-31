import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProfileSwitcher } from "./profile-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CalendarPlus, Plus, Search } from "lucide-react";
import { useHousehold } from "@/lib/household-store";
import { EventDialog } from "./event-dialog";
import { ProfileSettingsSheet } from "./profile-settings-sheet";

export function TopNav() {
  const { activeProfile, familyProfile } = useHousehold();
  const [eventOpen, setEventOpen] = useState(false);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const isHousehold = activeProfile?.id === familyProfile?.id;
  const viewing = !activeProfile
    ? "Loading…"
    : isHousehold
    ? "Household view"
    : `${activeProfile.name}'s view`;

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="flex items-center gap-2 px-3 sm:px-5 h-14">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="hidden md:block leading-tight ml-1">
          <div className="font-display text-base">{today}</div>
          <div className="text-xs text-muted-foreground">{viewing}</div>
        </div>
        <div className="md:hidden text-sm font-medium truncate">{viewing}</div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-wood" />
          </Button>
          <ProfileSettingsSheet />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="rounded-full px-3 gap-1.5 hidden sm:inline-flex">
                <Plus className="h-4 w-4" />
                <span>New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEventOpen(true)} className="gap-2">
                <CalendarPlus className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm">Event</span>
                  <span className="text-[11px] text-muted-foreground">
                    Add to the calendar with details
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <EventDialog open={eventOpen} onOpenChange={setEventOpen} />

          <ProfileSwitcher />
        </div>
      </div>
    </header>
  );
}
