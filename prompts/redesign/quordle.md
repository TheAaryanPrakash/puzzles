# Redesign agent `quordle`: Quordle

Game id: `quordle` · Dev server port: **5202** · Scope check: `node scripts/check-scope.mjs quordle`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/quordle/theme.css` is already redesigned (4 board colours synced to the approved
Connections palette, tile feedback trio matches Wordle's). Don't re-derive it. Spot-check at 375px
with fresh eyes; treat as done unless something's genuinely broken.

## Focus: wire in `useSlotSpring`, across all 4 boards
`src/components/fx/useSlotSpring.ts` isn't used anywhere yet. Read its own doc comment first — it
only answers "what should slot i's transform/opacity be, given whether it's filled right now"; it
owns no input/typing/flip/shake logic of its own.

- Apply the same per-tile typing spring described in `prompts/redesign/wordle.md` (the letter
  springs up into its tile as typed), but across all 4 simultaneous boards — Quordle shares one
  current-guess string across all boards (`src/games/quordle/index.tsx`/`Board.tsx`), so this is
  likely one shared row of `useSlotSpring` state driving 4 visual boards, not 4 independent ones.
- This is the one place on the site where up to 4×5 slots could be springing at once on a single
  keystroke — check it doesn't tank frame rate on a real device, not just in a quick desktop check.
