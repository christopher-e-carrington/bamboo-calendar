/** Blend a person's chosen color with the active view's primary so accents match every theme. */
export function tint(color: string | undefined | null): string | undefined {
  if (!color) return undefined;
  return `color-mix(in oklab, ${color} var(--profile-tint, 45%), var(--primary))`;
}
