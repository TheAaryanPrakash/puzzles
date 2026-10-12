# Redesign research — React Bits components

Phase 1 of the visual redesign. Researched live on reactbits.dev (playwright-cli, screenshots in
`docs/redesign/demos/`) and against the actual TS+Tailwind source
(`github.com/DavidHDev/react-bits`, `src/ts-tailwind/...`, fetched directly — the `shadcn@latest add`
path needs an initialized shadcn project with a `components.json`, which this repo intentionally
doesn't have per CLAUDE.md's "no shadcn/ui" rule, so raw source files were pulled instead and
inspected before any code was kept).

**Skills used**: `design-system` (token architecture), `ui-ux-pro-max` (palette/contrast rules used
in the colour section below), `web-design-guidelines` (reduced-motion/ARIA checklist applied per
component below). `playwright-cli` was used directly for the research itself, not as a design skill.
`design-taste-frontend`, `high-end-visual-design`, `modern-web-design`, `ui-styling`, `motion-framer`
and `brand` will be used in the Build phase once actual integration starts.

**Headline finding: no new animation/WebGL packages are needed.** All 7 components import only
`react` and `motion/react` — which is a subpath of the `motion` package already installed (CLAUDE.md
lists `motion` as frozen/installed). The two "backgrounds"-style components (Flux Lines, Specular
Button) do their own effect in hand-written WebGL2 shaders with zero library (no `ogl`, no `three`).
Magic Bento's particle layer is plain Canvas 2D, also with no library. So the brief's expectation of
needing `gsap` and a WebGL lib doesn't hold for this specific set of 7 — nothing like that is
imported anywhere in these 7 files.

