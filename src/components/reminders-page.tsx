import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHousehold } from "@/lib/household-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Trash2, Plus, Mail, Clock, Check } from "lucide-react";
import { toast } from "sonner";

type Channel = "app" | "email";

interface Reminder {
  id: string;
  message: string;
  recipient_profile_ids: string[];
  channels: Channel[];
  send_at: string;
  sent_at: string | null;
  created_by: string;
  created_at: string;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RemindersPage() {
  const { user } = useAuth();
  const { householdId, profiles, contacts } = useHousehold();
  const qc = useQueryClient();

  // The profile that maps to the current user
  const myProfile = useMemo(
    () => profiles.find((p) => (p as any).claimed_user_id === user?.id) ?? profiles[0],
    [profiles, user?.id],
  );

  // Selectable recipients: exclude the shared/household profile
  const selectableProfiles = useMemo(
    () => profiles.filter((p) => p.role !== "shared"),
    [profiles],
  );

  const defaultSendAt = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setSeconds(0, 0);
    return toLocalInputValue(d);
  }, []);

  const [message, setMessage] = useState("");
  const [sendAt, setSendAt] = useState(defaultSendAt);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>(["app"]);

  // Ensure the current user is preselected once profiles load
  useMemo(() => {
    if (myProfile && recipientIds.length === 0) {
      setRecipientIds([myProfile.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myProfile?.id]);

  const remindersQ = useQuery({
    queryKey: ["reminders", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Reminder[]> => {
      const { data, error } = await supabase
        .from("reminders" as never)
        .select("*")
        .order("send_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Reminder[];
    },
  });

  const addM = useMutation({
    mutationFn: async () => {
      if (!user || !householdId) throw new Error("Not signed in");
      const trimmed = message.trim();
      if (!trimmed) throw new Error("Please enter what to be reminded of");
      if (recipientIds.length === 0) throw new Error("Pick at least one person");
      if (channels.length === 0) throw new Error("Pick at least one way to send it");
      const when = new Date(sendAt);
      if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date & time");
      const { error } = await supabase.from("reminders" as never).insert({
        owner_id: householdId,
        created_by: user.id,
        message: trimmed,
        recipient_profile_ids: recipientIds,
        channels,
        send_at: when.toISOString(),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder scheduled");
      setMessage("");
      setSendAt(defaultSendAt);
      setChannels(["app"]);
      setRecipientIds(myProfile ? [myProfile.id] : []);
      qc.invalidateQueries({ queryKey: ["reminders", householdId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", householdId] });
      toast.success("Reminder deleted");
    },
  });

  const toggleRecipient = (id: string) => {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleChannel = (c: Channel) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  // Look up email/phone for a profile via the household contacts (name match).
  const lookupContact = (profileId: string) => {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return { email: null as string | null, phone: null as string | null };
    const c = contacts.find(
      (c) => c.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
    );
    return { email: c?.email ?? null, phone: c?.phone ?? null };
  };

  const channelWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (channels.includes("email")) {
      const missing = recipientIds.filter((id) => !lookupContact(id).email);
      if (missing.length) {
        const names = missing
          .map((id) => profiles.find((p) => p.id === id)?.name ?? "someone")
          .join(", ");
        warnings.push(`No email in Contacts for: ${names}`);
      }
    }
    return warnings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, recipientIds, contacts, profiles]);

  const upcoming = (remindersQ.data ?? []).filter((r) => !r.sent_at);
  const sent = (remindersQ.data ?? []).filter((r) => !!r.sent_at);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="font-display text-2xl flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Reminders
        </h1>
        <p className="text-sm text-muted-foreground">
          Schedule a reminder for yourself or someone else in the household.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Who to remind</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selectableProfiles.map((p) => {
              const checked = recipientIds.includes(p.id);
              const isMe = p.id === myProfile?.id;
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-primary/60 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleRecipient(p.id)}
                  />
                  <span
                    className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-medium text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.initials}
                  </span>
                  <span className="text-sm truncate">
                    {p.name}
                    {isMe && <span className="text-muted-foreground"> (me)</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rem-message">What is the reminder?</Label>
          <Textarea
            id="rem-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Take the trash out"
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rem-when" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> When to send it
          </Label>
          <Input
            id="rem-when"
            type="datetime-local"
            value={sendAt}
            onChange={(e) => setSendAt(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>How to send it</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ChannelToggle
              label="In-app notification"
              icon={<Bell className="h-4 w-4" />}
              checked={channels.includes("app")}
              onToggle={() => toggleChannel("app")}
            />
            <ChannelToggle
              label="Email"
              icon={<Mail className="h-4 w-4" />}
              checked={channels.includes("email")}
              onToggle={() => toggleChannel("email")}
            />
          </div>
          {channelWarnings.length > 0 && (
            <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 mt-1">
              {channelWarnings.map((w, i) => (
                <li key={i}>⚠ {w} — add it in Contacts so we can reach them.</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => addM.mutate()}
            disabled={addM.isPending}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Schedule reminder
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Upcoming ({upcoming.length})
        </h2>
        {remindersQ.isLoading ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            Loading…
          </p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            No upcoming reminders.
          </p>
        ) : (
          upcoming.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              profiles={profiles}
              onDelete={() => deleteM.mutate(r.id)}
            />
          ))
        )}

        {sent.length > 0 && (
          <>
            <h2 className="text-sm font-medium text-muted-foreground pt-4">
              Sent ({sent.length})
            </h2>
            {sent.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                profiles={profiles}
                onDelete={() => deleteM.mutate(r.id)}
                sent
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

function ChannelToggle({
  label,
  icon,
  checked,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors text-left ${
        checked
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-background hover:bg-muted/50"
      }`}
    >
      <span
        className={`h-4 w-4 rounded border grid place-items-center ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ReminderCard({
  reminder,
  profiles,
  onDelete,
  sent,
}: {
  reminder: Reminder;
  profiles: { id: string; name: string; color: string; initials: string }[];
  onDelete: () => void;
  sent?: boolean;
}) {
  const when = new Date(reminder.send_at);
  const recipients = reminder.recipient_profile_ids
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as { id: string; name: string; color: string; initials: string }[];

  const channelIcons: Record<string, React.ReactNode | undefined> = {
    app: <Bell className="h-3 w-3" />,
    email: <Mail className="h-3 w-3" />,
  };

  const displayChannels = (reminder.channels as string[]).filter((c) => c === "app" || c === "email");

  return (
    <div
      className={`rounded-xl border border-border p-3 flex gap-3 ${
        sent ? "bg-muted/40 opacity-75" : "bg-background"
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-sm">{reminder.message}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {when.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span className="flex items-center gap-1">
            {reminder.channels.map((c) => (
              <span key={c} className="inline-flex items-center gap-0.5">
                {channelIcons[c]}
              </span>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {recipients.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
            >
              <span
                className="h-3.5 w-3.5 rounded-full grid place-items-center text-[8px] font-medium text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.initials}
              </span>
              {p.name}
            </span>
          ))}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (confirm("Delete this reminder?")) onDelete();
        }}
        aria-label="Delete reminder"
        className="shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
