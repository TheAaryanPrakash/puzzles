# Redesign agent `chess`: Chess

Game id: `chess` · Dev server port: **5214** · Scope check: `node scripts/check-scope.mjs chess`
(covers `src/games/chess/` and `src/lib/data/chess.ts`, same as phase 1 — chess wasn't part of the
original 13-agent fan-out, see CLAUDE.md "Chess", but uses the same scope key)

Read CLAUDE.md fully, including the whole "Chess" section (approved package/licence exceptions,
the "Play a Friend" multiplayer mode, the not-scored structural rules) before touching anything.
Then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: board already done
`src/games/chess/theme.css` is already redesigned — the board is the approved Checkpoint-1 pink
light/dark squares, with a full re-derived contrast audit (checker distinguishability, coords,
move-dot, cursor/hint outline, all computed per-square-colour, documented in the file's own
comment). **Don't touch the board colours or re-derive this audit.** Piece art (RhosGFX, CC0) is
unaffected and correct as-is.

## Focus: wire in `JellyRadio` for the settings modal
`src/components/fx/JellyRadio.tsx` isn't used anywhere yet. Read its own prop doc comment first.

- `src/games/chess/components/SettingsModal.tsx`'s "Set up your game" dialog has 3 plain
  radiogroups built on a shared internal `Picker` component (Difficulty, Play as, Clock — all
  `role="radiogroup"`/`role="radio"`). Replace `Picker`'s internals (or swap it for `JellyRadio`
  directly at each of the 3 call sites) — keep the same `options`/`value`/`onChange` shape so you
  don't have to touch `SettingsModal`'s own state (`difficulty`/`side`/`clockPreset`).
- `JellyRadioItem` accepts a plain string or `{ value, label, icon?, disabled? }` — your 3 option
  lists (`DIFFICULTIES`, `SIDES`, `CLOCKS`) should map onto this directly.
- Theme it to match the board's approved pink palette (`chipColor`/`activeColor` etc.), not a raw
  default — check contrast the same way the board's own comment does, don't eyeball it.

## Also check
- "Play a Friend" mode (`src/games/chess/friends/`) reuses the same `Board`/`theme.css` — confirm it
  still looks right after any change here; it's a separate top-level component, not shared state,
  but shares the visuals.
- `GameResultModal.tsx` is chess's own result modal (not the shared site `ResultModal` — chess never
  uses it, see CLAUDE.md "Chess") — restyle it to match if it still looks pre-redesign, but it's not
  the shared component other games use, so changes here are chess-only.
