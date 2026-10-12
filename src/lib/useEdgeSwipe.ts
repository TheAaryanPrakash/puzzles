import { useEffect, useRef } from "react";

const EDGE_PX = 24;
const MIN_DISTANCE_PX = 60;
const MAX_OFF_AXIS_PX = 50;
const MAX_DURATION_MS = 600;

/**
 * Calls `onPrev`/`onNext` when the member drags a touch in from within ~24px of the left/right
 * screen edge (redesign, 2026-10 — brief's GameLayout header item). A touch that starts on an
 * element carrying `data-no-swipe` (every game board, see `noSwipe.ts`) is ignored entirely, so
 * dragging on the board itself is never mistaken for a page-switch gesture.
 */
export function useEdgeSwipe(onPrev: () => void, onNext: () => void): void {
  const prevRef = useRef(onPrev);
  const nextRef = useRef(onNext);
  prevRef.current = onPrev;
  nextRef.current = onNext;

  useEffect(() => {
    let tracking: { startX: number; startY: number; startT: number; edge: "left" | "right" } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = null;
        return;
      }
      const target = e.target as Element | null;
      if (target?.closest("[data-no-swipe]")) {
        tracking = null;
        return;
      }
      const touch = e.touches[0];
      const edge: "left" | "right" | null =
        touch.clientX <= EDGE_PX
          ? "left"
          : touch.clientX >= window.innerWidth - EDGE_PX
            ? "right"
            : null;
      if (!edge) {
        tracking = null;
        return;
      }
      tracking = { startX: touch.clientX, startY: touch.clientY, startT: performance.now(), edge };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const { startX, startY, startT, edge } = tracking;
      tracking = null;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = performance.now() - startT;
      if (dt > MAX_DURATION_MS || Math.abs(dy) > MAX_OFF_AXIS_PX) return;
      if (edge === "left" && dx > MIN_DISTANCE_PX) prevRef.current();
      else if (edge === "right" && dx < -MIN_DISTANCE_PX) nextRef.current();
    };

    const onTouchCancel = () => {
      tracking = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);
}
