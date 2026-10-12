// Adapted from React Bits (https://reactbits.dev/components/magic-bento) — MIT + Commons Clause
// License Condition v1.0, Copyright (c) 2026 David Haz. See docs/redesign/HANDOFF.md.
'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from 'react';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface MagicBentoItem {
  id?: string | number;
  label?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  image?: string;
  content?: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  colSpan?: number;
  rowSpan?: number;
}

export interface MagicBentoProps {
  items?: MagicBentoItem[];
  columns?: number;
  rowHeight?: number;
  gap?: number;
  radius?: number;
  theme?: 'dark' | 'light';
  glowColor?: string;
  textAutoHide?: boolean;
  enableBorderGlow?: boolean;
  enableSpotlight?: boolean;
  spotlightRadius?: number;
  enableStars?: boolean;
  particleCount?: number;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  intro?: boolean;
  disableAnimations?: boolean;
  onItemClick?: (item: MagicBentoItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
}

interface Settings {
  items: MagicBentoItem[];
  columns: number;
  gap: number;
  enableBorderGlow: boolean;
  enableSpotlight: boolean;
  spotlightRadius: number;
  enableStars: boolean;
  particleCount: number;
  enableTilt: boolean;
  enableMagnetism: boolean;
  clickEffect: boolean;
  intro: boolean;
  disableAnimations: boolean;
  onItemClick?: (item: MagicBentoItem, index: number) => void;
  glow: number[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  rate: number;
}

interface CardState {
  hot: number;
  rx: number;
  ry: number;
  tx: number;
  ty: number;
  vrx: number;
  vry: number;
  vtx: number;
  vty: number;
  press: number;
  vpress: number;
  stars: number;
  particles: Particle[] | null;
  active: boolean;
  drawn?: boolean;
  written: Record<string, string>;
}

type Spring = ['rx' | 'ry' | 'tx' | 'ty', 'vrx' | 'vry' | 'vtx' | 'vty'];

const THEMES: Record<'dark' | 'light', Record<string, string | number>> = {
  dark: {
    '--mb-surface': 'linear-gradient(180deg, #1a1820 0%, #121116 100%)',
    '--mb-edge': 'rgba(255, 255, 255, 0.07)',
    '--mb-highlight': 'rgba(255, 255, 255, 0.06)',
    '--mb-shadow': '0 24px 48px -28px rgba(0, 0, 0, 0.85), 0 8px 18px -12px rgba(0, 0, 0, 0.6)',
    '--mb-tile': 'linear-gradient(180deg, #3a3644 0%, #27242f 100%)',
    '--mb-tile-edge': 'rgba(255, 255, 255, 0.07)',
    '--mb-tile-highlight': 'rgba(255, 255, 255, 0.12)',
    '--mb-tile-shadow': '0 4px 10px -4px rgba(0, 0, 0, 0.7)',
    '--mb-well': 'rgba(255, 255, 255, 0.03)',
    '--mb-well-edge': 'rgba(255, 255, 255, 0.06)',
    '--mb-ink': '#f4f4f5',
    '--mb-muted': 'rgba(244, 244, 245, 0.6)',
    '--mb-faint': 'rgba(244, 244, 245, 0.3)',
    '--mb-line': 'rgba(244, 244, 245, 0.1)',
    '--mb-secondary': '#a1a1aa',
    '--mb-secondary-ink': '#121016',
    '--mb-cursor-stroke': 'rgba(18, 16, 22, 0.9)',
    '--mb-ring': 'rgba(18, 16, 22, 0.85)',
    '--mb-focus': 'rgba(244, 244, 245, 0.5)',
    '--mb-glow-alpha': 0.85,
    '--mb-spot-alpha': 0.07
  },
  light: {
    '--mb-surface': 'linear-gradient(180deg, #ffffff 0%, #f7f7f9 100%)',
    '--mb-edge': 'rgba(24, 24, 27, 0.08)',
    '--mb-highlight': 'rgba(255, 255, 255, 1)',
    '--mb-shadow': '0 24px 48px -30px rgba(24, 24, 27, 0.28), 0 8px 18px -14px rgba(24, 24, 27, 0.16)',
    '--mb-tile': 'linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)',
    '--mb-tile-edge': 'rgba(24, 24, 27, 0.08)',
    '--mb-tile-highlight': 'rgba(255, 255, 255, 1)',
    '--mb-tile-shadow': '0 4px 10px -5px rgba(24, 24, 27, 0.22)',
    '--mb-well': 'rgba(24, 24, 27, 0.025)',
    '--mb-well-edge': 'rgba(24, 24, 27, 0.06)',
    '--mb-ink': '#18181b',
    '--mb-muted': 'rgba(24, 24, 27, 0.6)',
    '--mb-faint': 'rgba(24, 24, 27, 0.3)',
    '--mb-line': 'rgba(24, 24, 27, 0.08)',
    '--mb-secondary': '#71717a',
    '--mb-secondary-ink': '#ffffff',
    '--mb-cursor-stroke': '#ffffff',
    '--mb-ring': '#ffffff',
    '--mb-focus': 'rgba(24, 24, 27, 0.4)',
    '--mb-glow-alpha': 0.5,
    '--mb-spot-alpha': 0.035
  }
};

const INK: Record<'dark' | 'light', number[]> = { dark: [244, 244, 245], light: [24, 24, 27] };
const MIN_CELL = 150;
const MIN_PAIR = 200;
const STAGGER = 80;
const TILT = 6;
const MAGNET = 6;

const ROOT_CLASS =
  'magic-bento relative box-border grid w-full [grid-auto-flow:row_dense] text-[color:var(--mb-ink)] [-webkit-tap-highlight-color:transparent]';
const CELL_CLASS = 'magic-bento__cell relative min-h-0 min-w-0 [--mb-delay:0ms]';
const CARD_CLASS =
  'magic-bento__card relative box-border isolate flex h-full w-full select-none flex-col overflow-hidden rounded-[var(--mb-radius)] text-[color:var(--mb-ink)] no-underline outline-none [background:var(--mb-surface)] [box-shadow:var(--mb-shadow)] [transform:perspective(900px)_translate3d(var(--mb-tx,0px),var(--mb-ty,0px),0)_rotateX(var(--mb-rx,0deg))_rotateY(var(--mb-ry,0deg))_scale(var(--mb-press,1))] data-[clickable]:cursor-pointer focus-visible:[box-shadow:var(--mb-shadow),0_0_0_2px_var(--mb-focus)]';
const IMAGE_CLASS = 'pointer-events-none absolute inset-0 z-0 h-full w-full object-cover';
const SCRIM_CLASS = 'pointer-events-none absolute inset-0 z-0';
const LIGHT_CLASS = 'pointer-events-none absolute inset-0 z-[1] rounded-[inherit]';
const STARS_CLASS = 'pointer-events-none absolute inset-0 z-[1] block h-full w-full';
const RIM_CLASS =
  'pointer-events-none absolute inset-0 z-[3] rounded-[inherit] [box-shadow:inset_0_0_0_1px_var(--mb-edge),inset_0_1px_0_var(--mb-highlight)]';
const BORDER_CLASS = 'pointer-events-none absolute inset-0 z-[4] box-border rounded-[inherit] p-px';
const CONTENT_CLASS = 'relative z-[2] box-border flex min-h-0 flex-1 flex-col gap-3 p-[var(--mb-pad)]';
const HEADER_CLASS =
  'flex min-w-0 items-center gap-2 text-[12px] leading-4 font-medium text-[color:var(--mb-muted)] [[data-image]_&]:text-[rgba(244,244,245,0.72)]';
const ICON_CLASS =
  'grid h-4 w-4 flex-none place-items-center text-[color:var(--mb-ink)] [[data-image]_&]:text-[#f4f4f5]';
const LABEL_CLASS = 'overflow-hidden text-ellipsis whitespace-nowrap';
const TEXT_CLASS = 'mt-auto flex flex-col gap-1';
const TITLE_CLASS =
  'm-0 text-[15px] leading-5 font-semibold tracking-[-0.01em] text-[color:var(--mb-ink)] [[data-image]_&]:text-[#f4f4f5] [[data-autohide]_&]:line-clamp-1';
const DESCRIPTION_CLASS =
  'm-0 text-[13px] leading-[1.45] text-[color:var(--mb-muted)] [[data-image]_&]:text-[rgba(244,244,245,0.72)] [[data-autohide]_&]:line-clamp-2';
const SCRIM_STYLE: CSSProperties = {
  background:
    'linear-gradient(to top, rgba(10, 9, 13, 0.82) 0%, rgba(10, 9, 13, 0.7) 14%, rgba(10, 9, 13, 0.46) 30%, rgba(10, 9, 13, 0.2) 46%, rgba(10, 9, 13, 0.05) 60%, rgba(10, 9, 13, 0) 72%)'
};

const FALLOFF = [1, 0.973, 0.837, 0.593, 0.317, 0.104, 0.009];

const glowStops = (alpha: string, weight: string) =>
  `${FALLOFF.map(
    (fall, index) => `rgba(var(--mb-glow-rgb), calc(var(${alpha}) * var(${weight}, 0) * ${fall})) ${index * 15}%`
  ).join(', ')}, rgba(var(--mb-glow-rgb), 0) 100%`;

const LIGHT_STYLE: CSSProperties = {
  background: `radial-gradient(var(--mb-spot-size) circle at var(--mb-x, -999px) var(--mb-y, -999px), ${glowStops('--mb-spot-alpha', '--mb-hot')})`
};

const WAVE: [string, string][] = [
  ['0', '110px'],
  ['0.1', '80px'],
  ['0.32', '52px'],
  ['0.68', '28px'],
  ['0.94', '10px'],
  ['1', '3px']
];

const BORDER_STYLE: CSSProperties = {
  background: `radial-gradient(var(--mb-border-size) circle at var(--mb-x, -999px) var(--mb-y, -999px), ${glowStops('--mb-glow-alpha', '--mb-near')}), radial-gradient(circle at var(--mb-wx, -999px) var(--mb-wy, -999px), ${WAVE.map(
    ([alpha, offset]) =>
      `rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-wa, 0) * ${alpha})) calc(var(--mb-wr, 0px) - ${offset})`
  ).join(', ')}, rgba(var(--mb-glow-rgb), 0) var(--mb-wr, 0px))`,
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)'
};

