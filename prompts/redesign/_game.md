# Redesign agent procedure (shared by every prompts/redesign/<id>.md)

This is **phase 2** of the pink-on-black redesign (see `docs/redesign/`). Phase 1 — the design
system, shared components, site pages and navigation — is already finished and merged to main.
You are one of ~14 agents restyling one game each, at the same time, each in its own git worktree.
Read CLAUDE.md fully first, especially the "Design" section, "Game contract" and "Parallel work
rules". Then follow these steps. **Work without waiting for approval.** The human reviews your
finished branch, so don't stop to ask questions: when something is ambiguous, pick the option that
best fits CLAUDE.md's "Design" section, note it in HANDOFF.md, and continue.

## 0. What's already done — don't redo or fork it
- **Site tiers, tokens, fonts**: `src/styles/brand.css`'s `--brand-*`/`--game-*`/`--tile-*` token
  names are frozen (CLAUDE.md "Parallel work rules"); your `theme.css` may override game-tier
  *values* only. One font site-wide (`"Quicksand", sans-serif`, via `--game-font`) — don't add a
  per-game `@fontsource` import, even if your game's `theme.css` or RESEARCH.md still references one
  from before the redesign.
- **`AppShell`** (mounts `FluxLines`, the animated app-root background, once at the route root) and
  **`GameLayout`/`SiteHeader`/`HowToPlayModal`/`ResultModal`** are fully restyled and functional.
  Theme them via tokens from your `theme.css` only — never fork or copy them into your game folder.
- **`src/components/fx/`**: `FlipCard`, `MagicBento`, `JellyRadio`, `GlideSelect`, `SpecularButton`,
  `useSlotSpring`, `GlideCombobox`. Built and used elsewhere on the site already; **not yet wired
  into any individual game** — that's part of what phase 2 is for. Your prompt says which (if any)
  apply to your game. Read the component/hook's own doc comment before using it.

## 1. A gotcha already found and fixed once — don't reintroduce it
If your board does its own pointer-driven dragging (not just tap/click/keyboard), it needs
`{...noSwipeProps}` (`src/lib/noSwipe.ts`) spread on the board's outermost element, so a drag on the
board doesn't also drag `FluxLines`' cursor-magnet background around, and so `GameLayout`'s edge-swipe
prev/next gesture doesn't mistake a board drag for a page-switch swipe. Two things about it already
bit three real games this session (Globle, Zip, chess) — read `src/lib/noSwipe.ts`'s own comment
before touching any pointermove handler:
- It must be the **bubble-phase** `onPointerMove` prop, never `onPointerMoveCapture` — capture fires
  before the event reaches the board's own interactive descendants and silently kills their own drag
  handling too.
- If your board's root element **already has its own `onPointerMove` handler**, do **not** spread
  `{...noSwipeProps}` after it — JSX prop spread is last-wins, not compose, so it silently replaces
  your handler. Spread `{...noSwipeProps}` *before* your own `onPointerMove` prop in JSX, and call
  `e.stopPropagation()` as the first line of your own handler instead (see `src/games/zip/components/
  Grid.tsx` or `src/games/chess/components/Board.tsx` for the pattern already fixed this way).
Most games don't do any of this (tap/keyboard only) — if yours doesn't, ignore this section.

## 2. Restyle
- Read your current `src/games/<id>/theme.css` and components. Most games still have their
  *original* pre-redesign palette (own choice from the phase-1 build) — your job is to make it feel
  cohesive with the new pink-on-black site while keeping the game's own identity through colour and
  texture (CLAUDE.md "Design": never through font or background, those are shared now).
- Compute actual contrast ratios for anything that carries meaning (correct/present/absent,
  given/entry/error, etc.) against the new `--game-bg`/`--game-surface` — don't eyeball it. Note the
  ratios in a comment, the way `src/games/connections/theme.css` and `src/games/chess/theme.css`
  already do.
- Re-tune your signature animation(s) (flips, shakes, merges, slides, reveals) for the new "flowy"
  feel if it still looks like it's fighting the old light-background version. Everything must honour
  `prefers-reduced-motion` — confirm, don't assume, since this should already be true from phase 1.
- `meta.ts`'s `howTo` surfaces through the shared `HowToPlayModal` now — read it with fresh eyes and
  polish the wording if it's sparse or was written before the modal existed.
- Apply any game-specific items from your own prompt file.

## 3. Verify
- `PORT=<your port> pnpm dev`. Check at 375px wide, with a physical keyboard, and with
  `?date=` set to at least 2 different days. If your board does pointer dragging, actually drag it —
  don't just read the code (see §1: this exact class of bug passed a code read clean three times
  this session and was only caught by dragging the board for real).
- `playwright-cli open --headed` for any screenshot — headless Chromium often has no WebGL2, so a
  screenshot that happens to include `FluxLines` or `SpecularButton` will look broken even when the
  code is fine (see CLAUDE.md "Design").
- `pnpm test` and `pnpm build` pass.
- `node scripts/check-scope.mjs <agent-id>` passes (the same `<agent-id>` as your old phase-1 scope
  check — phase 2 doesn't add new scopes).

## 4. Finish
1. Write `src/games/<id>/HANDOFF.md` (or append to the existing one): what you changed, any
   deviations from your prompt and why, 3-5 things the human should check by hand, "Shared changes
   requested" (exact file/change/reason, or "None").
2. Stop your dev server. Commit everything in small steps ("redesign/<id>: ..."). Don't push or merge.
3. Reply with a 5-line summary: done or blocked, test count, shared changes requested, top review item.
