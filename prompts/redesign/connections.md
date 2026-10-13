# Redesign agent `connections`: Connections

Game id: `connections` · Dev server port: **5206** · Scope check:
`node scripts/check-scope.mjs connections`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## 4-level contrast: already checked
`src/games/connections/theme.css` already documents the full contrast audit for all 4 level
colours against their dark ink (5.5:1 / 5.9:1 / 7.7:1 / 8.6:1, all AA) and notes they were re-run
through the Checkpoint-1 deuteranopia simulation and stayed visually distinct. **Don't redo this
work** — it's done. No fx component is assigned to this game for phase 2.

## What to actually do
This is a verification + polish pass, not a build:
- Play it at 375px and with a physical keyboard — selection, the shake-on-wrong-guess, and the
  solved-group reveal (`SolvedGroupBar.tsx`) should all read clearly with the approved 4 colours.
- If you change anything about tile layout or the solved-group bar's visual weight, re-check the
  deuteranopia simulation yourself (don't just assume last session's check still holds) and note the
  new ratios in theme.css's comment, same style as what's there now.
- Read `meta.ts`'s `howTo` with fresh eyes; polish if sparse.