const STYLE = `
.magic-bento{--mb-spring:cubic-bezier(0.34, 1.4, 0.64, 1)}
@supports (transition-timing-function: linear(0,1)){.magic-bento{--mb-spring: linear( 0,0.0603,0.2033,0.3821,0.5633,0.7258,0.8584,0.9574,1.0242,1.0634,1.0809,1.0828,1.0747,1.0613,1.046,1.0313,1.0186,1.0085,1.0012,0.9965,0.994,0.9931,0.9933,0.9941,0.9953,0.9966,0.9978,0.9988,1 )}}
.magic-bento[data-intro] .magic-bento__cell{opacity: 0;transform: translate3d(0,16px,0) scale(0.97)}
.magic-bento[data-intro] .magic-bento__cell[data-state='in']{opacity: 1;transform: none;transition: opacity 420ms cubic-bezier(0.22,1,0.36,1) var(--mb-delay),transform 760ms var(--mb-spring) var(--mb-delay)}
@container (max-height: 78px){.magic-bento__setting ~ .magic-bento__setting{display: none}}
@container (max-height: 60px){.magic-bento__hub{display: none}}
@container (max-height: 38px){.magic-bento__shield,.magic-bento__chart,.magic-bento__bars{visibility: hidden}}
.magic-bento__switch{position: relative;width: 26px;height: 16px;flex: none;margin-left: auto;border-radius: 8px;background: rgb(var(--mb-accent-rgb));transition: background-color 220ms ease}
.magic-bento__switch::after{content: '';position: absolute;top: 2px;left: 2px;width: 12px;height: 12px;border-radius: 50%;background: var(--mb-accent-ink);box-shadow: 0 1px 2px rgba(0,0,0,0.3);transform: translateX(10px);transition: transform 320ms var(--mb-spring)}
.magic-bento__switch[data-off]{background: var(--mb-line)}
.magic-bento__switch[data-off]::after{background: var(--mb-ink);transform: none}
.magic-bento[data-motion] .magic-bento__chart-line{stroke-dasharray: 1;animation: magic-bento-draw 1100ms cubic-bezier(0.65,0,0.35,1) calc(var(--mb-delay) + 220ms) both paused}
.magic-bento[data-motion] .magic-bento__chart-area{animation: magic-bento-fade 700ms ease calc(var(--mb-delay) + 700ms) both paused}
.magic-bento[data-motion] .magic-bento__bar{animation: magic-bento-grow 760ms var(--mb-spring) calc(var(--mb-delay) + 200ms + var(--i) * 55ms) both paused}
.magic-bento[data-motion] .magic-bento__cursor{animation: magic-bento-pop 420ms var(--mb-spring) calc(var(--mb-delay) + 600ms + var(--i) * 160ms) both paused,var(--path) 9s ease-in-out calc(var(--i) * -3s) infinite paused}
.magic-bento[data-motion] .magic-bento__selection{animation: magic-bento-select 900ms cubic-bezier(0.65,0,0.35,1) calc(var(--mb-delay) + 760ms) both paused}
.magic-bento[data-motion] .magic-bento__caret{animation: magic-bento-blink 1.1s steps(1) infinite paused}
.magic-bento[data-motion] .magic-bento__pending{animation: magic-bento-wait 1ms linear calc(var(--mb-delay) + 360ms + var(--i) * 520ms) both paused}
.magic-bento[data-motion] .magic-bento__spinner{animation: magic-bento-run 520ms linear calc(var(--mb-delay) + 360ms + var(--i) * 520ms) both paused,magic-bento-spin 700ms linear infinite paused}
.magic-bento[data-motion] .magic-bento__done{animation: magic-bento-check 420ms var(--mb-spring) calc(var(--mb-delay) + 880ms + var(--i) * 520ms) both paused}
.magic-bento[data-motion] .magic-bento__step-time{animation: magic-bento-fade 300ms ease calc(var(--mb-delay) + 880ms + var(--i) * 520ms) both paused}
.magic-bento[data-motion] .magic-bento__rail-fill{animation: magic-bento-rail calc(var(--n) * 520ms) linear calc(var(--mb-delay) + 360ms) both paused}
.magic-bento[data-motion] .magic-bento__hub-node{animation: magic-bento-pop 520ms var(--mb-spring) calc(var(--mb-delay) + 200ms + var(--i) * 70ms) both paused}
.magic-bento[data-motion] .magic-bento__hub-links line{stroke-dasharray: 1;animation: magic-bento-draw 700ms cubic-bezier(0.65,0,0.35,1) calc(var(--mb-delay) + 360ms) both paused}
.magic-bento[data-motion] .magic-bento__card[data-active] .magic-bento__packet{animation: magic-bento-packet 1.8s cubic-bezier(0.45,0,0.55,1) calc(var(--i) * 0.45s) infinite}
.magic-bento[data-motion] .magic-bento__switch{animation: magic-bento-switch-track 420ms ease calc(var(--mb-delay) + 520ms + var(--i) * 200ms) both paused}
.magic-bento[data-motion] .magic-bento__switch::after{animation: magic-bento-switch-knob 520ms var(--mb-spring) calc(var(--mb-delay) + 520ms + var(--i) * 200ms) both paused}
.magic-bento[data-motion] .magic-bento__switch[data-off],.magic-bento[data-motion] .magic-bento__switch[data-off]::after{animation: none}
.magic-bento[data-motion] .magic-bento__cell[data-state='in'] :is( .magic-bento__chart-line,.magic-bento__chart-area,.magic-bento__bar,.magic-bento__selection,.magic-bento__pending,.magic-bento__spinner,.magic-bento__done,.magic-bento__step-time,.magic-bento__rail-fill,.magic-bento__hub-node,.magic-bento__hub-links line,.magic-bento__switch ){animation-play-state: running}
.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__switch::after{animation-play-state: running}
.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__cursor{animation-play-state: running,paused}
.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__card[data-active] .magic-bento__cursor{animation-play-state: running,running}
.magic-bento[data-motion] .magic-bento__card[data-active] .magic-bento__caret{animation-play-state: running}
.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__spinner{animation-play-state: running,running}
@keyframes magic-bento-draw{from{stroke-dashoffset: 1}to{stroke-dashoffset: 0}}
@keyframes magic-bento-fade{from{opacity: 0}to{opacity: 1}}
@keyframes magic-bento-grow{from{transform: scaleY(0)}to{transform: scaleY(1)}}
@keyframes magic-bento-pop{from{opacity: 0;scale: 0.6}to{opacity: 1;scale: 1}}
@keyframes magic-bento-select{from{clip-path: inset(0 100% 0 0)}to{clip-path: inset(0 0 0 0)}}
@keyframes magic-bento-blink{0%{opacity: 1}50%{opacity: 0}}
@keyframes magic-bento-wait{from{opacity: 1}to{opacity: 0}}
@keyframes magic-bento-run{0%{opacity: 0}1%,92%{opacity: 1}100%{opacity: 0}}
@keyframes magic-bento-spin{to{rotate: 360deg}}
@keyframes magic-bento-check{from{opacity: 0;scale: 0.4}to{opacity: 1;scale: 1}}
@keyframes magic-bento-rail{from{transform: scaleY(0)}to{transform: scaleY(1)}}
@keyframes magic-bento-packet{0%{top: var(--y);left: var(--x);opacity: 0}15%{opacity: 1}80%{opacity: 1}100%{top: 50%;left: 50%;opacity: 0}}
@keyframes magic-bento-switch-track{from{background-color: var(--mb-line)}to{background-color: rgb(var(--mb-accent-rgb))}}
@keyframes magic-bento-switch-knob{from{background: var(--mb-ink);transform: none}to{background: var(--mb-accent-ink);transform: translateX(10px)}}
@keyframes magic-bento-path-a{0%,100%{translate: 0 0}30%{translate: 46px -18px}62%{translate: 12px 26px}}
@keyframes magic-bento-path-b{0%,100%{translate: 0 0}35%{translate: -40px 14px}70%{translate: -8px -22px}}
`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const vars = (values: Record<string, string | number>) => values as CSSProperties;

