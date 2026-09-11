import { useRef } from "react";

type Options = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Ignore swipes that begin inside an element matching this selector. */
  ignoreSelector?: string;
  minDistance?: number;
};

/** Horizontal swipe detection for touch devices. Spread the result onto an element. */
export function useSwipe({ onSwipeLeft, onSwipeRight, ignoreSelector, minDistance = 50 }: Options) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const end = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (ignoreSelector && (e.target as HTMLElement)?.closest?.(ignoreSelector)) {
      start.current = null;
      return;
    }
    end.current = null;
    start.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    end.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchEnd = () => {
    const s = start.current;
    const t = end.current;
    start.current = null;
    end.current = null;
    if (!s || !t) return;
    const dx = s.x - t.x;
    const dy = s.y - t.y;
    if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}
