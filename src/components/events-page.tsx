import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHousehold } from "@/lib/household-store";
import { expandEvents } from "@/lib/event-recurrence";
import { EventDialog } from "./event-dialog";
import { ProfileAvatar } from "./profile-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarPlus, CalendarClock, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

function fmt(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventsPage() {
  const { events, profiles, visibleEvents, deleteEvent } = useHousehold();
  const [busyId, setBusyId] = useState<string | null>(null);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const source = visibleEvents?.length ? visibleEvents : events;
    const rangeStart = new Date(now - 60 * 60 * 1000);
    const rangeEnd = new Date(now + 365 * 24 * 60 * 60 * 1000);
    return expandEvents(source, rangeStart, rangeEnd)
      .filter((e) => new Date(e.start_at).getTime() >= now - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 30);
  }, [events, visibleEvents]);

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteEvent(id);
      toast.success("Event deleted");
    } catch {
      toast.error("Could not delete event");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Events</h1>
          <p className="text-sm text-muted-foreground">Quickly add an event and see what's next.</p>
        </div>
        <EventDialog
          trigger={
            <Button className="gap-1.5">
              <CalendarPlus className="h-4 w-4" /> Create new event
            </Button>
          }
        />
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" /> Upcoming events
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            No upcoming events yet. Tap "Create new event" to add one.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((e) => {
              const ids = e.profile_ids?.length ? e.profile_ids : [e.profile_id];
              const ps = ids.map((id) => profileMap[id]).filter(Boolean);
              return (
                <li key={e.id} className="py-3 flex items-start gap-3">
                  <div className="flex -space-x-2 mt-0.5">
                    {ps.slice(0, 3).map((p) => (
                      <ProfileAvatar key={p.id} profile={p} size={24} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmt(new Date(e.start_at))}
                    </div>
                    {e.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {e.location}
                      </div>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={busyId === e.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete event</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete event?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove <span className="font-medium">{e.title}</span> from the calendar. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(e.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
