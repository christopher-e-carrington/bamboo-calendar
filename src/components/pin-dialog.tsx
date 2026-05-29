import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";
import type { Profile } from "@/lib/profiles";

export function PinDialog({
  profile,
  open,
  onOpenChange,
  onSuccess,
}: {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin("");
      setError(false);
    }
  }, [open]);

  useEffect(() => {
    if (!profile) return;
    if (pin.length === 4) {
      if (pin === profile.pin) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 600);
      }
    }
  }, [pin, profile, onSuccess]);

  if (!profile) return null;

  const press = (n: string) => setPin((p) => (p.length < 4 ? p + n : p));
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          <ProfileAvatar profile={profile} size={64} />
          <DialogTitle className="font-display text-2xl">Welcome, {profile.name}</DialogTitle>
          <DialogDescription>Enter your 4-digit PIN to switch profile.</DialogDescription>
        </DialogHeader>

        <div className={`flex justify-center gap-3 my-2 transition-transform ${error ? "animate-pulse" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full border border-border"
              style={{
                background: i < pin.length ? "var(--primary)" : "transparent",
                borderColor: error ? "var(--destructive)" : "var(--border)",
              }}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-xl font-display" onClick={() => press(n)}>
              {n}
            </Button>
          ))}
          <div />
          <Button variant="secondary" className="h-14 text-xl font-display" onClick={() => press("0")}>
            0
          </Button>
          <Button variant="ghost" className="h-14" onClick={back} aria-label="Backspace">
            <Delete className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Demo PIN: <span className="font-mono">1234</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
