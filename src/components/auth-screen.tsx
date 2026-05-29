import { useState, type FormEvent } from "react";
import { Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import bambooHero from "@/assets/bamboo-hero.jpg";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome to Bamboo", { description: "Setting up your household…" });
      }
    } catch (err) {
      toast.error("Authentication failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed", { description: String(result.error) });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex relative overflow-hidden items-center justify-center bg-[color:var(--bamboo-light)]/40">
        <img
          src={bambooHero}
          alt="Watercolor bamboo illustration"
          className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-90"
          width={1024}
          height={1280}
        />
        <div className="relative z-10 max-w-md px-10 text-foreground">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3 py-1 text-xs font-medium">
            <Leaf className="h-3.5 w-3.5 text-primary" /> Bamboo
          </div>
          <h1 className="font-display text-4xl mt-5 leading-tight">
            A calm home for your family's days.
          </h1>
          <p className="text-muted-foreground mt-3">
            One shared calendar. Quiet greens, warm wood. Switch between Mom, Dad, kids, or
            the kitchen with a tap.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Leaf className="h-5 w-5" />
            </div>
            <span className="font-display text-xl">Bamboo</span>
          </div>

          <h2 className="font-display text-3xl">
            {mode === "signin" ? "Welcome back" : "Plant your household"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === "signin"
              ? "Sign in to your household account."
              : "Create the master account that holds all your profiles."}
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-6 gap-2"
            onClick={google}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.46-1.74 4.28-5.5 4.28-3.32 0-6.02-2.74-6.02-6.12S8.68 6.14 12 6.14c1.88 0 3.14.8 3.86 1.48l2.64-2.54C16.86 3.6 14.66 2.7 12 2.7 6.94 2.7 2.84 6.8 2.84 11.86c0 5.06 4.1 9.16 9.16 9.16 5.28 0 8.78-3.7 8.78-8.92 0-.6-.06-1.06-.14-1.5H12z" />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@home.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-5">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
