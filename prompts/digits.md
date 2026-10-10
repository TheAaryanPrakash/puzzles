# Agent `digits`: Digits

Game id: `digits` · Dev server port: **5205** · Scope check: `node scripts/check-scope.mjs digits`

Read CLAUDE.md, then follow `prompts/_game.md` step by step for this game.

## Research focus
Look specifically at the original Digits rules and scoring, solver approaches for countdown-style number puzzles, grading
difficulty by minimum steps.

## Requirements
The baseline. Your research may improve on it; explain any deviation in RESEARCH.md and HANDOFF.md.

- 5 rounds per day. Each round has 6 numbers and a target, combined with + − × ÷ where every result
  must be a positive integer. Stars: exact = 3, within 10 = 2, within 25 = 1.
- A brute-force solver confirms each target is exactly reachable and not reachable in one step.
  Seed 21. Day file `{ rounds: [{ numbers, target, minSteps }] }`.
- Game: tap a number, an operator, then a number; a merge animation; undo, reset round, submit.
  Won = at least 1 star in every round. State: `{ rounds: [{ steps, submitted }] }`.
- Theme: pastel circles, Libre Franklin.
