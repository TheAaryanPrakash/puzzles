# Redesign — Checkpoint 1 handoff

What was researched and built on the way to Checkpoint 1, what deviates from the brief, and what
the human needs to decide or revisit before the Build phase starts.

## React Bits files copied

All 7 live under `src/components/fx/__preview__/` — **throwaway**, built only to prove the
components work with our tokens for Checkpoint 1 (see the comment at the top of
`DevRedesignPreview.tsx`). The real adapted versions get built fresh at `src/components/fx/`
(no `__preview__`) in the Build phase, with full keyboard/ARIA/touch/reduced-motion/cleanup
wrappers per the gaps noted in `RESEARCH.md`.

| File | Source |
|---|---|
| `FluxLines.tsx` | reactbits.dev/backgrounds/flux-lines |
| `JellyRadio.tsx` | reactbits.dev/micro/jelly-radio |
| `FlipCard.tsx` | reactbits.dev/micro/flip-card |
| `CodeSlots.tsx` | reactbits.dev/micro/code-slots |
| `GlideSelect.tsx` | reactbits.dev/micro/glide-select |
| `SpecularButton.tsx` | reactbits.dev/components/specular-button |
| `MagicBento.tsx` | reactbits.dev/components/magic-bento |

**Licence**: React Bits — MIT + Commons Clause License Condition v1.0, Copyright (c) 2026 David
Haz (`github.com/DavidHDev/react-bits/LICENSE.md`). Pre-approved exception to CLAUDE.md's licence
rule for this redesign only. Permits use "as part of an application, website, or product"; the
Commons Clause forbids selling, sublicensing or redistributing the components themselves (alone,
bundled, or ported) — not a concern for an invite-only friends site. Each file above carries a
2-line header comment with the source URL and licence name; the full text is quoted in
`docs/redesign/HANDOFF.md` (this file, above) rather than duplicated 7 times.

**Dropped dependency**: 3 of the 7 (`CodeSlots`, `GlideSelect`, `MagicBento`) imported
`@hugeicons/react` + `@hugeicons/core-free-icons` for a checkmark/chevron/demo-card glyphs. Not
installed — CLAUDE.md's icon rule for this redesign is SVG Repo Dazzle Line only, so those spots
use inline `✓`/chevron markup or our own icon set instead (see `RESEARCH.md` per-component notes).

## Packages added

| Package | Why |
|---|---|
| `@fontsource/baloo-2` | 3rd font candidate for Checkpoint 1 |

No `gsap`, no `ogl`/`three` — none of the 7 components import a WebGL helper library; two
(`FluxLines`, `SpecularButton`) hand-write their own WebGL2 shaders with zero dependency, and
`MagicBento`'s particle layer is plain Canvas 2D. See `RESEARCH.md`'s headline finding.

## Icons — SVG Repo "Dazzle Line": blocked, hand-drawn placeholders used instead

**svgrepo.com is unreachable from browser automation.** Both the original research session and a
fresh verification just now (`playwright-cli goto https://www.svgrepo.com/collection/dazzle-line-icons/`,
headed Chromium) hit the same wall: Vercel's bot-protection checkpoint, HTTP 429, "Vercel Security
Checkpoint" interstitial. Not a one-off — confirmed twice, independently.

**What's shipped instead**: all 34 icons (15 games + share, stats, help, prev, next, menu,
settings, profile, leaderboard, groups, archive, close, check, undo, hint, clock, trophy, flame,
copy) are hand-drawn to match Dazzle Line's general look — 24px grid, rounded line strokes, 1.75px
weight, round caps/joins — stored as `currentColor` React components under
`src/components/icons/`. Each file has a one-line comment flagging it as a placeholder. No licence
attribution needed for these (original work), but they are a stand-in, not the real asset.

**Before the Build phase** (or whenever svgrepo.com is reachable — try from a normal signed-in
browser session, not automation, since the block appears to target bot traffic specifically):
pull the real Dazzle Line SVGs and swap them in one-for-one, keeping the same file names and
`currentColor` + 24px-viewBox shape so nothing else needs to change. This is flagged here instead
of silently shipping placeholders as final.

## A real bug this round found and fixed: WebGL silently fails in headless Chromium

