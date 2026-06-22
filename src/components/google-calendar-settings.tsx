import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CalendarPlus, Check, Loader2, Link as LinkIcon, Unlink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useHousehold, type Profile } from "@/lib/household-store";
import { ProfileAvatar } from "./profile-avatar";
import {
  startProfileGoogleOAuth,
  listProfileGoogleConnections,
  disconnectProfileGoogle,
  updateProfileGoogleSettings,
  listProfileGoogleCalendars,
  listUpcomingProfileGoogleEvents,
  importProfileGoogleEvent,
} from "@/lib/google-calendar.functions";

function fmtWhen(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type Connection = {
  id: string;
  profile_id: string;
  google_email: string | null;
  calendar_id: string;
  sync_enabled: boolean;
};

function ImportDialog({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(listUpcomingProfileGoogleEvents);
  const importFn = useServerFn(importProfileGoogleEvent);

  const q = useQuery({
    queryKey: ["google-upcoming", profile.id],
    queryFn: () => listFn({ data: { profileId: profile.id } }),
    enabled: open,
    staleTime: 30_000,
  });

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const doImport = async () => {
    if (picked.size === 0) return;
    setBusy(true);
    try {
      let ok = 0;
      for (const gid of picked) {
        try {
          await importFn({ data: { profileId: profile.id, googleEventId: gid } });
          ok += 1;
        } catch (e) { console.error(e); }
      }
      toast.success(`Imported ${ok} event${ok === 1 ? "" : "s"}`);
      setPicked(new Set());
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["google-upcoming", profile.id] });
      setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
          <CalendarPlus className="h-3.5 w-3.5" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import for {profile.name}</DialogTitle>
          <DialogDescription>Upcoming events from this profile's Google calendar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 overflow-y-auto pr-1">
          {q.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {q.error && <div className="text-sm text-destructive">{(q.error as Error).message}</div>}
          {q.data && q.data.events.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">No upcoming events.</div>
          )}
          {q.data?.events.filter((e) => !e.alreadyLinked).map((e) => (
            <label key={e.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2 cursor-pointer hover:border-primary/40">
              <Checkbox checked={picked.has(e.id)} onCheckedChange={() => toggle(e.id)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.title}</div>
                <div className="text-[11px] text-muted-foreground">{fmtWhen(e.start)}</div>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={doImport} disabled={busy || picked.size === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Import {picked.size > 0 ? `(${picked.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectedRow({ profile, conn }: { profile: Profile; conn: Connection }) {
  const qc = useQueryClient();
  const listCalsFn = useServerFn(listProfileGoogleCalendars);
  const saveFn = useServerFn(updateProfileGoogleSettings);
  const disconnectFn = useServerFn(disconnectProfileGoogle);

  const calsQ = useQuery({
    queryKey: ["google-cals", profile.id],
    queryFn: () => listCalsFn({ data: { profileId: profile.id } }),
    staleTime: 5 * 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (patch: { calendarId?: string; syncEnabled?: boolean }) =>
      saveFn({ data: { profileId: profile.id, ...patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-connections"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectFn({ data: { profileId: profile.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-connections"] });
      toast.success("Disconnected");
    },
  });

  return (
    <div className="rounded-lg border border-border bg-background p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <ProfileAvatar profile={profile} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{profile.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{conn.google_email ?? "Connected"}</div>
        </div>
        <Switch
          checked={conn.sync_enabled}
          onCheckedChange={(v) => saveMut.mutate({ syncEnabled: !!v })}
          disabled={saveMut.isPending}
        />
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={conn.calendar_id}
          onValueChange={(v) => saveMut.mutate({ calendarId: v })}
          disabled={saveMut.isPending || calsQ.isLoading}
        >
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Loading…" /></SelectTrigger>
          <SelectContent>
            {(calsQ.data?.calendars ?? [{ id: conn.calendar_id, summary: "Primary", primary: true }]).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.summary}{c.primary ? " (primary)" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ImportDialog profile={profile} />
        <Button
          size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive"
          onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}
          aria-label="Disconnect"
        >
          <Unlink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DisconnectedRow({ profile }: { profile: Profile }) {
  const startFn = useServerFn(startProfileGoogleOAuth);
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await startFn({ data: { profileId: profile.id, origin: window.location.origin } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start sign-in");
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
      <ProfileAvatar profile={profile} size={28} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{profile.name}</div>
        <div className="text-[11px] text-muted-foreground">Not connected</div>
      </div>
      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={connect} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
        Connect
      </Button>
    </div>
  );
}

export function GoogleCalendarMenu() {
  const { profiles } = useHousehold();
  const qc = useQueryClient();
  const listFn = useServerFn(listProfileGoogleConnections);
  const connsQ = useQuery({
    queryKey: ["google-connections"],
    queryFn: () => listFn(),
  });

  const byProfile = new Map<string, Connection>();
  for (const c of (connsQ.data?.connections ?? [])) byProfile.set(c.profile_id, c as Connection);

  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <CalendarCheck className="h-4 w-4 text-primary mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium">Per-profile Google Calendar</div>
          <div className="text-xs text-muted-foreground">
            Each profile signs into their own Google account. Bamboo events assigned to them push to that calendar.
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => qc.invalidateQueries({ queryKey: ["google-connections"] })}>
          <RefreshCw className={`h-3 w-3 ${connsQ.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-2">
        {profiles.map((p) => {
          const conn = byProfile.get(p.id);
          return conn
            ? <ConnectedRow key={p.id} profile={p} conn={conn} />
            : <DisconnectedRow key={p.id} profile={p} />;
        })}
      </div>
    </div>
  );
}
