# Agent `mini`: Mini crossword

Game id: `mini` · Dev server port: **5207** · Scope check: `node scripts/check-scope.mjs mini`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at crossword UX conventions (cursor movement, skipping filled cells, direction toggle), the .puz/.ipuz
formats and numbering rules, open-source web crossword components and their keyboard handling.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- Read `data/README.md` first. **The archive has grids and answers but no clue text**, so this agent
  also sources the clues:
  1. Research public clue–answer datasets (for example the Berkeley Crossword Solver data on Hugging
     Face, the xd crossword corpus, or the otsys clue database). Check each one's licence and size,
     pick the best, and record the choice in RESEARCH.md. Put the raw download in `data/mini/` and
     the processing in `scripts/mini/`.
  2. For each answer, pick a fair clue: drop clues containing "?" (wordplay), cross-references
     ("See 5-Across", "-Down"), and clues naming a year or a recent event. Prefer clues that appear in
     several sources and short ones. Use the seeded RNG to choose between good candidates so repeated
     answers get varied clues.
  3. Answers with no usable clue (often phrases such as ITSME): write the clue yourself. Mark those
     clues `"source": "written"` and list every one in the samples file for review.
- Importer: archive grids before ARCHIVE_CUTOFF, normalised to `{ size, cells, clues: { across, down } }`,
  metadata stripped. Validate dimensions, answers matching their cells, numbering, and that every entry
  has a clue. Drop the one 6×6 grid (2020-08-15). Use 5×5 grids on weekdays; 7×7 grids may go on
  Saturdays. Seed 41.
- Scheduling: 365 unique daily grids; leftover grids form a reserve pool, reused as in Connections
  (day *n*'s reserve = `pool[n % pool.length]`). Day file `{ "payload": <main>, "reserve": <reserve> }`.
- Game: active cell and word highlight, typing with auto-advance, arrow keys, Tab to the next clue,
  tap to toggle direction, mobile clue bar, check and reveal, timer. Using reveal shows in the summary.
- State: `{ letters, elapsed, revealed }`. Theme: white, black squares, Libre Franklin.