**One dependency is explicitly NOT being kept**: three of the seven (`CodeSlots`, `GlideSelect`,
`MagicBento`) import icons from `@hugeicons/react` + `@hugeicons/core-free-icons` (a check mark, a
chevron, and a handful of app-logo glyphs for Magic Bento's demo cards). CLAUDE.md's icon rule for
this redesign is SVG Repo "Dazzle Line" only, so these imports are dropped in the Build phase and
replaced with our own `src/components/icons/Check.tsx` / `ChevronDown.tsx` — no new icon package.

## Package additions

| Package | Why | gzip (unpacked, from npm) |
|---|---|---|
| `@fontsource/baloo-2` | 3rd font candidate for Checkpoint 1 (see Fonts, below) — Quicksand, Comfortaa, Fredoka and Nunito are already installed. | ~340 KB unpacked (weight files only load on `@import`; a single weight is ~18-22 KB gzipped) |

No `gsap`, no `ogl`/`three`. If a later component (phase 2 polish) turns out to need a real WebGL
helper, that's a new ask, not something these 7 needed.

---

## 1. Flux Lines (`backgrounds/flux-lines`)

"Glowing flux lines tracing a churning magnetic fluid. The cursor magnet reveals and curls them."

- **What it does**: full-bleed canvas background. A hand-written WebGL2 fragment shader blends two
  layers of value noise into a flow field, extracts bright contour bands from it, and colours each
  band from a palette (up to 8 colours blended along the lines). A `requestAnimationFrame` loop
  advances time and eases the pointer position toward the field, which bends ("magnets") the lines
  toward the cursor; a click stirs a swirl impulse into the field.
- **Props** (26 total): `colors[]`, `speed`, `scale`, `turbulence`, `fluidity`, `rimWidth`,
  `sharpness`, `shimmer`, `glow`, `lineWidth`, `flowDirection` (`up|down|left|right`),
  `mouseInteraction`, `mouseStrength`, `mouseRadius`, `mouseDampening`, `clickSwirl`, `intro`,
  `lightMode`, `transparent`, `backgroundColor`, `opacity`, `paused`, `dpr`, `className`, `style`.
- **Deps**: none beyond React. Vanilla `WebGL2RenderingContext`.
- **Perf on a phone**: a single full-screen fragment shader at capped DPR is cheap on modern mobile
  GPUs, but it's still a persistent `requestAnimationFrame` loop + WebGL context alive on every page.
  The brief's plan (mount once at the app root, "calm" mode in games, pause on tab-hidden) is the
  right mitigation. `dpr` prop lets us cap device pixel ratio directly, no manual canvas math needed.
- **Cleanup**: resize observer, pointer listeners, cancelled RAF, deleted GL buffers/program and
  released context all confirmed in source — clean unmount.
- **Reduced motion**: component does NOT read `prefers-reduced-motion` itself (no `matchMedia` call
  found) — `paused` is exposed as a prop, so our wrapper must read the media query and pass
  `paused={true}` (or render the "still frame" the brief asks for) ourselves. This is a real gap we
  fix in the Build-phase wrapper, not a built-in.
- **Touch**: pointer events (not mouse-only) are used, so touch drags already work as a magnet; no
  extra touch code needed, but on touch devices a cursor magnet is meaningless (no hover) — worth
  disabling `mouseInteraction` or lowering `mouseStrength` under coarse-pointer media query.
- **Keyboard/ARIA**: it's a decorative background; needs `aria-hidden="true"` and
  `role="presentation"` on the wrapping element (not present by default — add in our wrapper).
- **Where we use it**: mounted once at the app root behind every page (brief's header item 3). Game
  pages pass a "calm" prop set (lower `speed`/`mouseStrength`, `mouseInteraction={false}` over the
  board via a container boundary, not a prop — the shader doesn't know about DOM layout, so "no
  cursor magnet over the board" has to be implemented as capping pointer events to the area outside
  `[data-no-swipe]` boards, e.g. by only forwarding pointermove when `e.target` is outside the board).

## 2. Jelly Radio (`micro/jelly-radio`)

"Radio group of chips where the chosen one swells and barges its neighbours outward."

- **What it does**: a row of pill chips; the selected chip's `motion` layout animates a size
  increase that visually "pushes" neighbouring chips apart (spring-based, not real layout — it's a
  `motion` `layout` + spring transform illusion).
- **Props**: `items` (string or `{value,label,icon?,disabled?}`), `value`/`defaultValue`, `onChange`,
  `chipColor`, `activeColor`, `textColor`, `activeTextColor`, `size` (`sm|md|lg`), `gap`, `radius`,
  `swell`, `barge`, `shrink`, `jelly`, `bounce`, `stagger`, `stiffness`, `disabled`, `ariaLabel`,
  `className`.
- **Deps**: `motion/react` only (`animate`, `motion`, `motionValue`, `useReducedMotion`,
  `useTransform`).
- **Reduced motion**: uses the `useReducedMotion()` hook directly — confirmed built-in, no wrapper
  work needed.
- **Touch**: no pointer/touch-specific code found, but it's a plain radio group of `<button>`s —
  tap/click already works natively; nothing to add.
- **Keyboard/ARIA**: 7 aria/role hits in source — standard radiogroup pattern expected (verify
  `role="radiogroup"` + `role="radio"` + arrow-key roving tabindex at integration time).
- **Where we use it**: the header's Day/Week and Site/Group toggle on Leaderboard (brief item 7).

## 3. Flip Card (`micro/flip-card`)

"Two-faced card that flips in 3D on a click, drag or flick and settles on a spring."

- **What it does**: a `front`/`back` card that flips on the X or Y axis via 3D CSS transforms driven
  by `motion` springs; supports click-to-flip, drag-to-flip (with a flick-velocity threshold), tilt
  on hover, and an optional glare highlight.
- **Props**: `front`, `back`, `flipped`/`defaultFlipped` (controlled/uncontrolled), `onFlipChange`,
  `axis` (`x|y`), `flipOnClick`, `draggable`, `dragDistance`, `tilt`, `tiltMax`, `glare`,
  `glareOpacity`, `hoverScale`, `perspective`, `stiffness`, `damping`, `width`, `height`, `radius`,
  `background`, `color`, `shadow`, `shadowColor`, `shadowOpacity`, `disabled`, `ariaLabel`,
  `className`.
- **Deps**: `motion/react` only.
- **Reduced motion**: `useReducedMotion()` imported directly — built-in.
- **Touch**: 6 touch/pointer hits — drag-to-flip uses pointer events (covers touch), confirmed.
- **Keyboard/ARIA**: 12 aria/role/keydown hits — click-to-flip is keyboard-reachable (role=button +
  onKeyDown for Enter/Space), confirmed in source scan.
- **Where we use it**: the shared `HowToPlay` modal (front: icon + title + tagline; back: rules) and
  `ResultModal`'s reveal flip (brief items 5 and 6). Controlled mode (`flipped` prop) is what we want
  for ResultModal so we can trigger the flip programmatically when the result is ready.

## 4. Code Slots (`micro/code-slots`)

"One-time code input whose digits spring into their slots, with paste and SMS autofill."

- **What it does**: an OTP-style multi-slot text input. Each character animates into its slot with a
  spring "sink" + rise, has `success`/`error` status colouring, supports paste-fill and
  `autocomplete="one-time-code"` for SMS autofill, and a blinking caret on the active slot.
- **Props**: `length`, `value`/`defaultValue`, `onChange`, `onComplete`, `status`
  (`idle|error|success`), `mask`, `caret`, `disabled`, `autoFocus`, `accentColor`, `inkColor`,
  `slotColor`, `digitColor`, `dangerColor`, `slotSize`, `gap`, `radius`, `bounce`, `settle`, `rise`,
  `cascade`, `ariaLabel`, `className`.
- **Deps**: `motion/react` + (dropped) `@hugeicons/*` for the success checkmark — replaced with our
  own `Check` icon.
- **Reduced motion**: `useReducedMotion` imported (2 hits) — built-in.
- **Touch**: this is a real `<input>`-backed component (single hidden text input synced to the
  visual slots), so touch/mobile keyboards work via the native input, not custom touch handlers —
  explains the 0 touch-specific hits; not a gap.
- **Keyboard/ARIA**: 9 aria hits — it's one real input under the hood, so native keyboard behaviour
  (backspace, arrow keys inside the input) already works; the visual slots are `aria-hidden`.
- **Where we use it**: NOT used directly as a component — the brief asks for `useSlotSpring`, a hook
  or wrapper extracted from this component's spring/sink/rise motion math, applied to Wordle/Quordle's
  own existing tile input (which has its own flip-reveal and shake already, and uses a full on-screen
  + physical keyboard, not a single hidden input). This is an adaptation, not a drop-in — noted for
  phase 2 scope ("adopt `useSlotSpring` for typing", not "replace the input system").

## 5. Glide Select (`micro/glide-select`)

"Select chip whose menu pops from its corner and whose highlight glides between rows."

- **What it does**: a single-select dropdown styled as a chip. Opening the menu "pops" from the
  trigger's corner (transform-origin animation); moving between options animates a highlight pill
  that glides to the new row rather than snapping.
- **Props**: `options` (string or `{value,label,...}`), `value`/`defaultValue`, `onChange`,
  `placeholder`, `showTags`, `accentColor`, `surfaceColor`, `highlightColor`, `textColor`, `size`
  (`sm|md|lg`), `radius`, `menuWidth`, `placement` (`top|bottom`), `align` (`left|right`),
  `popDuration`, `glideDuration`, `rememberPosition`, `disabled`, `ariaLabel`, `className`.
- **Deps**: `motion/react` + (dropped) `@hugeicons/*` for the chevron and selected-checkmark —
  replaced with our own icons.
- **Reduced motion**: no `useReducedMotion()` hook call, BUT the Tailwind classes use the
  `motion-reduce:` variant extensively (e.g. `motion-reduce:enabled:active:scale-100`,
  `motion-reduce:transition-none` on the chevron) — reduced motion IS respected, just via CSS media
  query utility classes rather than the JS hook. Not a gap.
- **Touch**: `touch-manipulation` class present, pointer-based open/close — works on touch.
- **Keyboard/ARIA**: full combobox pattern — `role="combobox"`, `aria-haspopup="listbox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant` on the trigger; `role="listbox"` +
  `role="option"` + `aria-selected` in the menu. This is a real listbox/combobox ARIA pattern, well
  built.
- **Important limitation for phase 2**: **this is a select, not a text combobox** — there is no text
  `<input>` and no filtering logic anywhere in the source. The brief's `GlideCombobox` (type-to-search
  for Worldle/Flagle/Globle/Travle/States) is NOT "just use GlideSelect" — it needs a genuinely new
  input+filtered-list layer built on top, reusing only GlideSelect's visual language (corner pop,
  gliding highlight) and its listbox ARIA pattern, with a real `<input type="text">` driving
  `aria-controls`/`aria-activedescendant` the way a combobox should. This is the component most likely
  to need real engineering, not adaptation — flagged for the Build phase's focus-loss investigation
  (the States bug) before `GlideCombobox` is built.
