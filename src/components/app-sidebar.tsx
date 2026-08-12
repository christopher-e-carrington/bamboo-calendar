import { Calendar, CheckSquare, Home, Leaf, BookUser, Target, ChefHat, ShoppingCart, Boxes, Repeat, FileText, KeyRound, CalendarPlus, NotebookPen, PanelLeftClose, CalendarRange, Sunrise, FolderKanban, LayoutDashboard, Bell, BookHeart } from "lucide-react";
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
  { id: "tomorrow", title: "Tomorrow", icon: Sunrise },
  { id: "calendar", title: "Calendar", icon: Calendar },
  { id: "this-week", title: "This Week", icon: CalendarRange },
  { id: "events", title: "Events", icon: CalendarPlus },
  { id: "tasks", title: "To-Dos", icon: CheckSquare },
  { id: "routines", title: "Routines", icon: Repeat },
  { id: "goals", title: "Goals", icon: Target },
  { id: "projects", title: "Projects", icon: FolderKanban },
  { id: "reminders", title: "Reminders", icon: Bell },
  { id: "notes", title: "Notes", icon: NotebookPen },
  { id: "shopping", title: "Shopping", icon: ShoppingCart },
  { id: "meals", title: "Meals", icon: ChefHat },
  { id: "journal", title: "Journal", icon: BookHeart },
  { id: "memories", title: "Memories", icon: BookHeart },
  { id: "contacts", title: "Contacts", icon: BookUser },
  { id: "passwords", title: "Passwords", icon: KeyRound },
  { id: "documents", title: "Documents", icon: FileText },
  { id: "inventory", title: "Inventory", icon: Boxes },
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },

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
                    onClick={() => {
                      onSelect(item.id);
                      setOpen(false);
                      setOpenMobile(false);
                    }}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


      </SidebarContent>
    </Sidebar>
  );
}