`FluxLines` and `SpecularButton` (both hand-written WebGL2 shaders) rendered as **blank white
boxes** in the first checkpoint-1 screenshot pass — looked like a shader or context-creation bug.
It wasn't: headless Chromium (the default for `playwright-cli open`/`goto` with no flag) often has
no WebGL2 support, so `canvas.getContext('webgl2', ...)` silently returns `null` and the component's
effect returns early (by design — see `FluxLines.tsx`'s own `if (!container || !canvas || !gl) return
undefined;`), leaving an empty transparent canvas. Confirmed by re-running the exact same page with
`playwright-cli open --headed`: both components rendered correctly, no shader compile errors in the
console either time.

**Takeaway for every future screenshot in this redesign that touches `FluxLines` or
`SpecularButton`** (checkpoint 2, phase 2 per-game screenshots, etc.): use `playwright-cli open
--headed` (or `--browser chrome`), not the headless default, or the WebGL layer will silently not
render and the screenshot will look broken when the code is fine. Worth a one-line note in
whichever skill/doc future agents read before taking redesign screenshots.

## Two demo-wiring bugs also fixed (not React Bits bugs — our own demo props)

`CodeSlots` and `GlideSelect` looked broken (empty / completely unstyled) in the first pass for two
unrelated, mundane reasons, both now fixed in `DevRedesignPreview.tsx`:
- `CodeSlots` is a **numeric-only** OTP input (`digitsOf()` strips everything but `0-9` via regex)
  — the demo passed `defaultValue="PINK"`, which has zero digits, so every slot was empty. Changed
  to a real numeric value (`"4821"` of length 5, showing one empty trailing slot).
- Both `CodeSlots`' `slotColor` and `GlideSelect`'s `surfaceColor` were passed the same hex as the
  demo `Card` wrapper's own background (`SURFACE`), so the control's background was styled
  correctly (verified via computed styles) but **identical to the card behind it** — invisible, not
  unstyled. Introduced a distinct `CHIP` colour (`#3c2530`) for both.

Neither of these is a signal about the real Build-phase integration — there we'll be using actual
brand tokens (`--brand-surface`, `--brand-surface-2`, etc.), which are already distinct from each
other by design (see `brand.css`).

## Deviations already flagged in RESEARCH.md (repeated here for visibility)

- No `gsap`/`ogl`/`three` added — not needed by this specific set of 7 components.
- `GlideSelect` has no text input or filter logic — `GlideCombobox` (phase 2, for
  Worldle/Flagle/Globle/Travle/States) needs real new engineering on top of it, not just styling;
  flagged before phase-2 prompts are written.

## Skills used

`design-system`, `ui-ux-pro-max`, `web-design-guidelines` (per `RESEARCH.md`'s own note).
`design-taste-frontend`, `high-end-visual-design`, `modern-web-design`, `ui-styling`,
`motion-framer`, `brand` are Build-phase skills, not yet used.

## State at Checkpoint 1

`pnpm test` and `pnpm build` both pass (see below). All work is committed on `main` in small
steps, nothing pushed. Checkpoint-1 screenshots are final (regenerated after the headless-WebGL
and demo-prop fixes above) at `docs/redesign/checkpoint-1/`:
- `fonts.png` — Baloo 2 / Quicksand / Nunito on hub mock, Wordle row, Sudoku grid.
- `colors.png` — full pink-on-black scale, WCAG AA contrast table, per-game semantic colours in
  normal vision and simulated deuteranopia.
- `icon-sheet.png` — all 34 hand-drawn placeholder icons (see "Icons" above).
- `components-demo.png` — all 7 React Bits components live on our pink/black tokens.

Waiting on the human's choices (font, exact colour tuning, icon approach) before the Build phase
starts.

## Build phase — multi-group leaderboard check (item 8)

Font (Quicksand) and colours approved; Build phase started 2026-10-12. This section covers one
parallel chunk of it: "seed a local user in 3 groups with overlapping members... verify the
site-wide board counts each person ONCE... add PGlite tests for site-wide no-double-counting and
group isolation."

**Production SQL (`0004_groups.sql`'s `leaderboard()`): no bug found.** Its `member_scope` CTE
selects distinct rows straight from `profiles` for `scope='global'` rather than joining
`group_members` — structurally incapable of fanning a member's points out across their several
group memberships. Added 6 new PGlite assertions to `supabase/tests/schema.test.mjs` proving this
for a member (E) in 3 overlapping groups: her own board in each of the 3 groups, and the global
board, all show her one real win as 1 point/1 win/1 played — not 3× — plus isolation for a member
who *left* a group (not just one who never joined, which was already covered). **Verified these
tests actually catch the bug class**: temporarily patched `member_scope` to join `group_members`
(the fan-out shape these tests exist to rule out), reran `pnpm test:db`, watched the new "sums
once" assertion fail (100 passed, 1 failed), then reverted the migration file — `git status` confirms
zero diff on it now.

**Local dev adapter (`local.ts`): one real bug found and fixed.** Its global leaderboard deduped
members by `displayName`, not `userId` — harmless today only because the local fixture's one
simulated identity always uses the same constant display name, but a real latent bug: two
*different* people sharing a display name would have wrongly collapsed into one leaderboard row.
Fixed by deduping on `userId` instead (keeping the first `displayName` seen per id). The public
`DataSource` API has no way to add a *third party* to an existing local group (only the one
simulated user can join/create), so testing genuine overlap needed direct seeding — exported
`writeGroups`/`writeMembers` from `local.ts` (parallel to the already-exported `readGroups`/
`readMembers`) for `local.test.ts` to use. Two new tests: a member in 3 overlapping groups appears
once on the global board; a group's board never includes someone who only shares a *different*
group. **Verified these catch a regression** the same way — reverted the dedup fix locally, reran,
watched `expected 3 to be 1`, restored the fix.

`pnpm test`: 836 passing (was 834). `pnpm test:db`: 101 passing (was 95).

## Build phase — all 15 games' theme.css + font cleanup (item 1, second half)

Every `src/games/<id>/theme.css` rewritten to pink-on-black and every per-game `@fontsource`
import removed from `index.tsx` (15 games). Site base (`--game-bg`/`surface`/`surface-2`/`border`/
`fg`/`muted`) is no longer overridden per-game anywhere — CLAUDE.md's rewritten "Design" section
says games differentiate through colour/tile/texture, not a separate background, so every game now
inherits the one shared near-black base from `brand.css` and differentiates only through its own
accent + semantic tile colours.

**A real contrast bug found across the approved Checkpoint-1 swatches**: the swatches in
`colors.png` were contrast-checked as *text/accent-on-black* pairs, but several games render the
exact same tokens as a **solid fill with hardcoded white text** (`Tile.tsx` in Wordle/Quordle:
`text-white` is a plain Tailwind class, not theme-aware). White-on-`correct`(#43b17a) measures
2.69:1, white-on-`present`(#e4a944) 2.09:1 — both fail 4.5:1 outright. Rather than darken the
*approved* swatches (the human already signed off on them visually), fixed the ink side instead:
`[data-game="X"] .bg-tile-correct { color: #140c0f }` etc. in Wordle/Quordle's theme.css — this
selector's specificity (0,2,0: one attribute + one class) beats Tailwind's bare `.text-white`
(0,1,0) regardless of source order, so it overrides without touching `Tile.tsx`. Chess hit the
same issue on its own re-derived square colours (now both mid-tone rose, where the pre-redesign
"light square = near-white, dark square = medium-rose" assumption no longer held) — fixed the same
way but using chess's own existing per-square-ink pattern (`--tile-coord-on-light/dark`), extended
to two new pairs (`--tile-move-dot-on-light/dark`, `--tile-outline-on-light/dark`) since the
cursor/hint outline and the move-dot both needed per-square ink too (outline via `--game-accent`
directly on the new light square measured 1.19:1). Every number in both games' theme.css comments
is freshly computed (WCAG relative-luminance formula, not eyeballed) — see the two files for exact
figures. **Worth flagging to whoever designs future Checkpoint-N swatch sheets**: if a swatch will
ever be used as a solid fill with a *fixed* text colour (not a per-swatch paired `-fg` token), test
white-on-swatch and dark-on-swatch at swatch-selection time, not after the fact.

**5 games had no Checkpoint-1 swatch** (worldle, flagle, travle, states, digits) — used judgment:
- **Worldle**'s 4-step proximity scale reuses the *already-approved* Globle heat-scale family
  (`far`/`cool`/`warm`/`hot`) — same "closer = hotter" concept, deliberate reuse not a new palette.
  Its country-silhouette SVG flips from dark-fill-on-light-map to light-fill-on-dark-map (the old
  near-black fill would have vanished into the new near-black map surface otherwise).
- **Flagle** keeps its "neutral surface, let the flag be the only strong colour" strategy — now a
  neutral *dark* instead of neutral *light*; `tile-correct`/`present` are plain approved swatches
  (used as text, not fills, in `GuessHistory.tsx`).
  dark pink-tinted sea now; start/end markers re-picked from the approved family for contrast against
- **Travle**'s dot/map-fill trio is the plain approved Wordle-family swatches (no text sits on
  these colours anywhere — confirmed in `GuessList.tsx`/`Map.tsx`); the atlas itself goes from a
  pale sea/land map to a dark one, start/end markers re-picked from the approved palette for pop.
- **States**'s `--game-accent` moves from rust to the approved "hot" coral (text-contrast re-
  derived: 5.92:1/5.59:1); `--states-indigo` and the silhouette fills are SVG-only (the file's own
  pre-existing comment exempts them from AA) and were nudged brighter for visibility on black,
  not rigorously re-derived — lower priority, flagged here rather than silently left exact.
- **Digits**'s 5 pastel round-circles are kept deliberately LIGHT (the one place nothing was
  inverted to dark) — on the new near-black board they read as confetti rather than needing to
  blend in, and their existing dark ink still clears AA against every one unchanged.

**Two intentional non-Quicksand font exceptions**, both functional (tabular-figure alignment for a
monospace digit/coordinate grid), not decorative — removed from "one font everywhere" on purpose,
documented in each theme.css's own comment:
- **Sudoku** (and Mini Sudoku, via the shared `Board.tsx`): IBM Plex Mono on the digit grid only;
  chrome (title, buttons) is Quicksand like everywhere else.
- **Chess**: IBM Plex Mono on the board's rank/file coordinate labels only.

**3 colour values deliberately left UNCHANGED — out of this pass's scope, flagged as "shared
changes requested"**: each pairs a CSS custom property (in scope) with a hardcoded JS/TS constant
in that game's `logic.ts` or `components/Grid.tsx` (out of scope — this pass was theme.css +
index.tsx font imports only) that **must stay byte-for-byte in sync** per each file's own existing
comment, since CSS custom properties can't reach into a `<canvas>`/SVG-`stroke`-interpolation
context portably:
- **Quordle**'s `--quordle-board-1..4` (indigo/teal/terracotta/amber) — synced with `logic.ts`'s
  `BOARD_COLORS`, used for the win-recap/share text.
- **Globle**'s heat-scale gradient — `logic.ts`'s `FAR_COLOR`/`CLOSE_COLOR` constants, currently
  still pale-gold→crimson, NOT the approved far/cool/warm/hot swatches from Checkpoint 1 (the
  `--globle-*` *surface* tokens in theme.css ARE updated; only the guess-heat gradient itself is
  not, since it lives entirely in `logic.ts`).
- **Zip**'s path gradient — `--zip-path-start`/`--zip-path-end` in theme.css now read pink→violet
  (start matches the exact approved "zip path" swatch), but `Grid.tsx`'s own hardcoded hex
  constants (its comment: "Keep these two in sync with theme.css's --zip-path-start/-end") were
  not touched and still say orange→purple — these three will visually mismatch until a follow-up
  pass with `logic.ts`/component access updates the JS side of each pair to match.

`pnpm test`: 836 passing, unchanged by this pass (CSS/import-only). `pnpm build`: passes once the
other two parallel forks' in-flight files also landed clean (saw transient TS errors from their
uncommitted `MagicBento.tsx`/`local.test.ts` mid-run — not from this pass's files, confirmed via
`git status` at the time).

