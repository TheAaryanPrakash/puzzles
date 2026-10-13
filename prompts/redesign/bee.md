# Redesign agent `bee`: Spelling Bee

Game id: `bee` · Dev server port: **5203** · Scope check: `node scripts/check-scope.mjs bee`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/bee/theme.css` is already redesigned (hive centre-letter colour is the approved
Checkpoint-1 "bee centre" swatch, with its own documented ink-contrast reasoning). Don't re-derive
the palette. No fx component is assigned to this game for phase 2.

## What to actually do
This is a verification + polish pass, not a build:
- Play it at 375px and with a physical keyboard; check the hexagon honeycomb layout, word list and
  "already found" feedback all read clearly against the new near-black base.
- Read `meta.ts`'s `howTo` with fresh eyes (it now surfaces through the shared `HowToPlayModal`) —
  polish the wording if it's sparse.
- If the hive's shuffle/found-word animation still looks tuned for the old light background (too
  subtle to notice on dark, or a transition that still assumes a light surface), re-tune it. If it
  already looks right, leave it and say so in HANDOFF.md rather than changing something that isn't
  broken.