- **Where we use it**: the header's game-switcher (brief item 4), Leaderboard's group picker, archive
  picker — as a plain select, these are safe uses of GlideSelect as-is.

## 6. Specular Button (`components/specular-button`)

"Glass button whose edge catches the light, with a highlight that glides toward the cursor."

- **What it does**: a glassy button rendered with a WebGL2 shader for the specular highlight ring
  that chases the pointer; an idle animation keeps a faint highlight moving when the pointer is away.
- **Props**: `children`, `size`, `radius`, `tint`, `tintOpacity`, `blur`, `textColor`, `lineColor`,
  `baseColor`, `intensity`, `idleIntensity`, `shineSize`, `shineFade`, `thickness`, `glow`, `speed`,
  `followMouse`, `proximity`, `autoAnimate`, `type`. Extends native button attrs (`onClick` etc. just
  work).
- **Deps**: none beyond React — vanilla WebGL2, same hand-written-shader pattern as Flux Lines.
- **Perf**: one small WebGL2 context per button instance. Fine for the handful of primary-action
  buttons the brief scopes this to (Sign in, Join, Share, Next game, Play, New game) — NOT meant for
  every button on the site (would be many simultaneous GL contexts; browsers cap concurrent WebGL
  contexts, typically 8-16).
- **Cleanup**: 9 cleanup hits — RAF cancelled, listeners removed, GL context released on unmount,
  consistent with Flux Lines' pattern.