## Build phase — real fx component library (item 2) and GlideCombobox

The `__preview__/` folder is gone — the real, adapted components now live directly at
`src/components/fx/*.tsx` (+ `useSlotSpring.ts`, `GlideCombobox.tsx`), and
`/dev/redesign-preview` is removed from `routes.tsx` along with it.

**Most of the 7 were already more complete than `RESEARCH.md` suggested** — reading each
component's actual source (not just the summary) found several "gaps" already closed:
- `FluxLines` already reads `prefers-reduced-motion` internally and freezes `time` advancement
  under it (acts as the brief's "still frame") — `RESEARCH.md` said it didn't. The one real gap:
  no `aria-hidden`/`role="presentation"` on the wrapper — added.
- `SpecularButton` already guards its idle auto-animation on `!reduce` (`spinning = s.autoAnimate
  && !reduce`) — no wrapper override needed, contrary to `RESEARCH.md`'s "verify" note.
- `FlipCard`, `JellyRadio`, `GlideSelect` — copied over unchanged; their ARIA/keyboard/reduced-motion
  handling in source matched or exceeded what `RESEARCH.md` expected (`JellyRadio`'s roving
  `tabIndex` + arrow-key nav was already correct, for instance).

**`MagicBento` needed real surgery**, not a copy:
- Removed the entire hard-coded SaaS demo-visual block (`DEFAULT_ITEMS`, the `MagicBentoVisual`
  union + `visual` item field, `VISUALS` map, the 6 `*Visual` components, the chart-curve math, and
  ~70 lines of demo-only CSS class constants — ~390 lines total). No `@hugeicons` import existed in
  this file after all (unlike `CodeSlots`/`GlideSelect` — `RESEARCH.md`'s note about it applied to
  the other two, not this one). The CSS rules in the `STYLE` template literal that targeted those
  now-dead classes (`.magic-bento__chart`, `__bar`, `__hub-node`, `__switch`, etc., ~30 lines) were
  **left in place** — they're inert (nothing can ever render those classes again) but harmless, and
  surgically trimming a few hundred lines out of one large CSS-in-JS template string under time
  pressure was a worse risk than the small bundle cost. Flagged here as a deferred cleanup, not
  silently skipped.
- Fixed a real a11y bug: a clickable item with no `href` rendered as `<div role="button"
  tabIndex={0}>` with **no `onKeyDown`** — keyboard-focusable but Enter/Space did nothing (a
  `role="button"` div doesn't get native key activation the way a real `<button>` does). Now
  renders a real `<button type="button">` (with a small reset: `border-0 bg-transparent p-0
  text-left` layered onto the same `CARD_CLASS`) when clickable and no `href`; an `<a>` when there
  is one. Verified live: Enter/click both fire `onItemClick` now (see Testing below).
- `disableAnimations` drove the JS animation engine's reduced-motion check correctly already (a
  local `reduced` read inside the engine's own effect, independent of the prop), but the
  CSS-attribute gate (`data-motion`/`data-intro`, used by the leftover demo CSS and the cell
  intro-fade) only checked the explicit prop — out of sync. Added a `prefersReducedMotion` state
  (matchMedia + change listener) and gate both attributes on `disableAnimations ||
  prefersReducedMotion`, so a caller who forgets to pass `disableAnimations` still gets correct
  behaviour from the OS setting.
- `items` now defaults to `[]`, not demo content — callers (Hub, Profile, Leaderboard, later) must
  pass their own tile data: `{ icon, title, description, href | onClick, colSpan?, rowSpan? }`.

**`useSlotSpring`**: NOT a copy of `CodeSlots` — it owns nothing. Takes `filled: boolean[]` (one
entry per tile slot) and returns one `{ fill, style: { transform, opacity } }` per slot, to spread
onto whatever a game already renders. Deliberately avoids `useTransform` per slot in a variable-
length array (a real Rules-of-Hooks hazard — hook call count must be stable across renders, and a
`.map()` over a dynamically-sized array doesn't guarantee that is a rule, not just a lint nag);
instead each slot gets its own plain `motionValue`s for `transform`/`opacity`, kept in sync
imperatively via `animate()`'s `onUpdate` callback (or a direct `.set()` on a reduced-motion jump).
Re-triggering a slot that's mid-animation jumps it back to 0 first, matching `CodeSlots`' own
`land()` behaviour, so a fast retype still shows a visible spring rather than a half-finished jump.

**`GlideCombobox`**: confirmed by reading its source that `GlideSelect` has no text input and no
filter logic at all (matches `RESEARCH.md`'s finding) — this is a new component, reusing only
`GlideSelect`'s visual language (corner-pop menu scale/opacity, a gliding highlight pill positioned
via `offsetTop`/`offsetHeight` of the highlighted row) and listbox ARIA shape.

**The States focus-loss bug named in the brief ("textbox goes passive until you click out and back
in") could not be reproduced.** Read `src/games/states/components/StateCombobox.tsx`, then live-
tested it (`playwright-cli`, headed): typed and submitted via Enter, typed and submitted via
mouse-click on a dropdown option, repeated across several consecutive guesses — `document
.activeElement` stayed on the input and it kept accepting keystrokes every time. The component
already does the two things that actually prevent this bug:
1. `onMouseDown` (not `onClick`) + `e.preventDefault()` on every option — stops the browser's
   native mousedown-triggered focus shift before it happens, rather than reacting to it after.
2. An explicit `inputRef.current?.focus()` immediately after committing a selection — a second,
   independent guarantee, redundant when (1) already held focus but a real fix if focus were lost
   for some unrelated reason (e.g. a parent re-render).
Neither this component's `key` nor its mount condition (`{!over && <StateCombobox/>}`) changes on a
non-game-ending guess, so there's no remount path either. **Conclusion**: either this was already
fixed in an earlier pass on this file, or the brief describes behaviour from an older version not
currently in the repo. `GlideCombobox` was still built defensively with both of the same guarantees
(see its file-header comment) plus a third `StateCombobox` and `GlideSelect` didn't need: the input
is never conditionally unmounted (no `{open && <input/>}`-shaped code anywhere), since a freshly
mounted input is unfocused by definition even when nothing looks different on screen.

**Testing**: built a throwaway smoke-test page (`src/pages/__smoketest.tsx` + a temporary
`/dev/smoketest` route), verified all 7 components + `useSlotSpring` + `GlideCombobox` render with
zero console errors (`playwright-cli open --headed`, per the WebGL gotcha above), exercised
`GlideCombobox` end-to-end (type → filter → click an option → `onSubmit` fires with the right value
→ input stays focused and clears), and exercised `MagicBento`'s new real-`<button>` tile (click
fires `onItemClick`). Deleted the smoke-test page and route afterward — decided against keeping a
permanent `/dev/fx` reference route for now, since the checkpoint-1 demo screenshots already serve
that purpose and phase-2 game agents will see these components in real use (Header, HowToPlay,
ResultModal, Hub) soon enough; worth reconsidering if later agents actually want one.

`pnpm test`: 836 passing (unchanged by this chunk — no new tests added, this was component-library
work, not app logic). `pnpm build` and `pnpm exec tsc -b --noEmit` both clean.

**Shared changes requested** (for whoever builds the header/background-mount, HowToPlay modal,
ResultModal and pages next): `FluxLines` is ready to mount at the app root as-is — no new wrapper
needed, just pass a "calm" prop set (lower `speed`/`mouseStrength`, `mouseInteraction={false}`) for
use inside game pages, and remember it needs `aria-hidden`'s parent container to have real
dimensions (`height`/`width: 100%` of something sized) since the component itself is `h-full
w-full`. `MagicBento`'s `items[].onClick` handler signature is `(event) => void` per item, separate
from the top-level `onItemClick={(item, index) => void}` — either works, pick one convention for
the Hub's 15 tiles rather than mixing.

## Build phase — header/navigation, ResultModal: bugs found during live review

Three forks landed real, working code for the app-root background mount, header/navigation,
ResultModal's flip + Next-game button, and all 15 pages this round — but two of them were cut off
by a session rate-limit mid-verification, and a third explicitly flagged its own browser-based
verification as incomplete. Rather than take "tests pass, build passes" as sufficient, everything
was live-verified in an actual browser afterward (`playwright-cli`, headed — the WebGL gotcha above
still applies). That review surfaced three real, user-facing bugs, all now fixed and re-verified:

**1. A CSS stacking-context bug made every "plain" page invisible underneath the new background.**
`AppShell` mounts `FluxLines` as `position: fixed` at the route root, ahead of `<Outlet/>` in DOM
order, relying on normal DOM-order painting to keep it behind routed content. That assumption is
wrong: per the CSS painting-order algorithm, *positioned* elements (anything with a non-static
`position` — `fixed` always qualifies, even at `z-index: auto`) paint in a later phase than normal
in-flow, non-positioned siblings, **regardless of DOM order**. `GameLayout`'s root has no
position/transform of its own, so its entire header and content — confirmed by screenshotting the
literal DOM elements and reading their computed styles, which were all correct; only the paint was
wrong — rendered completely invisible under the fixed background. `Hub` only escaped this by
accident, because `MagicBento`'s tilt/glow effects already use transforms (which promote an element
into the same later-painting category as `fixed`). Fixed in `AppShell.tsx` by wrapping `<Outlet/>`
in a `<div className="relative">`, which promotes every routed page into that same category,
making the whole app safe by construction instead of relying on each page discovering this by luck.
**Takeaway for future redesign work**: a plain, non-animated page component is exactly the shape
most likely to hit this invisibly — if a page "disappears" under the FluxLines background, check
this first before assuming a logic bug.

**2. `ResultModal` had a genuine infinite render loop**, not a performance issue — confirmed via
`ps`, a headed Chromium renderer pegged at 90%+ CPU and climbing, completely unresponsive (even a
trivial `page.evaluate` timed out). Root cause: `useTodayStatus(scoredGameMetas.map(m => m.id))`
called inline, recreating the array every render; the hook's own effect depends on that array by
reference, so it refired every render → `setState` → re-render → new array → refire, forever. The
hook's own JSDoc (added earlier this session specifically to prevent this) says to memoize the
array — `GameLayout` did; `ResultModal` didn't. Fixed with `useMemo(() => ..., [])`, since
`scoredGameMetas` is a module-level constant. **A fork had already hit this exact symptom and
misattributed it to "resource contention from concurrent forks."** It reproduced identically running
solo. Worth remembering: an "unresponsive browser" during verification is worth a `ps`/CPU check
before assuming it's an environment/tooling problem.

**3. `FlipCard` swallowed clicks on any interactive element inside its `front`/`back` content.**
Its `onPointerDown` unconditionally calls `setPointerCapture` on the card's root — even with
`flipOnClick={false}` and `draggable={false}`, which is how `ResultModal` uses it (the flip is
timer-triggered, not click-triggered). Confirmed live: clicking ResultModal's Share button or
Next-game button did nothing at all — no error, no navigation, no visual feedback. Fixed in
`FlipCard.tsx` by checking, at the top of `onPointerDown`, whether the pointerdown's target has a
real interactive ancestor (`button`/`a`/`input`/`select`/`textarea`/`[role=button]`/`[role=link]`)
other than the card's own root, and bailing out of the capture/drag-grip logic entirely when it
does — letting the nested control handle its own interaction normally. This is a `FlipCard`-level
fix, not a `ResultModal` workaround, so it protects every future consumer (the HowToPlay modal,
still to come, will hit the identical bug if its back face has any interactive content). Verified
live: Share now shows its "✓ Copied!" feedback, Next-game navigates correctly in both the
mid-hub-order and all-done-so-"Back to hub" cases.

**Smaller fixes made during the same review**: `ArchivePicker` was filtering already-played dates
out of the list entirely rather than showing them tagged — meaning there was no way to revisit a
finished puzzle's read-only result via the archive, even though that's valid per CLAUDE.md's game
contract ("finished play → read-only finished board"); now all dates stay in the list, played ones
tagged. `SiteHeader` still had the pre-redesign flex layout (title centered to leftover space, not
the page) — brief item 4 named both `GameLayout` *and* `SiteHeader` for the 3-column-grid fix; only
`GameLayout` had landed. `GameLayout`'s prev/next/archive/stats/help buttons were still raw emoji
(🗓️/📊/❓ are full-colour glyphs that ignore `currentColor`, which is why ❓ rendered red instead of
on-theme) instead of the Dazzle-Line icon components already built for exactly these slots —
swapped in `PrevIcon`/`NextIcon`/`ArchiveIcon`/`StatsIcon`/`HelpIcon`. Mini Crossword's Hub tile
icon was invisible (`hubAccent` was a pre-redesign dark value never updated by the theme-css pass,
since `hubAccent` lives in `meta.ts`, outside that pass's scope) — fixed, and the other 14 games'
`hubAccent` values were spot-checked against the new dark cards (computed contrast ratios) and left
alone; several sit under the strict 3:1 UI-graphics threshold on paper but read fine in practice
(hue difference, not just lightness, carries real perceptual weight) — worth a human eye on
`chess`/`mini-sudoku`/`quordle`/`sudoku` specifically if a future pass wants to tighten this further,
but not re-litigated here since only Mini was actually unreadable.

`pnpm test` (836 passing) and `pnpm build` both green after every fix above. All committed on
`main` in small, separately-described steps; nothing pushed.
