# Redesign agent `digits`: Digits

Game id: `digits` · Dev server port: **5205** · Scope check: `node scripts/check-scope.mjs digits`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/digits/theme.css` is already redesigned (`--game-accent` moved to the approved
present/gold swatch, with documented contrast ratios against both bg/surface and as a fill). Don't
re-derive the palette. No fx component is assigned to this game for phase 2.

## What to actually do
This is a verification + polish pass, not a build:
- Play it at 375px and with a physical keyboard; check the round-board number-tile UI and the
  operator buttons (+ − × ÷) read clearly against the new near-black base.
- Read `meta.ts`'s `howTo` with fresh eyes; polish if sparse.
- If the target-reached / solved animation still looks tuned for the old background, re-tune it;
  otherwise leave it and say so in HANDOFF.md.
