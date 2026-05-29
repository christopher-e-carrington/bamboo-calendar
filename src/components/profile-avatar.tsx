import type { Profile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  profile,
  size = 36,
  ring = false,
  className,
}: {
  profile: Profile;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium text-[color:var(--foreground)] shrink-0",
        ring && "ring-2 ring-offset-2 ring-offset-background ring-[color:var(--primary)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${profile.color}, color-mix(in oklab, ${profile.color} 70%, white))`,
        fontSize: size * 0.38,
      }}
      aria-label={profile.name}
    >
      <span className="text-[color:rgba(40,50,40,0.85)]">{profile.initials}</span>
    </div>
  );
}
