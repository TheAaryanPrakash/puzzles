# Checkpoint 2 — build phase complete

All of the Build section is done and live-verified (not just `pnpm test`/`pnpm build` passing —
see `docs/redesign/HANDOFF.md` for real bugs that passed both and were only caught by actually
clicking through the app in a browser). Screenshots below at 375px and 1280px.

The original `game-result-*.png` pair was retaken: it had been captured from a *lost* game whose
card height exceeded the screenshot viewport, so the shot cut off before the "Next game" button —
looked, out of context, like the button might be missing entirely. Played Wordle live
(`playwright-cli`, headed, a real guess sequence ending in the correct answer) to check: the "Nice!"
title, win stats, and "Next: Quordle" button all render correctly together. Replaced both files with
that run. (The "Amal — 4 guesses" friends-board row is the local dev adapter's seeded fake-friends
generator — `FAKE_FRIENDS` in `src/lib/data/local.ts`, deterministic per `gameId:date`, not real
play data — pre-existing dev-mode behavior, not something this redesign changed.)

## Screenshots (`docs/redesign/checkpoint-2/`)

| File | What it shows |
|---|---|
| `hub-375.png` / `hub-1280.png` | Hub as a Magic Bento grid, 15 tiles, Wordle (flagship) + chess sized larger |
| `game-header-375/1280.png` | A game page's header (Wordle) — 3-column centered title, prev/next, game-switcher, archive/stats/help icons |
| `game-howto-375/1280.png` | The shared HowToPlayModal, auto-opened on first visit |
| `game-result-375/1280.png` | ResultModal's flip-revealed result, stats, guess distribution, friends board, Next-game button |
| `profile-375/1280.png` | Profile stats as a bento grid |
| `leaderboard-site-375/1280.png` | Leaderboard, "Everyone" scope |
| `leaderboard-group-375/1280.png` | Leaderboard, "My group" scope, JellyRadio tabs |
| `signin-375/1280.png` | Sign-in, SpecularButton (neutral tint, so the Google mark stays legible) |
| `join-375/1280.png` | Join, plain inputs (per the brief — no GlideCombobox here), SpecularButton |
| `finale-375/1280.png` | Finale, previewed via `?date=2027-01-23` + 3 seeded wins (the dev-only unlock path) |

## FPS

Measured via in-page `requestAnimationFrame` counting over 3s windows (this dev machine, headed
Chromium — `playwright-cli`'s headless mode has no reliable WebGL2, see `HANDOFF.md`):

- **Hub** (full FluxLines effect + MagicBento grid): **60 fps**, 181 frames / 3.00s.
- **Game page, "calm" mode** (Wordle): **60 fps**, 181 frames / 3.01s.

No CDP CPU-throttling API is exposed through `playwright-cli`, so a true "throttled mobile CPU"
number isn't available from this tooling. As an approximation, I added synchronous busy-work
inside a competing `requestAnimationFrame` callback to simulate main-thread pressure:

- ~22ms of injected work/frame → **46 fps** (181→138 frames/3s) — still smooth, no visible issue.
- ~45-60ms of injected work/frame, sustained 7s → frame rate drops further, and I confirmed
  `AppShell`'s frame-rate watchdog (`useFrameWatchdog`, trips after ~2s of sustained sub-30fps)
  correctly passes `paused` down to `FluxLines`, which **stops its own internal RAF loop entirely**
  once settled (confirmed via `requestAnimationFrame` no longer firing for it) rather than just
  rendering an unchanging frame — the cheaper of the two "still frame" implementations, and the
  reason `AppShell`'s own comment was corrected this round (it previously implied the canvas
  unmounts on degrade; it doesn't, it freezes). A real low-end-device number would need an actual
  CDP throttle session (DevTools' own CPU throttling, or `--cpu-throttling-rate` if this project
  later scripts Lighthouse) — flagging this as a gap in what I could measure, not a gap in the
  protection itself, which is implemented and does engage.

## Bundle size

Main bundle `index.js`: **499.23 kB (159.52 kB gzip)**, up from **410.79 kB (130.41 kB gzip)**
before this redesign started (+88.4 kB raw / +29.1 kB gzip, +21-22%) — the cost of the fx library
(FluxLines, MagicBento, FlipCard, JellyRadio, GlideSelect, SpecularButton, GlideCombobox,
useSlotSpring), AppShell, HowToPlayModal, 34 icon components, and every page's restyle, all in the
shared/eagerly-loaded bundle. No new runtime npm packages were needed for any of this — the 7
React Bits components only import `react` + `motion` (already installed) or hand-write their own
WebGL2 shaders with zero dependency (see `RESEARCH.md`'s headline finding). Chess's engine/pieces
remain separate, lazily-loaded, unaffected (`chess-*.js` chunks unchanged in shape).
Total `dist/`: 13 MB.

## Tests

**836 passing** (58 test files), up from 834 before this redesign started — the 2 new tests are
the multi-group leaderboard-isolation/no-double-counting checks (`src/lib/data/local.test.ts`).
`pnpm test:db` (PGlite schema tests): **101 passing**, up from 95 — 6 new assertions covering the
same multi-group scenario against the production SQL. `pnpm build` clean (`tsc -b` + `vite build`).

## What's NOT yet done (by design — this is Checkpoint 2, not the finish line)

- The real SVG Repo "Dazzle Line" icons — still the documented hand-drawn placeholders
  (`docs/redesign/HANDOFF.md` "Icons"), svgrepo.com is bot-blocked from automation.
- Phase 2 (per-game restyle prompts, `REDESIGN=1` launch mode) — not started; the brief asks for
  this only after Checkpoint 2 approval.
- A handful of games' `hubAccent` values sit under the strict 3:1 UI-graphics contrast threshold on
  paper (chess/mini-sudoku/quordle/sudoku) though they read fine in practice — noted in
  `HANDOFF.md`, not re-litigated since only Mini Crossword's was actually unreadable.

Waiting for your review before writing the phase-2 prompts and `REDESIGN=1` launch mode.
