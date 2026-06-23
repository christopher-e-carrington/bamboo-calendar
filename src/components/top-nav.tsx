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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CalendarPlus, Plus, Search } from "lucide-react";
import { useHousehold } from "@/lib/household-store";
import { useNotifications } from "@/lib/notifications-store";
import { EventDialog } from "./event-dialog";
import { ProfileSettingsSheet } from "./profile-settings-sheet";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function TopNav() {
  const { activeProfile, familyProfile } = useHousehold();
  const { items, unreadCount, markAllRead, clear } = useNotifications();
  const [eventOpen, setEventOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
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
          <Popover
            open={notifOpen}
            onOpenChange={(o) => {
              setNotifOpen(o);
              if (o && unreadCount > 0) markAllRead();
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full bg-wood text-[10px] font-medium text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="font-medium text-sm">Notifications</div>
                {items.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
                    Clear
                  </Button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    You're all caught up
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((n) => (
                      <li key={n.id} className="px-3 py-2.5">
                        <div className="text-sm leading-snug">{n.message}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {timeAgo(n.at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
