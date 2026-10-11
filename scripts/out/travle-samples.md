# travle — sample days

## 5 random days

### Day 163 — 2027-03-28
- Start: **Canada** (CA)
- End: **Costa Rica** (CR)
- Shortest route: 5 countries in between
- Guess allowance: 10

### Day 96 — 2027-01-20
- Start: **Ivory Coast** (CI)
- End: **Tanzania** (TZ)
- Shortest route: 5 countries in between
- Guess allowance: 10

### Day 48 — 2026-12-03
- Start: **South Sudan** (SS)
- End: **Lesotho** (LS)
- Shortest route: 4 countries in between
- Guess allowance: 9

### Day 75 — 2026-12-30
- Start: **Uzbekistan** (UZ)
- End: **South Sudan** (SS)
- Shortest route: 7 countries in between
- Guess allowance: 13

### Day 39 — 2026-11-24
- Start: **Colombia** (CO)
- End: **Honduras** (HN)
- Shortest route: 3 countries in between
- Guess allowance: 7

## Pool stats

- Total days generated: 365
- Candidate (non-isolated) countries: 165 of 236
- Isolated countries (no land neighbors, never usable as start/end): 71
- shortestLength distribution: 3→79, 4→77, 5→84, 6→61, 7→64
- Ordered (start,end) pairs available at distance 4–8 across the whole graph: 10678
- Pairs actually used (365 days, unique): 365 (no repeats)

## Anything suspicious?

- None found: every day's shortestLength is 3–7 as required, no two days repeat the same (start, end) pair (checked in either order), and the shortestLength distribution above is roughly proportional to how common each length is across the whole graph (no artificial skew from the shuffle-and-take-first selection strategy).
