import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import FluxLines from "./fx/FluxLines";

function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false),
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Degrades to a still frame (via FluxLines' own `paused`) if our own rAF cadence drops below
 * ~30fps for a sustained ~2s. FluxLines runs its own internal RAF loop that isn't exposed to the
 * outside, so this is an independent watchdog loop running alongside it as a proxy for overall
 * page frame health — good enough to catch "this device is struggling," which is all the brief
 * asks for, without needing to instrument FluxLines itself.
 */
function useFrameWatchdog(enabled: boolean): boolean {
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!enabled || degraded) return undefined;
    let raf = 0;
    let last = performance.now();
    let badMs = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      // A dropped-frame budget that leaks back down when frames recover, so one hitch doesn't
      // trip it, but a sustained ~2s of sub-30fps does.
      badMs = dt > 33 ? badMs + dt : Math.max(0, badMs - dt * 2);
      if (badMs > 2000) {
        setDegraded(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, degraded]);

  return degraded;
}

/**
 * Mounted once at the route root (see routes.tsx) so FluxLines never remounts on navigation.
 * "Calm" mode (slower, dimmer, weaker cursor pull) applies on any `/[gameId]` page; the hub and
 * other site pages get the full effect. Falls back to a static gradient — no canvas, no RAF — only
 * when WebGL2 isn't available at all. `prefers-reduced-motion` and the frame-rate watchdog tripping
 * instead pass `paused` to FluxLines itself: the canvas stays mounted but freezes on its last frame
 * and its own RAF loop self-terminates once settled (confirmed live — `requestAnimationFrame` stops
 * firing within a tick of `paused` becoming true), which is cheaper than remounting a fresh gradient
 * element and avoids a visible swap.
 */
export function AppShell({ gameIds }: { gameIds: string[] }) {
  const location = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const [webgl2, setWebgl2] = useState(false);
  useEffect(() => setWebgl2(supportsWebGL2()), []);
  const degraded = useFrameWatchdog(webgl2 && !reducedMotion);

  const gameIdSet = useMemo(() => new Set(gameIds), [gameIds]);
  const onGamePage = gameIdSet.has(location.pathname.split("/")[1] ?? "");
  const stillFrame = reducedMotion || degraded;

  return (
    <div className="relative min-h-screen">
      {/* No negative z-index here on purpose: position:fixed + z-index:-10 is a known browser
          compositing gotcha — it can render behind the document's own base paint layer entirely
          (verified: canvas drew correctly per readPixels, but was 100% invisible in every
          screenshot regardless of the page content's background opacity). Being the first child
          in DOM order, at the default z-index:auto, already paints it behind every later sibling
          — no z-index needed at all. */}
      {webgl2 ? (
        <div className="pointer-events-none fixed inset-0">
          <FluxLines
            colors={["#df497b", "#f47ba3", "#f986ac"]}
            backgroundColor="#130b0e"
            transparent={false}
            speed={onGamePage ? 0.18 : 0.5}
            mouseStrength={onGamePage ? 0.35 : 1}
            mouseRadius={0.3}
            glow={onGamePage ? 1.3 : 2}
            shimmer={onGamePage ? 0.9 : 1.5}
            paused={stillFrame}
            dpr={typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2)}
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          role="presentation"
          className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#271b1f,_#130b0e_70%)]"
        />
      )}
      {/* `relative` (not just a plain wrapper) is load-bearing, not decorative: CSS paints
          "positioned" elements (anything with a non-static position, even z-index:auto — which
          `fixed` always is) in a later phase than normal in-flow siblings, REGARDLESS of DOM
          order. FluxLines above is `fixed`, so without this, it paints on top of any page that
          doesn't happen to position something of its own — confirmed broken for GameLayout
          (completely invisible header/content, verified by forcing `position:relative` on it in
          isolation and watching the page reappear) while Hub accidentally escaped it only because
          MagicBento's tilt/glow effects already use transforms. This wrapper makes every routed
          page safe by construction instead of relying on each one to discover this by accident. */}
      <div className="relative">
        <Outlet />
      </div>
    </div>
  );
}
