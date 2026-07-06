import { useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import type { LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useAuth } from "@/hooks/use-auth";
import {
  useDashboardConfig,
  WIDGET_CATALOG,
  type WidgetType,
} from "@/lib/dashboard-store";
import { WIDGET_COMPONENTS } from "./dashboard-widgets";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Check, RotateCcw, X, LayoutDashboard } from "lucide-react";

const ResponsiveGridLayout = WidthProvider(Responsive);

export function DashboardPage() {
  const { user } = useAuth();
  const { config, loaded, addWidget, removeWidget, updateLayouts, reset } =
    useDashboardConfig(user?.id);
  const [editing, setEditing] = useState(false);

  if (!loaded) {
    return <div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl">Dashboard</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · saved for this device
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Add widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {WIDGET_CATALOG.map((w) => (
                    <DropdownMenuItem key={w.type} onSelect={() => addWidget(w.type as WidgetType)}>
                      {w.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={() => setEditing((v) => !v)}
            className="gap-1.5"
          >
            {editing ? (
              <>
                <Check className="h-4 w-4" /> Done
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" /> Edit
              </>
            )}
          </Button>
        </div>
      </div>

      {config.widgets.length === 0 ? (
        <div className="bamboo-card p-10 text-center text-muted-foreground">
          <p className="mb-3">Your dashboard is empty.</p>
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1.5" /> Customize
          </Button>
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={config.layouts as { [k: string]: LayoutItem[] }}
          breakpoints={{ lg: 1200, md: 900, sm: 640, xs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 2 }}
          rowHeight={40}
          margin={[12, 12]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".drag-handle"
          onLayoutChange={(_current: LayoutItem[], all: { [k: string]: LayoutItem[] }) => {
            if (editing) updateLayouts(all);
          }}
        >
          {config.widgets.map((w) => {
            const Comp = WIDGET_COMPONENTS[w.type];
            return (
              <div
                key={w.id}
                className="bamboo-card overflow-hidden relative group"
              >
                {editing && (
                  <button
                    onClick={() => removeWidget(w.id)}
                    className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-background/90 border border-border grid place-items-center text-muted-foreground hover:text-destructive"
                    aria-label="Remove widget"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {Comp ? <Comp /> : <div className="p-3 text-xs">Unknown widget</div>}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      <style>{`
        .react-grid-item.react-grid-placeholder {
          background: hsl(var(--primary) / 0.15) !important;
          border-radius: 12px;
        }
        .react-grid-item > .react-resizable-handle {
          opacity: ${editing ? 1 : 0};
        }
      `}</style>
    </div>
  );
}
