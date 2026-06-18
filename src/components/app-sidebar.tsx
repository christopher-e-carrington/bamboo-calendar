import { Calendar, CheckSquare, Image as ImageIcon, Home, Users, Settings, Leaf, BookUser, Target, ChefHat, ShoppingCart, Boxes, Repeat, FileText, KeyRound, CalendarPlus, NotebookPen, PanelLeftClose } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useHousehold } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { PinDialog } from "./pin-dialog";
import type { Profile } from "@/lib/household-store";
import { ManageProfilesDialog } from "./manage-profiles-dialog";
import { ProfileSettingsSheet } from "./profile-settings-sheet";
import { useHiddenPages } from "@/lib/hidden-pages-store";

export const NAV_ITEMS = [
  { id: "today", title: "Today", icon: Home },
  { id: "calendar", title: "Calendar", icon: Calendar },
  { id: "events", title: "Events", icon: CalendarPlus },
  { id: "notes", title: "Notes", icon: NotebookPen },
  { id: "tasks", title: "To-Dos", icon: CheckSquare },
  { id: "routines", title: "Routines", icon: Repeat },
  { id: "goals", title: "Goals", icon: Target },
  { id: "meals", title: "Meals", icon: ChefHat },
  { id: "shopping", title: "Shopping", icon: ShoppingCart },
  { id: "inventory", title: "Inventory", icon: Boxes },
  { id: "contacts", title: "Contacts", icon: BookUser },
  { id: "documents", title: "Documents", icon: FileText },
  { id: "passwords", title: "Passwords", icon: KeyRound },
  { id: "memories", title: "Memories", icon: ImageIcon },
  { id: "household", title: "Household", icon: Users },
];
// Pages that can never be hidden from the sidebar.
export const ALWAYS_VISIBLE_PAGES = new Set(["today"]);


export function AppSidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  const { state, setOpen, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { profiles, activeProfileId, setActiveProfileId } = useHousehold();
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const { hidden } = useHiddenPages();

  const chooseProfile = (p: Profile) => {
    if (p.pin && p.id !== activeProfileId) {
      setPinFor(p);
      setPinOpen(true);
    } else {
      setActiveProfileId(p.id);
    }
  };

  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <Leaf className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="font-display text-lg">Bamboo</div>
                <div className="text-[11px] text-muted-foreground -mt-0.5">calendar</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Collapse menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.filter((item) => !hidden.includes(item.id) || ALWAYS_VISIBLE_PAGES.has(item.id)).map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    onClick={() => onSelect(item.id)}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between pr-2">
            <span>Profiles</span>
            {!collapsed && <ManageProfilesDialog />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      onClick={() => chooseProfile(p)}
                      className={cn(
                        "gap-3",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      <ProfileAvatar profile={p} size={22} />
                      <span className="truncate">{p.name}</span>
                      {p.pin && (
                        <span className="ml-auto text-[10px] text-muted-foreground">PIN</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ProfileSettingsSheet
              trigger={
                <SidebarMenuButton>
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <PinDialog
        profile={pinFor}
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSuccess={() => {
          if (pinFor) setActiveProfileId(pinFor.id);
          setPinOpen(false);
        }}
      />
    </Sidebar>
  );
}
