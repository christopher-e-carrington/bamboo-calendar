import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { HouseholdProvider } from "@/lib/household-store";
import { NotificationsProvider } from "@/lib/notifications-store";
import { AppSidebar } from "@/components/app-sidebar";
import { TopNav } from "@/components/top-nav";
import { ProfileHomeScreen } from "@/components/profile-home-screen";
import { TomorrowHomeScreen } from "@/components/tomorrow-home-screen";
import { CalendarView } from "@/components/calendar-view";
import { EventsPage } from "@/components/events-page";
import { ThisWeekPage } from "@/components/this-week-page";
import { NotesPage } from "@/components/notes-page";
import { ContactsPage } from "@/components/contacts-page";
import { DocumentsPage } from "@/components/documents-page";
import { PasswordsPage } from "@/components/passwords-page";
import { TasksPage } from "@/components/tasks-page";
import { RoutinesPage } from "@/components/routines-page";
import { GoalsPage } from "@/components/goals-page";
import { ProjectsPage } from "@/components/projects-page";
import { MealsPage } from "@/components/meals-page";
import { ShoppingListPage } from "@/components/shopping-list-page";
import { InventoryPage } from "@/components/inventory-page";
import { MemoriesPage } from "@/components/memories-page";
import { DashboardPage } from "@/components/dashboard-page";
import { HouseholdPage } from "@/components/household-page";
import { AuthScreen } from "@/components/auth-screen";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { UpgradeModal } from "@/components/upgrade-modal";
import { PremiumLockedPage } from "@/components/premium-locked-page";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { usePremium, PREMIUM_PAGES } from "@/hooks/use-premium";
import { useAuth } from "@/hooks/use-auth";
import { Leaf } from "lucide-react";

const PAGE_LABELS: Record<string, string> = {
  calendar: "Calendar",
  events: "Events",
  goals: "Goals",
  projects: "Projects",
  shopping: "Shopping",
  meals: "Meals",
  routines: "Routines",
  inventory: "Inventory",
  documents: "Documents",
  memories: "Memories",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bamboo Calendar" },
      {
        name: "description",
        content:
          "A calming, nature-inspired calendar with multi-profile household accounts, shared events, tasks and PIN-protected profile switching.",
      },
      { property: "og:title", content: "Bamboo Calendar" },
      {
        property: "og:description",
        content: "Multi-profile household calendar with a sage and bamboo aesthetic.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState("today");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeLabel, setUpgradeLabel] = useState<string | undefined>(undefined);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Leaf className="h-5 w-5 mr-2 animate-pulse text-primary" /> Growing your garden…
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <HouseholdProvider user={user}>
      <NotificationsProvider>
        <OnboardingWizard user={user} />
        <SidebarProvider>
          <div className="min-h-screen flex w-full flex-col">
            <PaymentTestModeBanner />
            <div className="flex flex-1 w-full">
              <AppSidebar
                active={active}
                onSelect={(id) => {
                  if (id === "upgrade") {
                    setUpgradeLabel(undefined);
                    setUpgradeOpen(true);
                    return;
                  }
                  setActive(id);
                }}
              />
              <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
                <TopNav />
                <main className="flex-1">
                  <PageRouter
                    active={active}
                    onUpgrade={(label) => {
                      setUpgradeLabel(label);
                      setUpgradeOpen(true);
                    }}
                  />
                </main>
              </SidebarInset>
            </div>
          </div>
        </SidebarProvider>
        <UpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          featureLabel={upgradeLabel}
        />
      </NotificationsProvider>
    </HouseholdProvider>
  );
}

function PageRouter({
  active,
  onUpgrade,
}: {
  active: string;
  onUpgrade: (label?: string) => void;
}) {
  const { isPremium, isLoading, refetch } = usePremium();

  // After Stripe embedded checkout redirects back with ?checkout=success,
  // toast + poll entitlement so the UI unlocks without a manual refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);
    import("sonner").then(({ toast }) =>
      toast.success("Welcome to Bamboo Premium!", {
        description: "Your household now has full access. Enjoy!",
      }),
    );
    // Webhook may take a couple seconds — retry a few times.
    let attempts = 0;
    const iv = setInterval(() => {
      attempts += 1;
      refetch();
      if (attempts >= 6) clearInterval(iv);
    }, 1500);
    return () => clearInterval(iv);
  }, [refetch]);


  if (PREMIUM_PAGES.has(active) && !isPremium && !isLoading) {
    return (
      <PremiumLockedPage
        featureLabel={PAGE_LABELS[active] ?? active}
        onUpgrade={() => onUpgrade(PAGE_LABELS[active] ?? active)}
      />
    );
  }

  switch (active) {
    case "calendar": return <CalendarView />;
    case "dashboard": return <DashboardPage />;
    case "tomorrow": return <TomorrowHomeScreen />;
    case "this-week": return <ThisWeekPage />;
    case "events": return <EventsPage />;
    case "notes": return <NotesPage />;
    case "contacts": return <ContactsPage />;
    case "documents": return <DocumentsPage />;
    case "passwords": return <PasswordsPage />;
    case "tasks": return <TasksPage />;
    case "routines": return <RoutinesPage />;
    case "goals": return <GoalsPage />;
    case "projects": return <ProjectsPage />;
    case "meals": return <MealsPage />;
    case "shopping": return <ShoppingListPage />;
    case "inventory": return <InventoryPage />;
    case "memories": return <MemoriesPage />;
    case "household": return <HouseholdPage />;
    default: return <ProfileHomeScreen />;
  }
}
