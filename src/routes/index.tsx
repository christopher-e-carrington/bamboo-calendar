import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { HouseholdProvider } from "@/lib/household-store";
import { AppSidebar } from "@/components/app-sidebar";
import { TopNav } from "@/components/top-nav";
import { Dashboard } from "@/components/dashboard";
import { AuthScreen } from "@/components/auth-screen";
import { useAuth } from "@/hooks/use-auth";
import { Leaf } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bamboo — Calm Family Calendar" },
      {
        name: "description",
        content:
          "A calming, nature-inspired family calendar with multi-profile household accounts, shared events, tasks and PIN-protected profile switching.",
      },
      { property: "og:title", content: "Bamboo — Calm Family Calendar" },
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
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar active={active} onSelect={setActive} />
          <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
            <TopNav />
            <main className="flex-1">
              <Dashboard />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </HouseholdProvider>
  );
}
