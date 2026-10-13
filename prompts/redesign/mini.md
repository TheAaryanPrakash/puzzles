# Redesign agent `mini`: Mini Crossword

Game id: `mini` · Dev server port: **5207** · Scope check: `node scripts/check-scope.mjs mini`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/mini/theme.css` is already redesigned (active-cell/active-word are the approved
Checkpoint-1 swatches). Its Hub-card icon colour (`hubAccent` in `meta.ts`) was also already fixed
this session — it used to be unreadable (~1.2:1 against the new dark Hub tile); it's `#d4c4c9` now.
Don't touch either. No fx component is assigned to this game for phase 2.

## What to actually do
This is a verification + polish pass, not a build:
- Play it at 375px and with a physical keyboard — across/down toggle, clue list, check/reveal, and
  the crossword-paper texture should all read clearly against the new near-black base.
- Read `meta.ts`'s `howTo` with fresh eyes; polish if sparse.
- If anything still looks like it's assuming the old crossword-paper-on-white background, fix it;
  otherwise leave it and say so in HANDOFF.md.
