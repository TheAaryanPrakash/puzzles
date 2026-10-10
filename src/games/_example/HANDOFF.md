# _example — HANDOFF

Template for the fan-out agents' own HANDOFF.md. Sections below are what reviewers (the human, and
the integration agent) will look for.

## What was built

A number-guessing demo game (`src/games/_example/`) exercising the full game contract: restore from
JSON state, start-on-first-move, spoiler-free finish, and every shared component (`GameLayout`,
`HelpModal`, `ResultModal`, `NoPuzzleToday`, `AlreadyPlayed`). Routed automatically at `/_example` via
`src/routes.tsx`'s `import.meta.glob` discovery; hidden from the Hub in production builds (id starts
with `_`).

## What to review

- `pnpm shot http://localhost:5173/_example /tmp/x.png 375` renders the game (today's content file
  exists at `content/puzzles/_example/<today>.json`).
- `pnpm test` — `logic.test.ts` covers win/lose/mid-game, JSON round-trip, and "summary never
  contains the answer".
- Play it once in the browser: guess until you win or lose, confirm the `ResultModal` opens with
  stats, a working Share button, and the (fake, local-adapter) friends board.
- Refresh mid-game: the board restores exactly where you left off.

## Shared changes needed

None — built entirely against the frozen `DataSource` and component prop types as they exist on
`main`.

## Licence notes

No code copied from elsewhere; nothing to attribute.
