# _example — RESEARCH

This game is scaffolding, not one of the 14 real games, so it skips the "read the original game's
rules / find 3 open-source clones" research steps in CLAUDE.md — there is no original game to
research. **Every real game agent should still follow that process and replace this section
accordingly.** What follows is the template structure your RESEARCH.md should have, filled in with
this game's (trivial) version of each part.

## 1–3. Original rules, prior art, comparison

Skipped (see above). A real game's RESEARCH.md should have, here: links to the official rules page,
at least 3 well-regarded open-source implementations with a comparison table (approach, strengths,
known bugs, accessibility, mobile UX, licence), and the write-ups/algorithms you found for
generation, solving and uniqueness.

## 4. Chosen approach

A 1–20 number-guessing game, 4 tries, "higher/lower/correct" feedback — the smallest game that still
exercises every part of the contract in CLAUDE.md:

- **Restore from state.** `ExampleState = { guesses: number[] }` is plain JSON; `usePlay` restores
  it on load from another device or a refresh, and `logic.test.ts` round-trips it through
  `JSON.parse(JSON.stringify(...))`.
- **Start on first move, not on page load.** `index.tsx` only calls `start()` inside `handleGuess`,
  the first time there's no play yet.
- **Finish with a spoiler-free summary.** `buildSummary` renders an emoji grid (⬆️/⬇️/🟩), never the
  secret number. `logic.test.ts` asserts the secret's digits never appear in the summary string.
- **ResultModal, HelpModal, NoPuzzleToday, AlreadyPlayed** are used as-is, themed only via
  `theme.css` tokens — none of them are forked.

## Edge cases (each is a test in logic.test.ts)

- Win on the exact last guess (4th try) vs. losing on the 4th try.
- Already-over state should not accept further guesses (`isOver` gates the input in `index.tsx`).
- Summary text must never contain the secret number, for every possible secret.
- State restores to bit-for-bit the same game after a JSON round-trip.

## Deliberately left out

- No input validation beyond "integer within range" — a real game would reject malformed/duplicate
  guesses more thoroughly; this one is a contract demo, not a polished game.
- No animations — the signature-motion requirement applies to the 14 real games, not this scaffold.

## Build plan

1. `logic.ts` — pure functions (`feedbackFor`, `isWon`, `isLost`, `isOver`, `buildSummary`).
2. `logic.test.ts` — the edge cases above.
3. `meta.ts`, `theme.css` — minimal, neutral.
4. `index.tsx` — wires `usePuzzle`/`usePlay` to the shared components per the contract.
5. `content/puzzles/_example/*.json` — a handful of hand-written days (no generator needed for a
   demo this small; a real game's generator would write `SCHEDULE_DAYS` of them deterministically).
