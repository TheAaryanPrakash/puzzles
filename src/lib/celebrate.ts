import confetti from "canvas-confetti";

/** The one confetti burst for a win, shared by every game via `completeGame`. */
export function celebrate(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  void confetti({
    particleCount: 140,
    spread: 75,
    startVelocity: 45,
    origin: { y: 0.65 },
  });
}
