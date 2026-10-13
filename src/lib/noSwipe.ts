import type { PointerEventHandler } from "react";

/**
 * Spread onto a game board's outermost element (redesign, 2026-10 — see docs/redesign/).
 * - `data-no-swipe`: GameLayout's edge-swipe prev/next gesture (useEdgeSwipe) ignores a touch
 *   that starts inside an element carrying this attribute, so a drag on the board itself never
 *   gets mistaken for a page-switch swipe.
 * - `onPointerMove`: stops the pointermove event from reaching AppShell's app-root FluxLines
 *   background, which listens on `window`, so the board never drags the background's cursor-magnet
 *   around while someone's actually playing. This must be the bubble-phase prop (`onPointerMove`),
 *   not `onPointerMoveCapture`: capture fires top-down *before* the event reaches the board's own
 *   interactive descendants, so a capture-phase `stopPropagation` silently killed every board's own
 *   drag handling too (confirmed broken: Globle's drag-to-rotate, Zip's drag-to-path). Bubble-phase
 *   fires only after descendants have already handled the event, then stops it before it continues
 *   past this element up to `window`. FluxLines itself can't be taught this (no such prop), so it's
 *   done here, at the one place that knows where every board's hit area is.
 */
export const noSwipeProps: { "data-no-swipe": string; onPointerMove: PointerEventHandler } = {
  "data-no-swipe": "",
  onPointerMove: (e) => e.stopPropagation(),
};
