# Redesign agent `wordle`: Wordle

Game id: `wordle` · Dev server port: **5201** · Scope check: `node scripts/check-scope.mjs wordle`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already mostly done
`src/games/wordle/theme.css` was already redesigned and approved at Checkpoint 1 — tile colours,
contrast ratios (including a documented ink-colour override for the correct/present tiles) and the
Checkpoint-1 swatches are all in place and commented. Don't re-derive the palette. Spot-check it
still reads well with fresh eyes at 375px, but treat it as done unless you find something genuinely
broken.

## Focus: wire in `useSlotSpring`
`src/components/fx/useSlotSpring.ts` isn't used anywhere yet. Read its own doc comment first — it
only answers "what should slot i's transform/opacity be, given whether it's filled right now"; it
owns no input/typing/flip/shake logic of its own.

- In `src/games/wordle/components/Board.tsx`, drive one `useSlotSpring` entry per tile *in the
  current (in-progress) guess row* from whether that tile currently has a typed letter — so a letter
  springs up into its tile as you type it, and resets on backspace. This is separate from the
  per-row flip reveal that happens on submit (green/yellow/grey, already built) — leave that alone
  unless your research says merging the two reads better; if you do, explain why in RESEARCH.md.
- This re-renders on every keystroke — make sure the spring doesn't re-mount the whole board or
  fight the existing shake-on-invalid-word animation.
