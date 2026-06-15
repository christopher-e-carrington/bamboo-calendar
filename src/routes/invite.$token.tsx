import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { signupFromInvite } from "@/lib/invite.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [{ title: "You're invited — Bamboo" }],
  }),
  component: InvitePage,
});

type Invitation = {
  id: string;
  household_id: string;
  invited_email: string | null;
  invited_name: string | null;
  status: string;
  expires_at: string;
  household_name: string | null;
};

const SignupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const AcceptSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  birthday: z.string().optional().or(z.literal("")),
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const inviteQ = useQuery({
    queryKey: ["invite", token],
    queryFn: async (): Promise<Invitation | null> => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { _token: token });
      if (error) throw error;
      const row = (data as Invitation[] | null)?.[0];
      return row ?? null;
    },
  });

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [birthday, setBirthday] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (inviteQ.data) {
      if (inviteQ.data.invited_email && !email) setEmail(inviteQ.data.invited_email);
      if (inviteQ.data.invited_name && !name) setName(inviteQ.data.invited_name);
    }
  }, [inviteQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const signupFn = useServerFn(signupFromInvite);

  const doAuth = async () => {
    const parsed = SignupSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setAuthBusy(true);
    try {
      if (mode === "signup") {
        // Create the user pre-confirmed on the server so we can sign in
        // immediately, regardless of project-level email confirmation settings.
        await signupFn({ data: { token, email, password } });
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        toast.success("Account created — finish your profile below");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const accept = async () => {
    const parsed = AcceptSchema.safeParse({ name, phone, address, birthday });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setAccepting(true);
    try {
      // Confirm we actually have a session — accept_invitation requires
      // auth.uid(); without it the RPC throws "Not authenticated".
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("You're not signed in. Create your account above, then try again.");
        return;
      }

      const { data, error } = await supabase.rpc("accept_invitation", {
        _token: token,
        _name: parsed.data.name,
        _phone: parsed.data.phone || undefined,
        _address: parsed.data.address || undefined,
        _birthday: parsed.data.birthday || undefined,
        _email: email || undefined,
      });
      if (error) {
        console.error("[invite] accept_invitation error:", error);
        throw error;
      }
      console.log("[invite] joined household:", data);
      toast.success("Welcome to the household 🌿");
      navigate({ to: "/" });
    } catch (e) {
      console.error("[invite] accept failed:", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String((e as { message: unknown }).message)
            : "Could not accept invitation";
      toast.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  if (loading || inviteQ.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Leaf className="h-5 w-5 mr-2 animate-pulse text-primary" /> Loading invite…
      </div>
    );
  }

  if (!inviteQ.data) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl mb-2">Invitation not found</h1>
          <p className="text-sm text-muted-foreground mb-4">
            This invite link may have expired, been revoked, or already been used.
          </p>
          <Button onClick={() => navigate({ to: "/" })}>Go home</Button>
        </div>
      </div>
    );
  }

  const inv = inviteQ.data;
  const householdName = inv.household_name ?? "this household";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="font-display text-xl">Bamboo</span>
        </div>

        <h1 className="font-display text-3xl mb-1">You're invited</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Join <span className="font-medium text-foreground">{householdName}</span> on the shared
          calendar.
        </p>

        {!user ? (
          <div className="bamboo-card p-5 space-y-3">
            <h2 className="font-medium">
              {mode === "signup" ? "Create your account" : "Sign in"}
            </h2>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <Button onClick={doAuth} disabled={authBusy} className="w-full">
              {authBusy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                className="text-primary font-medium hover:underline"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create account"}
              </button>
            </p>
          </div>
        ) : (
          <div className="bamboo-card p-5 space-y-3">
            <h2 className="font-medium">Tell us a little about yourself</h2>
            <p className="text-xs text-muted-foreground -mt-2">
              This creates your profile and contact entry in the household.
            </p>
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <Button onClick={accept} disabled={accepting} className="w-full">
              {accepting ? "Joining…" : "Join household"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