- **Reduced motion**: 1 hit — needs verification at integration time whether it fully stops the idle
  animation or just slows it; treat as a gap to verify, mitigate with `autoAnimate={false}` under
  `prefers-reduced-motion` from our wrapper regardless.
- **Touch**: pointer events used (4 hits) — `followMouse`/`proximity` degrade gracefully with no
  hover on touch (button still works as a normal button, just without the glide highlight).
- **Keyboard/ARIA**: it's a real `<button>` — native keyboard/focus behaviour applies.
- **Where we use it**: the 6 primary actions named in the brief only (item 7) — never a secondary or
  per-game button, to keep the concurrent-WebGL-context count low.

## 7. Magic Bento (`components/magic-bento`)

"A bento grid of feature cards with live artwork, edge light that follows the cursor and a click
wave."

- **What it does**: a CSS-grid of cards. Mouse position is tracked and written into CSS custom
  properties (`--mb-x`, `--mb-y`, etc.) each frame, driving two radial-gradient layers per card (a
  "spotlight" that follows the cursor across the whole grid, and a per-card border glow that's
  stronger the nearer the cursor is) plus an optional small Canvas-2D particle drift inside each
  card and a click "wave" ripple. Optional 3D tilt and magnetism (card nudges toward the cursor) per
  card.
- **Props**: `items`, `columns`, `rowHeight`, `gap`, `radius`, `theme` (`dark|light`), `glowColor`,
  `textAutoHide`, `enableBorderGlow`, `enableSpotlight`, `spotlightRadius`, `enableStars`,
  `particleCount`, `enableTilt`, `enableMagnetism`, `clickEffect`, `intro`, `disableAnimations`,
  `onItemClick`, `className`, `style`.
- **Deps**: no WebGL — all CSS custom properties + one Canvas 2D context for the particle layer, plus
  (dropped) `@hugeicons/*` for the demo cards' app-logo icons, replaced with ours.
- **IMPORTANT — the demo content is not reusable**: the published component (1417 lines) ships with
  hard-coded demo card content (an "Analytics" chart card, a "Dashboard" bar chart, a "Launch plan"
  collaborator-avatars card, a "Push to main" CI card…) built specifically to showcase a SaaS
  marketing site. Only the grid mechanic (the `--mb-*` CSS-variable-driven spotlight/glow/particle/tilt
  system and its pointer/resize/intersection-observer plumbing) is reusable; the card content types
  (`MagicBentoVisual = 'analytics'|'dashboard'|...`) and all demo card markup get stripped and
  replaced with our own `GameTile` content (icon, title, today's-done state) in the Build phase.
- **disableAnimations prop**: exists and is the explicit reduced-motion / low-power escape hatch —
  this is what our wrapper sets from `prefers-reduced-motion` (1 direct hit on
  `prefers-reduced-motion`/`useReducedMotion` in source — confirm it's wired to `disableAnimations`
  internally or pass it ourselves at integration time).
- **Cleanup**: 16 cleanup hits — resize observer, pointer listeners, RAF all torn down; the most
  thoroughly cleaned-up of the 7.
- **Touch**: 4 touch/pointer hits — spotlight/tilt/magnetism are inherently hover-only effects; on
  touch they simply don't trigger (no error), cards still work as tap targets. `clickEffect` (the
  wave) fires on tap too.
