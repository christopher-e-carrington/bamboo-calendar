import { CloudOff, RefreshCw } from "lucide-react";
import { useOfflineStatus } from "@/lib/offline/use-offline-status";

/** Small floating pill telling the user the app is running from cache. */
export function OfflineBanner() {
  const { online, pending, syncing } = useOfflineStatus();
  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? "" : "s"} saved here`
      : "Offline · showing your saved data"
    : syncing
      ? "Syncing your changes…"
      : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 pointer-events-none">
      <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 px-3.5 py-2 text-xs shadow-lg backdrop-blur">
        {online ? (
          <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