const parseRgb = (value?: string | null): number[] | null => {
  if (!value) return null;
  const text = String(value).trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
  }
  const numbers = text.match(/[\d.]+/g);
  if (numbers && numbers.length >= 3 && /^(rgba?\(|[\d.\s,]+$)/i.test(text)) {
    return numbers.slice(0, 3).map(channel => clamp(Math.round(parseFloat(channel)), 0, 255));
  }
  return null;
};

const inkFor = (rgb: number[]) => {
  const [r, g, b] = rgb.map(channel => channel / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#121016' : '#ffffff';
};

const REPLAY = new Set([
  'magic-bento-draw',
  'magic-bento-fade',
  'magic-bento-grow',
  'magic-bento-pop',
  'magic-bento-select',
  'magic-bento-wait',
  'magic-bento-run',
  'magic-bento-check',
  'magic-bento-rail',
  'magic-bento-switch-track',
  'magic-bento-switch-knob'
]);

const FLOW = new Set([
  'magic-bento-wait',
  'magic-bento-run',
  'magic-bento-check',
  'magic-bento-rail',
  'magic-bento-fade'
]);

const finite = (animation: Animation) => {
  const timing = animation.effect?.getTiming?.();
  return timing ? timing.iterations !== Infinity : false;
};

const nameOf = (animation: Animation) => (animation as CSSAnimation).animationName || '';

const MagicBento = ({
  items = [],
  columns = 4,
  rowHeight = 200,
  gap = 12,
  radius = 20,
  theme = 'dark',
  glowColor,
  textAutoHide = true,
  enableBorderGlow = true,
  enableSpotlight = true,
  spotlightRadius = 300,
  enableStars = false,
  particleCount = 24,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = true,
  intro = true,
  disableAnimations = false,
  onItemClick,
  className = '',
  style
}: MagicBentoProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const starRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const engineRef = useRef<{ sync: () => void } | null>(null);
  const [cols, setCols] = useState(Math.max(1, Math.round(columns)));
  // The imperative engine below reads prefers-reduced-motion itself (see the `reduced` const in
  // its effect), but the CSS-driven data-motion/data-intro attributes only checked the explicit
  // disableAnimations prop — out of sync with the engine's own behaviour. Mirrored here so both
  // layers agree regardless of what the caller passes.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const effectivelyStatic = disableAnimations || prefersReducedMotion;

  const palette = theme === 'light' ? 'light' : 'dark';
  const glow = parseRgb(glowColor) ?? INK[palette];
  const settings: Settings = {
    items,
    columns: Math.max(1, Math.round(columns)),
    gap: Math.max(0, gap),
    enableBorderGlow,
    enableSpotlight,
    spotlightRadius: Math.max(40, spotlightRadius),
    enableStars,
    particleCount: clamp(Math.round(particleCount), 0, 120),
    enableTilt,
    enableMagnetism,
    clickEffect,
    intro,
    disableAnimations,
    onItemClick,
    glow
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = !settingsRef.current.disableAnimations && !reduced;
    const playIntro = motion && settingsRef.current.intro;
    if (motion) root.dataset.motion = '';
    else delete root.dataset.motion;
    if (playIntro) root.dataset.intro = '';
    else delete root.dataset.intro;

    const pointer = { x: -1e5, y: -1e5, inside: false, down: -1 };
    const light = { x: -1e5, y: -1e5, near: 0, ready: false };
    const states: CardState[] = [];
    const wave = { x: 0, y: 0, t: -1, duration: 1.1, reach: 800 };
    let rects: (DOMRect | null)[] = [];
    let bounds: DOMRect | null = null;
    let dirty = true;
    let raf = 0;
    let last = 0;
    let visible = true;
    let entered = !playIntro;
    let settleTimer = 0;
    let introTimer = 0;
    const lastFlow: number[] = [];

    const stateFor = (index: number): CardState => {
      if (!states[index]) {
        states[index] = {
          hot: 0,
          rx: 0,
          ry: 0,
          tx: 0,
          ty: 0,
          vrx: 0,
          vry: 0,
          vtx: 0,
          vty: 0,
          press: 1,
          vpress: 0,
          stars: 0,
          particles: null,
          active: false,
          written: {}
        };
      }
      return states[index];
    };

    const write = (element: HTMLElement, state: CardState, name: string, value: string) => {
      if (state.written[name] === value) return;
      state.written[name] = value;
      element.style.setProperty(name, value);
    };

    const measure = () => {
      dirty = false;
      bounds = root.getBoundingClientRect();
      rects = cellRefs.current.map(cell => (cell ? cell.getBoundingClientRect() : null));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      starRefs.current.forEach((canvas, index) => {
        const rect = rects[index];
        if (!canvas || !rect) return;
        const width = Math.max(1, Math.round(rect.width * ratio));
        const height = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
      });
    };

    const seed = (index: number, rect: DOMRect): Particle[] => {
      const count = settingsRef.current.particleCount;
      const state = stateFor(index);
      if (state.particles && state.particles.length === count) return state.particles;
      state.particles = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 10,
        size: 0.6 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        rate: 1.2 + Math.random() * 2.4
      }));
      return state.particles;
    };

    const drawStars = (
      index: number,
      rect: DOMRect,
      state: CardState,
      lx: number,
      ly: number,
      dt: number,
      now: number
    ) => {
      const canvas = starRefs.current[index];
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const ratio = canvas.width / Math.max(1, rect.width);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (state.stars < 0.004) return;
      const s = settingsRef.current;
      const particles = seed(index, rect);
      const reach = s.spotlightRadius * 0.75;
      const [r, g, b] = s.glow;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.y < -4) {
          particle.y = rect.height + 4;
          particle.x = Math.random() * rect.width;
        }
        if (particle.x < -4) particle.x = rect.width + 4;
        if (particle.x > rect.width + 4) particle.x = -4;
        const distance = Math.hypot(particle.x - lx, particle.y - ly) / reach;
        if (distance >= 1) continue;
        const falloff = 1 - distance * distance * (3 - 2 * distance);
        const twinkle = 0.55 + 0.45 * Math.sin(now * 0.001 * particle.rate + particle.phase);
        const alpha = state.stars * falloff * twinkle;
        if (alpha < 0.01) continue;
        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
    };

    const replay = (card: HTMLElement, filter: Set<string>) => {
      if (!motion || !card.getAnimations) return;
      for (const animation of card.getAnimations({ subtree: true })) {
        if (!filter.has(nameOf(animation)) || !finite(animation)) continue;
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
        if (target instanceof Element && target.classList.contains('magic-bento__cursor')) continue;
        animation.currentTime = 0;
        animation.play();
      }
    };

    const startWave = (x: number, y: number, duration: number) => {
      if (!motion || !bounds) return;
      wave.x = x;
      wave.y = y;
      wave.t = 0;
      wave.duration = duration;
      wave.reach =
        Math.max(
          Math.hypot(x - bounds.left, y - bounds.top),
          Math.hypot(x - bounds.right, y - bounds.top),
          Math.hypot(x - bounds.left, y - bounds.bottom),
          Math.hypot(x - bounds.right, y - bounds.bottom)
        ) + 140;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (dirty) measure();
      const s = settingsRef.current;
      const cards = cardRefs.current;
      let busy = false;

      const margin = s.spotlightRadius * 0.5;
      const near =
        pointer.inside &&
        bounds &&
        pointer.x > bounds.left - margin &&
        pointer.x < bounds.right + margin &&
        pointer.y > bounds.top - margin &&
        pointer.y < bounds.bottom + margin
          ? 1
          : 0;
      if (!light.ready && near) {
        light.x = pointer.x;
        light.y = pointer.y;
        light.ready = true;
      }
      const follow = 1 - Math.exp(-dt / 0.05);
      light.x += (pointer.x - light.x) * follow;
      light.y += (pointer.y - light.y) * follow;
      const fade = 1 - Math.exp(-dt / (near > light.near ? 0.12 : 0.4));
      light.near += (near - light.near) * fade;
      if (Math.abs(near - light.near) < 0.002) light.near = near;
      else busy = true;
      if (Math.abs(pointer.x - light.x) + Math.abs(pointer.y - light.y) > 0.3) busy = true;

      let waveRadius = 0;
      let waveAlpha = 0;
      if (wave.t >= 0) {
        wave.t += dt;
        const progress = Math.min(1, wave.t / wave.duration);
        waveRadius = wave.reach * (1 - Math.pow(1 - progress, 2.2));
        waveAlpha = Math.pow(1 - progress, 1.3);
        if (progress >= 1) {
          wave.t = -1;
          waveAlpha = 0;
        } else busy = true;
      }

      cards.forEach((card, index) => {
        const rect = rects[index];
        if (!card || !rect) return;
        const state = stateFor(index);
        const lx = light.x - rect.left;
        const ly = light.y - rect.top;
        const px = pointer.x - rect.left;
        const py = pointer.y - rect.top;
        const inside = pointer.inside && entered && px >= 0 && py >= 0 && px <= rect.width && py <= rect.height;

        if (inside !== state.active) {
          state.active = inside;
          if (inside) {
            card.dataset.active = '';
            if (now - (lastFlow[index] || -1e9) > 3200 && card.querySelector('.magic-bento__steps')) {
              lastFlow[index] = now;
              replay(card, FLOW);
            }
          } else delete card.dataset.active;
        }

        const hotTarget = inside && s.enableSpotlight ? 1 : 0;
        state.hot += (hotTarget - state.hot) * (1 - Math.exp(-dt / (hotTarget > state.hot ? 0.14 : 0.32)));
        if (Math.abs(hotTarget - state.hot) < 0.002) state.hot = hotTarget;
        else busy = true;

        const u = clamp(px / Math.max(1, rect.width), 0, 1) - 0.5;
        const v = clamp(py / Math.max(1, rect.height), 0, 1) - 0.5;
        const tilt = inside && s.enableTilt && motion;
        const magnet = inside && s.enableMagnetism && motion;
        const targets = [
          tilt ? -v * 2 * TILT : 0,
          tilt ? u * 2 * TILT : 0,
          magnet ? u * 2 * MAGNET : 0,
          magnet ? v * 2 * MAGNET : 0
        ];
        const keys: Spring[] = [
          ['rx', 'vrx'],
          ['ry', 'vry'],
          ['tx', 'vtx'],
          ['ty', 'vty']
        ];
        const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
        const h = dt / steps;
        keys.forEach(([key, velocity], k) => {
          for (let step = 0; step < steps; step++) {
            state[velocity] += (170 * (targets[k] - state[key]) - 20 * state[velocity]) * h;
            state[key] += state[velocity] * h;
          }
          if (Math.abs(targets[k] - state[key]) < 0.002 && Math.abs(state[velocity]) < 0.01) {
            state[key] = targets[k];
            state[velocity] = 0;
          } else busy = true;
        });
        const pressTarget = pointer.down === index && s.clickEffect && motion ? 0.985 : 1;
        for (let step = 0; step < steps; step++) {
          state.vpress += (420 * (pressTarget - state.press) - 28 * state.vpress) * h;
          state.press += state.vpress * h;
        }
        if (Math.abs(pressTarget - state.press) < 0.0002 && Math.abs(state.vpress) < 0.001) {
          state.press = pressTarget;
          state.vpress = 0;
        } else busy = true;

        write(card, state, '--mb-x', `${lx.toFixed(1)}px`);
        write(card, state, '--mb-y', `${ly.toFixed(1)}px`);
        write(card, state, '--mb-near', (s.enableBorderGlow ? light.near : 0).toFixed(3));
        write(card, state, '--mb-hot', state.hot.toFixed(3));
        write(card, state, '--mb-rx', `${state.rx.toFixed(3)}deg`);
        write(card, state, '--mb-ry', `${state.ry.toFixed(3)}deg`);
        write(card, state, '--mb-tx', `${state.tx.toFixed(2)}px`);
        write(card, state, '--mb-ty', `${state.ty.toFixed(2)}px`);
        write(card, state, '--mb-press', state.press.toFixed(4));
        write(card, state, '--mb-wx', `${(wave.x - rect.left).toFixed(1)}px`);
        write(card, state, '--mb-wy', `${(wave.y - rect.top).toFixed(1)}px`);
        write(card, state, '--mb-wr', `${waveRadius.toFixed(1)}px`);
        write(card, state, '--mb-wa', waveAlpha.toFixed(3));

        if (s.enableStars && starRefs.current[index]) {
          const starTarget = inside && motion ? 1 : 0;
          state.stars += (starTarget - state.stars) * (1 - Math.exp(-dt / (starTarget ? 0.3 : 0.5)));
          if (state.stars < 0.004 && !starTarget) state.stars = 0;
          if (state.stars > 0 || starTarget) {
            drawStars(index, rect, state, lx, ly, dt, now);
            state.drawn = true;
            busy = true;
          } else if (state.drawn) {
            drawStars(index, rect, state, lx, ly, dt, now);
            state.drawn = false;
          }
        }
      });

      if (busy && visible) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const cardIndex = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return -1;
      const card = target.closest('.magic-bento__card');
      return card instanceof HTMLElement ? cardRefs.current.indexOf(card) : -1;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      wake();
    };

    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      pointer.inside = false;
      pointer.down = -1;
      wake();
    };

    const onPointerDown = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      pointer.down = cardIndex(event.target);
      wake();
    };

    const release = () => {
      if (pointer.down < 0) return;
      pointer.down = -1;
      wake();
    };

    const activate = (index: number, x: number, y: number) => {
      const s = settingsRef.current;
      const card = cardRefs.current[index];
      if (!card) return;
      if (s.clickEffect) {
        if (dirty) measure();
        startWave(x, y, 1.1);
        replay(card, REPLAY);
        lastFlow[index] = performance.now();
      }
      wake();
    };

    const onClick = (event: MouseEvent) => {
      const index = cardIndex(event.target);
      const card = cardRefs.current[index];
      if (!card) return;
      if (event.detail === 0) {
        const rect = card.getBoundingClientRect();
        activate(index, rect.left + rect.width / 2, rect.top + rect.height / 2);
      } else activate(index, event.clientX, event.clientY);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = cardRefs.current[cardIndex(event.target)];
      if (!card || event.target !== card || card.tagName === 'A') return;
      event.preventDefault();
      card.click();
    };

    const onScroll = () => {
      dirty = true;
      wake();
    };

    const resizeObserver = new ResizeObserver(() => {
      const s = settingsRef.current;
      const width = root.clientWidth;
      const cell = (count: number) => (width - s.gap * (count - 1)) / count;
      const next = cell(s.columns) >= MIN_CELL ? s.columns : s.columns >= 2 && cell(2) >= MIN_PAIR ? 2 : 1;
      setCols(next);
      dirty = true;
      wake();
    });
    resizeObserver.observe(root);

    const enter = () => {
      entered = true;
      let order = 0;
      cellRefs.current.forEach(cell => {
        if (!cell) return;
        cell.style.setProperty('--mb-delay', `${order++ * STAGGER}ms`);
        cell.dataset.state = 'in';
      });
      if (dirty) measure();
      introTimer = window.setTimeout(() => {
        if (bounds) startWave(bounds.left, bounds.top, 1.7);
        wake();
      }, 260);
      settleTimer = window.setTimeout(
        () => {
          cellRefs.current.forEach(cell => cell?.style.setProperty('--mb-delay', '0ms'));
        },
        order * STAGGER + 2600
      );
      wake();
    };

    let gate: IntersectionObserver | null = null;
    if (playIntro && typeof IntersectionObserver !== 'undefined') {
      gate = new IntersectionObserver(
        (entries, observer) => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect();
          enter();
        },
        { threshold: 0.15 }
      );
      gate.observe(root);
    } else {
      cellRefs.current.forEach(cell => {
        if (!cell) return;
        cell.style.setProperty('--mb-delay', '0ms');
        cell.dataset.state = 'in';
      });
      if (motion) {
        for (const animation of root.getAnimations ? root.getAnimations({ subtree: true }) : []) {
          if (REPLAY.has(nameOf(animation)) && finite(animation)) animation.finish();
        }
      }
    }

    const visibility = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) {
        dirty = true;
        wake();
      }
    });
    visibility.observe(root);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', release, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    document.addEventListener('pointerout', onPointerOut);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);

    engineRef.current = {
      sync: () => {
        cellRefs.current.forEach(cell => {
          if (!cell || (!entered && playIntro)) return;
          if (cell.dataset.state !== 'in') {
            cell.style.setProperty('--mb-delay', '0ms');
            cell.dataset.state = 'in';
          }
        });
        dirty = true;
        wake();
      }
    };

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      window.clearTimeout(introTimer);
      gate?.disconnect();
      visibility.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      engineRef.current = null;
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    engineRef.current?.sync();
  }, [items, cols, rowHeight, gap, radius, enableStars, enableSpotlight, enableBorderGlow]);

  const ink = INK[palette];
  const accent = parseRgb(glowColor) ?? ink;
  const corner = Math.max(0, radius);
  const span = Math.max(1, cols);

  cellRefs.current.length = items.length;
  cardRefs.current.length = items.length;
  starRefs.current.length = items.length;

  return (
    <div
      ref={rootRef}
      className={`${ROOT_CLASS} ${className}`.trim()}
      data-autohide={textAutoHide ? '' : undefined}
      data-motion={effectivelyStatic ? undefined : ''}
      data-intro={intro && !effectivelyStatic ? '' : undefined}
      style={{
        ...vars({
          ...THEMES[palette],
          '--mb-glow-rgb': glow.join(', '),
          '--mb-accent-rgb': accent.join(', '),
          '--mb-accent-ink': inkFor(accent),
          '--mb-radius': `${corner}px`,
          '--mb-inner-radius': `${Math.round(clamp(corner * 0.5, 6, 12))}px`,
          '--mb-pad': `${Math.round(clamp(corner * 0.85, 14, 20))}px`,
          '--mb-spot-size': `${Math.max(40, spotlightRadius)}px`,
          '--mb-border-size': `${Math.round(Math.max(40, spotlightRadius) * 0.75)}px`
        }),
        gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))`,
        gridAutoRows: span === 1 ? `minmax(${rowHeight}px, auto)` : `${rowHeight}px`,
        gap: `${Math.max(0, gap)}px`,
        ...style
      }}
    >
      <style>{STYLE}</style>
      {items.map((item, index) => {
        const entry: MagicBentoItem = item ?? {};
        const clickable = Boolean(entry.href || entry.onClick || onItemClick);
        const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
          entry.onClick?.(event);
          onItemClick?.(entry, index);
        };
        const cardProps = {
          ref: (element: HTMLElement | null) => {
            cardRefs.current[index] = element;
          },
          className: CARD_CLASS,
          'data-clickable': clickable ? '' : undefined,
          'data-image': entry.image ? '' : undefined,
          onClick: clickable ? handleClick : undefined
        };
        const body = (
          <>
            {entry.image && <img className={IMAGE_CLASS} src={entry.image} alt="" draggable={false} />}
            {entry.image && <span className={SCRIM_CLASS} style={SCRIM_STYLE} />}
            {enableSpotlight && <span className={LIGHT_CLASS} style={LIGHT_STYLE} />}
            {enableStars && (
              <canvas
                ref={element => {
                  starRefs.current[index] = element;
                }}
                className={STARS_CLASS}
                aria-hidden="true"
              />
            )}
            <div className={CONTENT_CLASS}>
              {entry.content ?? (
                <>
                  {(entry.icon || entry.label) && (
                    <div className={HEADER_CLASS}>
                      {entry.icon && <span className={ICON_CLASS}>{entry.icon}</span>}
                      {entry.label && <span className={LABEL_CLASS}>{entry.label}</span>}
                    </div>
                  )}
                  {(entry.title || entry.description) && (
                    <div className={TEXT_CLASS}>
                      {entry.title && <h3 className={TITLE_CLASS}>{entry.title}</h3>}
                      {entry.description && <p className={DESCRIPTION_CLASS}>{entry.description}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
            <span className={RIM_CLASS} />
            <span className={BORDER_CLASS} style={BORDER_STYLE} />
          </>
        );

        return (
          <div
            key={entry.id ?? index}
            ref={element => {
              cellRefs.current[index] = element;
            }}
            className={CELL_CLASS}
            style={{
              gridColumn: `span ${Math.min(span, Math.max(1, Math.round(entry.colSpan ?? 1)))}`,
              gridRow: `span ${Math.max(1, Math.round(entry.rowSpan ?? 1))}`
            }}
          >
            {entry.href ? (
              <a {...cardProps} href={entry.href} target={entry.target} rel={entry.rel}>
                {body}
              </a>
            ) : clickable ? (
              <button
                {...cardProps}
                type="button"
                aria-label={entry.title}
                className={`${CARD_CLASS} m-0 border-0 bg-transparent p-0 text-left [font:inherit]`}
              >
                {body}
              </button>
            ) : (
              <div {...cardProps}>{body}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MagicBento;
