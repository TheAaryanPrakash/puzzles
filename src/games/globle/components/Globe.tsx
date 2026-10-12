import { useCallback, useEffect, useRef, type PointerEvent, type WheelEvent, type KeyboardEvent } from "react";
import { geoOrthographic, geoPath, geoGraticule10 } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import { animate } from "motion";
import type { CountryFeatureCollection } from "../worldData";
import { noSwipeProps } from "../../../lib/noSwipe";

export interface GlobeProps {
  countries: CountryFeatureCollection;
  /** Fill color for one country code — unguessed, warm-scale, or the solved color. */
  fillForCode: (code: string) => string;
  className?: string;
}

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 4;
const DEFAULT_ROTATION: [number, number] = [-10, -12]; // centers roughly on Africa/Europe
const ROTATE_STEP_DEG = 8;
const ZOOM_STEP = 0.2;
const DRAG_SENSITIVITY = 0.3;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

type PointerMode = "rotate" | "pinch" | null;

/**
 * A draggable, zoomable orthographic globe on a single canvas (see RESEARCH.md — canvas over SVG
 * for drag performance once hundreds of country paths are involved). Guessing never happens by
 * tapping the globe; it's pure feedback, so it's fully usable with the mouse, touch, or a
 * keyboard (arrow keys rotate, +/- zoom, Home resets) independent of the guess input elsewhere
 * on the page.
 */
export function Globe({ countries, fillForCode, className = "" }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<[number, number]>([...DEFAULT_ROTATION]);
  const zoomRef = useRef(1);
  const sizeRef = useRef(320);
  const rafRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const modeRef = useRef<PointerMode>(null);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const size = sizeRef.current;

    const scale = (size / 2 - 4) * zoomRef.current;
    const projection = geoOrthographic()
      .translate([size / 2, size / 2])
      .scale(Math.max(1, scale))
      .rotate(rotationRef.current)
      .clipAngle(90);
    const path = geoPath(projection, ctx);

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    path({ type: "Sphere" } as GeoPermissibleObjects);
    ctx.fillStyle = cssVar("--globle-ocean", "#0b1026");
    ctx.fill();

    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = cssVar("--globle-graticule", "#1f2a52");
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const outline = cssVar("--globle-outline", "#0b1026");
    for (const country of countries.features) {
      ctx.beginPath();
      path(country as unknown as GeoPermissibleObjects);
      ctx.fillStyle = fillForCode(country.properties.iso_a2);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }, [countries, fillForCode]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // Resize the canvas (and its backing store, for devicePixelRatio) to fill its container.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const size = Math.max(200, Math.min(container.clientWidth, 520));
      sizeRef.current = size;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      scheduleDraw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scheduleDraw]);

  // Redraw whenever the guesses (and so `fillForCode`) change.
  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw]);

  // One-time gentle spin to rest, skipped entirely under prefers-reduced-motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const start: [number, number] = [DEFAULT_ROTATION[0] - 60, DEFAULT_ROTATION[1]];
    rotationRef.current = start;
    const controls = animate(start[0], DEFAULT_ROTATION[0], {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (lambda) => {
        rotationRef.current = [lambda, rotationRef.current[1]];
        scheduleDraw();
      },
    });
    return () => controls.stop();
    // Intro only — deliberately not re-run when scheduleDraw's identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rotateBy(dLambda: number, dPhi: number) {
    const [lambda, phi] = rotationRef.current;
    rotationRef.current = [lambda + dLambda, Math.max(-90, Math.min(90, phi + dPhi))];
    scheduleDraw();
  }

  function zoomBy(factor: number) {
    zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * factor));
    scheduleDraw();
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      modeRef.current = "rotate";
    } else if (pointersRef.current.size === 2) {
      modeRef.current = "pinch";
      pinchStartRef.current = { dist: pinchDistance(), zoom: zoomRef.current };
    }
  }

  function pinchDistance(): number {
    const [a, b] = [...pointersRef.current.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    const prev = pointersRef.current.get(e.pointerId)!;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (modeRef.current === "rotate" && pointersRef.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const sensitivity = DRAG_SENSITIVITY / zoomRef.current;
      rotateBy(dx * sensitivity, -dy * sensitivity);
    } else if (modeRef.current === "pinch" && pinchStartRef.current) {
      const dist = pinchDistance();
      if (dist > 0 && pinchStartRef.current.dist > 0) {
        const ratio = dist / pinchStartRef.current.dist;
        zoomRef.current = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, pinchStartRef.current.zoom * ratio),
        );
        scheduleDraw();
      }
    }
  }

  function endPointer(e: PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 1) {
      modeRef.current = "rotate";
    } else if (pointersRef.current.size === 0) {
      modeRef.current = null;
    }
  }

  function handleWheel(e: WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    zoomBy(1 - e.deltaY * 0.001);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    switch (e.key) {
      case "ArrowLeft":
        rotateBy(-ROTATE_STEP_DEG, 0);
        break;
      case "ArrowRight":
        rotateBy(ROTATE_STEP_DEG, 0);
        break;
      case "ArrowUp":
        rotateBy(0, ROTATE_STEP_DEG);
        break;
      case "ArrowDown":
        rotateBy(0, -ROTATE_STEP_DEG);
        break;
      case "+":
      case "=":
        zoomBy(1 + ZOOM_STEP);
        break;
      case "-":
      case "_":
        zoomBy(1 - ZOOM_STEP);
        break;
      case "Home":
        rotationRef.current = [...DEFAULT_ROTATION];
        zoomRef.current = 1;
        scheduleDraw();
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      className={`mx-auto aspect-square w-full max-w-[520px] ${className}`}
      {...noSwipeProps}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive globe showing the proximity of each guess. Drag to rotate, scroll or pinch to zoom, or use the arrow keys and +/- when focused."
        tabIndex={0}
        className="touch-none rounded-brand-full outline-none focus-visible:ring-2 focus-visible:ring-game-accent"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
