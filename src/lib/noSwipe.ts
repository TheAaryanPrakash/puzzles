import type { PointerEventHandler } from "react";

/**
 * Spread onto a game board's outermost element (redesign, 2026-10 — see docs/redesign/).
 * - `data-no-swipe`: GameLayout's edge-swipe prev/next gesture (useEdgeSwipe) ignores a touch
 *   that starts inside an element carrying this attribute, so a drag on the board itself never
 *   gets mistaken for a page-switch swipe.
 * - `onPointerMoveCapture`: stops the pointermove event from ever reaching AppShell's app-root
 *   FluxLines background, which listens on `window` — capture-phase `stopPropagation` halts the
 *   whole propagation algorithm (both the rest of capture AND the entire bubble phase back up to
 *   window), so the board never drags the background's cursor-magnet around while someone's
 *   actually playing. FluxLines itself can't be taught this (no such prop), so it's done here,
 *   at the one place that knows where every board's hit area is.
 */
export const noSwipeProps: { "data-no-swipe": string; onPointerMoveCapture: PointerEventHandler } = {
  "data-no-swipe": "",
  onPointerMoveCapture: (e) => e.stopPropagation(),
};
