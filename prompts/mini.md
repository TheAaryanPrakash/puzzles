# Agent `mini`: Mini crossword

Game id: `mini` · Dev server port: **5207** · Scope check: `node scripts/check-scope.mjs mini`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at crossword UX conventions (cursor movement, skipping filled cells, direction toggle), the .puz/.ipuz
formats and numbering rules, open-source web crossword components and their keyboard handling.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Read `data/README.md` first. Importer: archive puzzles before ARCHIVE_CUTOFF, normalised to
  `{ size, cells, clues: { across, down } }`, metadata stripped. Validate dimensions, answers matching
  their cells, numbering, and that every entry has a clue. Seed 41, main + reserve per day.
  List time-bound clues (years, "this week", recent names) in the samples file.
- Game: active cell and word highlight, typing with auto-advance, arrow keys, Tab to the next clue,
  tap to toggle direction, mobile clue bar, check and reveal, timer. Using reveal shows in the summary.
- State: `{ letters, elapsed, revealed }`. Theme: white, black squares, Libre Franklin.
