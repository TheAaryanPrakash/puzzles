# Wordle — sample days

Generated deterministically (seed 1). Re-running `generate.ts` reproduces this file exactly.

## Pool stats

- Answer pool after filtering (common rank < 15000 ∩ ENABLE, minus blocklist/plurals/past tenses): **1287** words.
- Scheduled days: **365** (needs 365, pool has 1287 — comfortable margin).
- Valid-guess dictionary (`public/assets/wordle/guesses.json`): **8636** words.

## 5 sample days

### Day 1 — 2026-10-17

Answer: **INDIE**

### Day 91 — 2027-01-15

Answer: **PANEL**

### Day 181 — 2027-04-15

Answer: **GREEN**

### Day 271 — 2027-07-14

Answer: **TORCH**

### Day 365 — 2027-10-16

Answer: **BLAST**

## Anything suspicious?

- No duplicate answers across the schedule (checked by the generator; it throws otherwise).
- Every answer is a real ENABLE word within the top 15,000 most common English words, so none
  should be too obscure for a friend group to solve.
- Manually skim the 5 days above: none are proper nouns, abbreviations or offensive terms —
  the blocklist filter already removed the ones it knows about, but it can't catch everything.
