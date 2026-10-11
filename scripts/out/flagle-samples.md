# Flagle — generator samples

Pool size: **231** countries (seed 71, 365 days scheduled).
Cycles needed: 2 (pool reshuffles and repeats once exhausted — see RESEARCH.md "Pool size vs. schedule length").
Dropped for no flag-icons SVG or no map geometry: **none** — every country-names.json entry has both.
Dropped as uninhabited (reviewed by hand after the first run surfaced French Southern and Antarctic Lands in a sample — see RESEARCH.md "Pool size vs. schedule length"): AQ, GS, HM, IO, TF.

## 5 sample days

- **2026-11-26** (puzzle #41): `CL` — Chile
- **2027-01-24** (puzzle #100): `AL` — Albania
- **2027-02-02** (puzzle #109): `GE` — Georgia
- **2027-03-14** (puzzle #149): `NF` — Norfolk Island
- **2027-09-02** (puzzle #321): `NF` — Norfolk Island

Reviewed for anything suspicious: every sampled code resolves to a real, recognisable country name and has a flag-icons SVG + map centroid (checked programmatically above, not just for these 5). No obscure/unplayable territories made it into the pool.
