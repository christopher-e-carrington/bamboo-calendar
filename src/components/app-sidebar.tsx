import { Calendar, CheckSquare, Image as ImageIcon, Home, Leaf, BookUser, Target, ChefHat, ShoppingCart, Boxes, Repeat, FileText, KeyRound, CalendarPlus, NotebookPen, PanelLeftClose, CalendarRange, Sunrise, FolderKanban, LayoutDashboard, Lock, Sparkles } from "lucide-react";
import { usePremium, PREMIUM_PAGES } from "@/hooks/use-premium";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useHiddenPages } from "@/lib/hidden-pages-store";

export const NAV_ITEMS = [
  { id: "today", title: "Today", icon: Home },
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
  { id: "tomorrow", title: "Tomorrow", icon: Sunrise },
  { id: "this-week", title: "This Week", icon: CalendarRange },
  { id: "calendar", title: "Calendar", icon: Calendar },
  { id: "events", title: "Events", icon: CalendarPlus },
  { id: "notes", title: "Notes", icon: NotebookPen },
  { id: "tasks", title: "To-Dos", icon: CheckSquare },
  { id: "routines", title: "Routines", icon: Repeat },
  { id: "goals", title: "Goals", icon: Target },
  { id: "projects", title: "Projects", icon: FolderKanban },
  { id: "meals", title: "Meals", icon: ChefHat },
  { id: "shopping", title: "Shopping", icon: ShoppingCart },
  { id: "inventory", title: "Inventory", icon: Boxes },
  { id: "contacts", title: "Contacts", icon: BookUser },
  { id: "documents", title: "Documents", icon: FileText },
  { id: "passwords", title: "Passwords", icon: KeyRound },
  { id: "memories", title: "Memories", icon: ImageIcon },
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
  const { state, setOpen, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { hidden } = useHiddenPages();
  const { isPremium } = usePremium();

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
              {NAV_ITEMS.filter((item) => !hidden.includes(item.id) || ALWAYS_VISIBLE_PAGES.has(item.id)).map((item) => {
                const isLocked = PREMIUM_PAGES.has(item.id) && !isPremium;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active === item.id}
                      onClick={() => {
                        onSelect(item.id);
                        setOpen(false);
                        setOpenMobile(false);
                      }}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {isLocked && !collapsed && (
                        <Lock className="h-3 w-3 text-muted-foreground/70" aria-label="Premium" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {!isPremium && !collapsed && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onSelect("upgrade")}
                    className="mt-2 bg-gradient-to-r from-primary/15 to-[#C9A36B]/15 border border-primary/20 text-primary font-medium hover:from-primary/25 hover:to-[#C9A36B]/25"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Upgrade to Premium</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