- **Keyboard/ARIA**: 12 hits — cards are focusable/clickable elements; verify `onItemClick` targets
  render as real `<a>`/`<button>` at integration (the Hub's 15 game tiles need to be real links for
  keyboard/screen-reader users, not click-handler-only divs).
- **Perf on a phone**: the per-frame CSS-variable writes across up to 15 grid cells plus Canvas 2D
  particles in each is the heaviest of the "cheap" components here — `particleCount` should be
  lowered or `enableStars` disabled on small/low-power viewports; FPS will be measured at Build-phase
  checkpoint 2 on a throttled-CPU mobile profile per the brief.
- **Where we use it**: Hub (15 game tiles), Profile stats, Leaderboard's top section (brief item 7).

---

## Fonts

One font replaces Fredoka (site) + Nunito (site body) + every per-game `@fontsource` import. Needs
to read as rounded/friendly/playful on a black background, and stay legible at small sizes (Wordle
tile letters, Sudoku grid digits, hub tile labels). All three are already Google-Fonts-backed and
available via `@fontsource`.

1. **Baloo 2** *(new install: `@fontsource/baloo-2`)* — rounded Devanagari-heritage display sans,
   full 400–800 weight range, big x-height holds up well at small sizes despite being very rounded.
   Reads the most "playful/flowy" of the three.
2. **Quicksand** *(already installed)* — soft geometric-rounded sans, lighter/airier than Baloo 2.
   Thin strokes at regular weight can thin out at very small sizes (Sudoku digits) — mitigated by
   using weight 600/700 for anything under ~16px.
3. **Nunito** *(already installed, currently the site's body font)* — rounded terminals but much more
   restrained/neutral than the other two; safest legibility choice, least "flowy."

Rendered on a hub mock, a Wordle row and a Sudoku grid at `docs/redesign/checkpoint-1/fonts-*.png`
(see Checkpoint 1 below) for the human to pick from.

## Colour

Token scale derived from brand pink `#E89EB8` (HSL ≈ `343° 64% 79%`) on near-black surfaces (not pure
grey — a very dark warm-pink-tinted charcoal, consistent with the "black base" direction and with how
`--brand-bg` is already a tinted colour rather than pure white in the current light theme).

Full scale, contrast checks, the colour-blind-safe semantic re-tuning for every game's signal colours
(Wordle/Quordle, Connections' 4 levels, Sudoku, Mini, Zip, Bee, Globle's heat scale, chess squares),
and the deuteranopia simulation are built and screenshotted as part of Checkpoint 1 (see below) — kept
out of this prose file since they're inherently visual; the mock itself is the source of truth for the
human's review.

## Icons — SVG Repo "Dazzle Line"

Licence and full icon list/attribution are recorded in `docs/redesign/HANDOFF.md` (licensing
decisions belong with the file list of what was copied, per CLAUDE.md's reuse rule). Summary: all
icons sourced from svgrepo.com's Dazzle Line monocolor collection, stored as `currentColor` React
components under `src/components/icons/`, one hand-drawn addition (matched stroke width/caps/24px
grid) where the collection had a gap — see HANDOFF.md for which.

## Build-plan deviations flagged here (expanded in HANDOFF.md)

- No `gsap`/`ogl`/`three` added — not needed by any of the 7 components as published. If a phase-2
  game asks for one specifically, that's a new decision, not inherited from this phase.
- `@hugeicons/*` from 3 of the 7 components' source is dropped in favour of our own Dazzle-Line-based
  icons; this keeps us at zero new icon packages instead of one extra.
- `GlideSelect` cannot be used as-is for `GlideCombobox` (phase 2) — it has no text input or filter
  logic. Flagged above; worth the human's attention before phase 2 prompts are written, since the
  brief's phase-2 template currently reads as "adopt GlideCombobox" assuming it's closer to a drop-in.
