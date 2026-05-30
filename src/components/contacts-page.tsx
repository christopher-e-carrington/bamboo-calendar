import { useState } from "react";
import { useHousehold, type Contact } from "@/lib/household-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Cake, Mail, MapPin, Phone, Plus, Trash2, UserRound, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  birthday: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function formatBirthday(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function ContactFormDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  initial?: Contact;
  onSave: (input: z.infer<typeof ContactSchema>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    birthday: initial?.birthday ?? "",
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = ContactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed.data);
      toast.success(initial ? "Contact updated" : "Contact added 🌱");
      setOpen(false);
      if (!initial) {
        setForm({ name: "", address: "", phone: "", email: "", birthday: "", notes: "" });
      }
    } catch {
      toast.error("Could not save contact");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            {initial ? "Edit contact" : "New contact"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="c-name" className="text-xs">Name</Label>
            <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-phone" className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
            </div>
            <div>
              <Label htmlFor="c-email" className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
            </div>
          </div>
          <div>
            <Label htmlFor="c-addr" className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</Label>
            <Input id="c-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} />
          </div>
          <div>
            <Label htmlFor="c-bday" className="text-xs flex items-center gap-1"><Cake className="h-3 w-3" /> Birthday</Label>
            <Input id="c-bday" type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">Birthdays sync as a yearly event on your shared calendar.</p>
          </div>
          <div>
            <Label htmlFor="c-notes" className="text-xs">Notes</Label>
            <Textarea id="c-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={1000} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.name.trim() || busy} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            {busy ? "Saving…" : initial ? "Save" : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactsPage() {
  const { contacts, addContact, updateContact, deleteContact, loading } = useHousehold();
  const [query, setQuery] = useState("");

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.email, c.phone, c.address].some((v) => v && v.toLowerCase().includes(q));
  });

  return (
    <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-5xl mx-auto w-full">
      <header className="bamboo-card overflow-hidden mb-6 relative">
        <div className="absolute inset-y-0 left-0 w-1.5 bamboo-stripe" />
        <div className="p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {contacts.length} {contacts.length === 1 ? "person" : "people"} in your address book
            </p>
          </div>
          <ContactFormDialog
            trigger={
              <Button className="rounded-full gap-1.5 self-start sm:self-center">
                <Plus className="h-4 w-4" /> New contact
              </Button>
            }
            onSave={(data) =>
              addContact({
                name: data.name,
                address: data.address || null,
                phone: data.phone || null,
                email: data.email || null,
                birthday: data.birthday || null,
                notes: data.notes || null,
              })
            }
          />
        </div>
      </header>

      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="pl-9"
          maxLength={100}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bamboo-card p-10 text-center text-sm text-muted-foreground">
          {contacts.length === 0 ? "Plant your first contact above." : "No matches."}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <li key={c.id} className="bamboo-card p-4 group">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground grid place-items-center font-medium shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.name}</span>
                    {c.birthday && (
                      <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Cake className="h-2.5 w-2.5" />
                        {formatBirthday(c.birthday)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {c.phone && (
                      <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</div>
                    )}
                    {c.address && (
                      <div className="flex items-center gap-1.5 truncate"><MapPin className="h-3 w-3" />{c.address}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ContactFormDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="text-xs h-7">Edit</Button>
                    }
                    initial={c}
                    onSave={(data) =>
                      updateContact(c.id, {
                        name: data.name,
                        address: data.address || null,
                        phone: data.phone || null,
                        email: data.email || null,
                        birthday: data.birthday || null,
                        notes: data.notes || null,
                      })
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete contact">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {c.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This also removes their birthday from the shared calendar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await deleteContact(c.id);
                              toast.success("Contact removed");
                            } catch {
                              toast.error("Could not delete");
                            }
                          }}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
