import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CalendarPlus, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useHousehold } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import {
  getGoogleSettings,
  listGoogleCalendars,
  saveGoogleSettings,
  listUpcomingGoogleEvents,
  importGoogleEvent,
} from "@/lib/google-calendar.functions";

function fmtWhen(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ImportFromGoogleDialog() {
  const qc = useQueryClient();
  const { profiles, familyProfile } = useHousehold();
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState<string>("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const listFn = useServerFn(listUpcomingGoogleEvents);
  const importFn = useServerFn(importGoogleEvent);

  const q = useQuery({
    queryKey: ["google-upcoming"],
    queryFn: () => listFn(),
    enabled: open,
    staleTime: 30_000,
  });

  const targetProfileId = profileId || familyProfile?.id || profiles[0]?.id || "";

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doImport = async () => {
    if (!targetProfileId) {
      toast.error("Pick a profile first");
      return;
    }
    if (picked.size === 0) {
      toast.error("Select at least one event");
      return;
    }
    setBusy(true);
    try {
      let ok = 0;
      for (const gid of picked) {
        try {
          await importFn({ data: { googleEventId: gid, profileIds: [targetProfileId] } });
          ok += 1;
        } catch (e) {
          console.error("[google-import]", e);
        }
      }
      toast.success(`Imported ${ok} event${ok === 1 ? "" : "s"}`);
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["google-upcoming"] });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full gap-1.5">
          <CalendarDown className="h-4 w-4" /> Import events from Google
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Google Calendar</DialogTitle>
          <DialogDescription>
            Pick upcoming Google events to copy into Bamboo. Already-linked events are hidden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Assign to profile</Label>
            <Select value={targetProfileId} onValueChange={setProfileId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <ProfileAvatar profile={p} size={20} /> {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {q.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
            </div>
          )}
          {q.error && (
            <div className="text-sm text-destructive">
              Couldn't load events: {(q.error as Error).message}
            </div>
          )}
          {q.data && q.data.events.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No upcoming events on this calendar.
            </div>
          )}
          <div className="space-y-1.5">
            {q.data?.events
              .filter((e) => !e.alreadyLinked)
              .map((e) => {
                const checked = picked.has(e.id);
                return (
                  <label
                    key={e.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-background p-2 cursor-pointer hover:border-primary/40"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => togglePick(e.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.title}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtWhen(e.start)}</div>
                      {e.location && (
                        <div className="text-[11px] text-muted-foreground truncate">📍 {e.location}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            {q.data?.events.some((e) => e.alreadyLinked) && (
              <div className="text-[11px] text-muted-foreground pt-1">
                Some events are already linked to Bamboo and hidden.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={doImport} disabled={busy || picked.size === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Import {picked.size > 0 ? `(${picked.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GoogleCalendarMenu() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getGoogleSettings);
  const listCals = useServerFn(listGoogleCalendars);
  const saveSettings = useServerFn(saveGoogleSettings);

  const settingsQ = useQuery({
    queryKey: ["google-settings"],
    queryFn: () => getSettings(),
  });
  const calsQ = useQuery({
    queryKey: ["google-calendars"],
    queryFn: () => listCals(),
    staleTime: 5 * 60_000,
  });

  const current = settingsQ.data?.settings;
  const calendarId = current?.calendar_id ?? "primary";
  const syncEnabled = current?.sync_enabled ?? true;

  const saveMut = useMutation({
    mutationFn: async (patch: { calendarId?: string; syncEnabled?: boolean }) => {
      await saveSettings({
        data: {
          calendarId: patch.calendarId ?? calendarId,
          syncEnabled: patch.syncEnabled ?? syncEnabled,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-settings"] });
      toast.success("Google Calendar settings saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save settings"),
  });

  const cals = calsQ.data?.calendars ?? [];
  const calsError = calsQ.error as Error | undefined;

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <CalendarCheck className="h-4 w-4 text-primary mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium">Google Calendar sync</div>
          <div className="text-xs text-muted-foreground">
            New Bamboo events are pushed to the selected Google calendar. You can also import events from Google into Bamboo.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5">
        <div>
          <div className="text-sm font-medium">Auto-push to Google</div>
          <div className="text-[11px] text-muted-foreground">
            {syncEnabled ? "On — new events sync automatically" : "Off — events stay only in Bamboo"}
          </div>
        </div>
        <Switch
          checked={syncEnabled}
          onCheckedChange={(v) => saveMut.mutate({ syncEnabled: !!v })}
          disabled={saveMut.isPending}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Target calendar</Label>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => calsQ.refetch()}
            disabled={calsQ.isFetching}
          >
            <RefreshCw className={`h-3 w-3 ${calsQ.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Select
          value={calendarId}
          onValueChange={(v) => saveMut.mutate({ calendarId: v })}
          disabled={saveMut.isPending || calsQ.isLoading}
        >
          <SelectTrigger><SelectValue placeholder="Loading…" /></SelectTrigger>
          <SelectContent>
            {cals.length === 0 && (
              <SelectItem value="primary">Primary calendar</SelectItem>
            )}
            {cals.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.summary}{c.primary ? " (primary)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {calsError && (
          <div className="text-[11px] text-destructive">
            {calsError.message}
          </div>
        )}
      </div>

      <ImportFromGoogleDialog />

      <div className="text-[11px] text-muted-foreground">
        Per-user Google sign-in is coming soon — for now this household shares one Google account.
      </div>
    </div>
  );
}
