import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { Leaf } from "lucide-react";

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
        <div className="min-h-screen flex w-full">
          <AppSidebar active={active} onSelect={setActive} />
          <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
            <TopNav />
            <main className="flex-1">
              {active === "calendar" ? (
                <CalendarView />
              ) : active === "dashboard" ? (
                <DashboardPage />
              ) : active === "tomorrow" ? (
                <TomorrowHomeScreen />
              ) : active === "this-week" ? (
                <ThisWeekPage />
              ) : active === "events" ? (
                <EventsPage />
              ) : active === "notes" ? (
                <NotesPage />
              ) : active === "contacts" ? (
                <ContactsPage />
              ) : active === "documents" ? (
                <DocumentsPage />
              ) : active === "passwords" ? (
                <PasswordsPage />
              ) : active === "tasks" ? (
                <TasksPage />
              ) : active === "routines" ? (
                <RoutinesPage />
              ) : active === "goals" ? (
                <GoalsPage />
              ) : active === "projects" ? (
                <ProjectsPage />
              ) : active === "meals" ? (
                <MealsPage />
              ) : active === "shopping" ? (
                <ShoppingListPage />
              ) : active === "inventory" ? (
                <InventoryPage />
              ) : active === "memories" ? (
                <MemoriesPage />
              ) : active === "household" ? (
                <HouseholdPage />
              ) : (
                <ProfileHomeScreen />
              )}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
      </NotificationsProvider>
    </HouseholdProvider>
  );
}
