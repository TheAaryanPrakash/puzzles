# Shared data — sources, licences, formats

Everything here is produced by the `data` agent. Game agents should treat all of it as
**read-only**. Scripts that built it live in `scripts/_data/`; re-run them with `python3
scripts/_data/<script>.py` from the repo root if a source needs refreshing.

Sanity-check everything with `python3 scripts/_data/sanity_check.py`. Its most recent output is
reproduced at the bottom of this file.

---

## Word lists (`wordlists/`)

### `wordlists/enable1.txt`
- **Source:** [dolph/dictionary](https://github.com/dolph/dictionary) mirror of ENABLE
  (`Enhanced North American Benchmark LExicon`), `enable1.txt`.
  URL: `https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt`
- **Licence:** Public domain. ENABLE was compiled by M. Cooper from public-domain word lists
  and explicitly released to the public domain; this mirror is one of the most widely used
  copies (the same file ships inside many Scrabble/word-game projects).
- **Format:** one lowercase word per line, sorted, no blank lines.
- **Count:** 172,823 words, all unique.
- **Example:** `aahed`, `kayak`, `zymurgy`.

### `wordlists/common.txt`
- **Source:** generated locally with the `wordfreq` Python package
  (`pip install wordfreq`, [source](https://github.com/rspeer/wordfreq), MIT licence):
  ```
  python -c "from wordfreq import top_n_list; open('wordlists/common.txt','w').write('\n'.join(top_n_list('en', 50000)))"
  ```
- **Licence:** MIT (wordfreq itself); the frequency data it's built from is a mix of public
  corpora (see wordfreq's own citation list).
- **Format:** one token per line, most frequent first. **By design** this includes
  contractions (`don't`, `i'm`), bare digits (`0`-`9`), and a few multi-char tokens
  (`u.s`) — `top_n_list` returns wordfreq's raw top tokens, not a filtered word list.
  These simply won't intersect with `enable1.txt`, so they fall out naturally when a
  generator computes `ENABLE ∩ common` for fair answers (see CLAUDE.md "Word data").
- **Count:** 50,000 tokens, all unique.

### `wordlists/blocklist.txt`
- **Source:** built by `scripts/_data/build_blocklist.py` from
  [LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
  (`en` list), plus a supplementary hand-compiled list of ethnic/racial/ableist/homophobic
  slurs not already covered by LDNOOBW (`EXTRA_SLURS` in that script — LDNOOBW leans
  heavily toward sexual/profane terms, so this fills the gap). Add new terms straight into
  `EXTRA_SLURS` and re-run the script if a generator surfaces one.
- **Licence:** LDNOOBW is CC0/unlicensed (public-domain-equivalent; see repo).
- **Format:** one lowercase entry per line (a few are multi-word phrases, harmless for
  single-word answer filtering — they simply never match a single generated word).
- **Count:** 480 entries, all unique, all lowercase.
- **Usage:** generators must remove every `wordlists/blocklist.txt` entry from their answer
  pool (CLAUDE.md "Word data").

---

## Geo: countries (`data/geo/`, `public/assets/shared/countries.json` + `country-names.json`)

- **Base topology source:** [world-atlas](https://github.com/topojson/world-atlas) `countries-50m.json`
  (1:50m Natural Earth boundaries bundled as TopoJSON), fetched from
  `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json` and saved untouched to
  `data/geo/countries-50m.json`.
  **Licence:** ISC (world-atlas package) / public domain (underlying Natural Earth data).
- **ISO lookup source:** [lukes/ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes)
  `all/all.csv`, saved to `data/geo/iso-3166-countries.csv`. **Licence:** ODC Open Database
  Licence (per that repo's README).
- **Build script:** `scripts/_data/build_countries.py`. It joins world-atlas's numeric
  `id` (ISO 3166-1 numeric) to the CSV's alpha-2 code, overrides a few Natural Earth names
  that were abbreviated or overly formal (e.g. `"Antigua and Barb."` → `"Antigua and
  Barbuda"`, `"Russian Federation"` kept as plain `"Russia"` since world-atlas already uses
  it) with a common English name a casual player would type, and writes:
  - **`public/assets/shared/countries.json`** — the same TopoJSON, but every feature's
    `properties` is replaced with `{ "name": <common English name>, "iso_a2": <code> }`.
    The `land` object (a single merged landmass geometry, no per-country properties) is
    kept untouched as a backdrop layer. **Format example** (one feature):
    ```json
    { "type": "Polygon", "arcs": [[...]], "id": "356",
      "properties": { "name": "India", "iso_a2": "IN" } }
    ```
  - **`public/assets/shared/country-names.json`** — `{ code: { name, aliases: [...] } }`
    for every code in `countries.json`, for answer-matching in Worldle/Flagle/Globle/Travle.
    Most countries have an empty `aliases` list; populated for the common ones. **Example:**
    ```json
    "US": { "name": "United States", "aliases": ["USA", "United States of America", "America"] }
    ```
- **Counts:** world-atlas ships 241 country-level geometries; 236 make it into
  `countries.json` / `country-names.json` (236 unique `iso_a2` codes, verified 1:1 between
  the two files).
- **Quirks (5 dropped/merged features):**
  - **Kosovo** has no ISO 3166-1 numeric id in world-atlas (it isn't ISO-recognised as a
    country). Assigned the widely-used *unofficial* code `XK` (same one the EU, SWIFT and
    most flag/geography games use) so it's still playable.
  - **Somaliland**, **Northern Cyprus** (`"N. Cyprus"`), **"Indian Ocean Ter."** and
    **Siachen Glacier** have no numeric id either and no usable ISO code — dropped from the
    dataset entirely (not guessable in any game).
  - **"Ashmore and Cartier Is."** shares Australia's numeric code (036) in this dataset
    (it's an uninhabited Australian external territory) — dropped as a duplicate, keeping
    the "Australia" feature.
  - A handful of names were changed from Natural Earth's formal/ISO form to the common one
    players would actually type: `Czechia`→`Czech Republic` (alias `Czechia`),
    `Macedonia`→`North Macedonia` (alias `Macedonia`), `Côte d'Ivoire`→`Ivory Coast`,
    `Dem. Rep. Congo`→`Democratic Republic of the Congo`, `eSwatini`→`Eswatini`, etc. — see
    `NAME_OVERRIDES` / `ALIASES` in `scripts/_data/build_countries.py` for the full list.
  - Taiwan, Hong Kong, Macao, Palestine and Western Sahara are included as their own
    features (each has its own ISO 3166-1 alpha-2 code) — a political-geography choice
    inherited from Natural Earth/world-atlas, not something this script decided.

## Geo: India states & UTs (`data/geo/india/`, `public/assets/shared/india-states.json`)

- **Source:** DataMeet `maps` repo, `States/Admin2.{shp,shx,dbf,prj,cpg}` (the "States"
  layer), `https://raw.githubusercontent.com/datameet/maps/master/States/Admin2.*`, saved
  raw and untouched to `data/geo/india/Admin2.*`.
  **Licence:** CC BY 4.0 — attribute as *India boundaries by DataMeet India community
  (CC BY 4.0), https://github.com/datameet/maps*.
- **Why this shapefile is current:** checked its GitHub commit history before using it —
  last touched 2021-10-25 ("Merged the two Ladhak features"), with earlier 2021/2020 commits
  updating Jammu & Kashmir/Ladakh and the Dadra and Nagar Haveli + Daman and Diu merger. It
  has the post-2019/2020 boundaries CLAUDE.md asks for.
- **Build steps** (not committed as intermediates — only the raw shapefile and the final
  simplified TopoJSON are in the repo; re-run these two steps to rebuild
  `public/assets/shared/india-states.json` from scratch):
  1. `python3 scripts/_data/shp_to_geojson.py` reads `data/geo/india/Admin2.shp` with the
     pure-Python `pyshp` library (`pip install pyshp`; MIT licence — no GDAL available in
     this environment) and writes a full-resolution GeoJSON to `/tmp/india-states-full.geojson`
     (~43 MB — deliberately not committed), tagging each feature with its current
     ISO 3166-2:IN code (verified against the English Wikipedia ISO 3166-2:IN article's
     revision history, which documents the Chhattisgarh `CT`→`CG`, Odisha `OR`→`OD`,
     Telangana `TG`→`TS`, Uttarakhand `UT`→`UK`, J&K/Ladakh split, and DNH+DD merger updates).
  2. `npx mapshaper -i /tmp/india-states-full.geojson -simplify 3% keep-shapes -o
     format=topojson public/assets/shared/india-states.json` simplifies the very detailed
     Survey-of-India-derived coastline data down to a web-friendly ~210 KB TopoJSON.
     **Do not add `-clean`** — in this pipeline it was observed to re-inflate the output
     back to ~6 MB (likely because its sliver-removal pass rebuilds arcs at full
     resolution); omit it and `-simplify ... keep-shapes` alone is sufficient.
- **Format:** TopoJSON, single object key `india-states`, each feature's `properties` is
  `{ "name": <English name>, "code": "IN-XX" }`. **Example:**
  ```json
  { "type": "Polygon", "arcs": [[...]],
    "properties": { "name": "Karnataka", "code": "IN-KA" } }
  ```
- **Count:** 36 features — all 28 states + 8 union territories currently in India,
  confirmed present: Ladakh (`IN-LA`), Jammu & Kashmir (`IN-JK`), and the merged Dadra and
  Nagar Haveli and Daman and Diu (`IN-DH`).
- **Quirk:** simplifying this coastline-heavy dataset leaves ~179 small self-intersections
  mapshaper's repair pass couldn't fully resolve (reported on stderr as "intersections
  could not be repaired"). These are sub-pixel artefacts from the simplification algorithm
  on complex multi-island states (Andaman & Nicobar, Lakshadweep) and coastal boundaries —
  cosmetic only, every feature still renders as a single valid shape. Re-run with a smaller
  `-simplify` percentage (bigger file) if a game needs cleaner boundaries at high zoom.

---

## Archives (raw, untouched — `data/connections/`, `data/mini/`)

CLAUDE.md asks for these "raw and untouched"; no filtering, de-duplication or NYT-metadata
stripping has been done here — that's the `connections`/`mini` game agents' job on import
(see CLAUDE.md "Archive data": only puzzles published before `ARCHIVE_CUTOFF`, strip NYT
metadata, validate and drop invalid puzzles).

### `data/connections/Connections_Data.csv`
- **Source:** Hugging Face dataset
  [`eric27n/NYT-Connections`](https://huggingface.co/datasets/eric27n/NYT-Connections),
  `Connections_Data.csv`.
  URL: `https://huggingface.co/datasets/eric27n/NYT-Connections/resolve/main/Connections_Data.csv`
  (the task's fallback, `tm21cy/NYT-Connections`, wasn't needed — `eric27n`'s dataset
  fetched fine and validated clean).
- **Licence:** Apache-2.0 (per the dataset's `cardData.license` on the Hugging Face API).
- **Format:** long/tidy CSV, one row per word (16 rows per puzzle):
  `Game ID, Puzzle Date, Word, Group Name, Group Level (0-3), Starting Row, Starting Column`.
  **Example** (first 2 of 16 rows for puzzle 1):
  ```
  Game ID,Puzzle Date,Word,Group Name,Group Level,Starting Row,Starting Column
  1,2023-06-12,SNOW,WET WEATHER,0,1,1
  1,2023-06-12,LEVEL,PALINDROMES,3,1,2
  ```
- **Counts:** 10,048 rows = 628 puzzles × 16 words. 628 unique `Game ID`s, 628 unique
  dates (one puzzle per day, no gaps checked). Date range **2023-06-12 .. 2025-02-28** — all
  of it is before `ARCHIVE_CUTOFF` (2025-04-01), so the connections agent has the full 628
  puzzles to choose an archive pool from.
- **Validated:** every one of the 628 puzzles has exactly 16 word-rows and exactly 4 group
  levels (0-3) with exactly 4 words each — no partial/malformed puzzles found.
- **Quirk:** no quirks found; this dataset is clean. (The `eric27n` HF dataset is a cleaner
  re-export of the same underlying puzzles found in `tm21cy/NYT-Connections`; didn't need
  the fallback.)

### `data/mini/data.json`
- **Source:** [chrisnunes57/nyt-mini-crosswords](https://github.com/chrisnunes57/nyt-mini-crosswords),
  `data.json`. URL: `https://raw.githubusercontent.com/chrisnunes57/nyt-mini-crosswords/master/data.json`
- **Licence:** the repo has **no declared licence** (GitHub reports `license: None`). The
  task named this exact file as the source regardless, and the underlying puzzle content is
  NYT's either way — CLAUDE.md's "Archive data" rule to strip NYT metadata on import applies
  here. Treat this as the one source in this README without a clean open licence; flagging
  it explicitly in case the human wants a different source before the mini game ships.
- **Format:** JSON array of puzzle objects:
  `{ author, editor, format_type, print_date, publish_type, puzzle_id, title, version,
  percent_filled, solved, star, board: { cells: [...] } }`. Each `cells` entry is either
  `{ "guess": "<letter>", "timestamp": <seconds> }` or `{ "blank": true }` for a black square
  (row-major, grid width = sqrt(len(cells))).
  **Example** (first puzzle, first 5 cells):
  ```json
  {
    "print_date": "2019-01-01", "puzzle_id": 16195, "solved": true,
    "board": { "cells": [
      {"guess": "H", "timestamp": 29}, {"guess": "A", "timestamp": 35},
      {"guess": "N", "timestamp": 16}, {"guess": "G", "timestamp": 18},
      {"blank": true}
    ]}
  }
  ```
- **Counts:** 787 puzzles, 787 unique dates (no duplicates), range **2019-01-01 ..
  2021-03-07** (well before `ARCHIVE_CUTOFF`). Grid sizes: 673 are 5×5 (25 cells, the
  standard Mini), 113 are 7×7 (49 cells — NYT occasionally runs a larger weekend Mini), and
  **one** 2020-08-15 puzzle is 6×6 (36 cells, `puzzle_id` 18521) — an odd one-off worth a
  second look (possibly a scraper/NYT formatting glitch on that date).
  All 787 have `solved: true` (this is the repo author's own completed-solve history, not a
  neutral scrape — see next point).
- **Important quirk — no clue text at all.** Despite being called "puzzle data", every
  record only has the **solution letters** per cell (`guess`) plus the scraper-author's own
  solve timestamps, and `blank: true` for black squares. There is no across/down clue text
  anywhere in this file. The `mini` game agent will need either: (a) a separate source for
  clue text keyed by grid+date, (b) to design a clueless variant (e.g. a fill-the-grid /
  pattern game using just the letters and blank layout), or (c) to generate its own clues for
  the solution words. This is flagged here rather than worked around, per the "don't fix a
  shared-data problem, document it" rule in CLAUDE.md's parallel-work section.

---

## Sanity check output (`python3 scripts/_data/sanity_check.py`)

```
=== wordlists/ ===
enable1.txt:   172823 words, 172823 unique, all lowercase: True, sorted: True
common.txt:    50000 words, 50000 unique (wordfreq top_n_list('en', 50000), includes punctuation/numeric tokens by design)
blocklist.txt: 480 entries, 480 unique, all lowercase: True
ENABLE ∩ common = 34796 candidate fair answers (before blocklist); after removing blocklist: 34660
  "snow" in enable1: True, in common: True, in blocklist: False
  "level" in enable1: True, in common: True, in blocklist: False
  "shift" in enable1: True, in common: True, in blocklist: False
  "kayak" in enable1: True, in common: True, in blocklist: False
  "zymurgy" in enable1: True, in common: False, in blocklist: False
  "aa" in enable1: True, in common: True, in blocklist: False

=== public/assets/shared/countries.json + country-names.json ===
countries.json: 236 features, 236 unique iso_a2 codes
country-names.json: 236 codes
topo codes == country-names codes: True
'land' background object present: True
  US: {'name': 'United States', 'aliases': ['USA', 'United States of America', 'America']}
  GB: {'name': 'United Kingdom', 'aliases': ['UK', 'Britain', 'Great Britain', 'United Kingdom of Great Britain and Northern Ireland']}
  IN: {'name': 'India', 'aliases': []}
  KR: {'name': 'South Korea', 'aliases': ['Republic of Korea']}
  KP: {'name': 'North Korea', 'aliases': ["Democratic People's Republic of Korea"]}
  XK: {'name': 'Kosovo', 'aliases': []}
  CI: {'name': 'Ivory Coast', 'aliases': ["Cote d'Ivoire", "Côte d'Ivoire"]}
  CD: {'name': 'Democratic Republic of the Congo', 'aliases': ['DR Congo', 'DRC', 'Congo-Kinshasa', 'Zaire']}

=== public/assets/shared/india-states.json ===
layer 'india-states': 36 features, 36 unique codes
has Ladakh (IN-LA): True, has merged Dadra & Nagar Haveli + Daman & Diu (IN-DH): True
  IN-DH: Dadra and Nagar Haveli and Daman and Diu
  IN-JK: Jammu & Kashmir
  IN-LA: Ladakh

=== data/connections/Connections_Data.csv (raw, untouched) ===
10048 rows, 628 puzzles, 628 unique dates
date range: 2023-06-12 .. 2025-02-28
puzzles without exactly 16 word-rows: 0
example puzzle (Game ID 1):
      SNOW | group 0: WET WEATHER
     LEVEL | group 3: PALINDROMES
     SHIFT | group 2: KEYBOARD KEYS
     KAYAK | group 3: PALINDROMES

=== data/mini/data.json (raw, untouched) ===
787 puzzles, 787 unique dates, range 2019-01-01 .. 2021-03-07
grid-size distribution (cell count -> puzzle count): {25: 673, 49: 113, 36: 1}
NOTE: no clue text in this dataset, only solution letters per cell ('guess') plus solve timestamps and 'blank' markers for black squares -- see data/README.md quirks.
example puzzle: 2019-01-01 (puzzle_id 16195), 25 cells, first 5 cells: [{'guess': 'H', 'timestamp': 29}, {'guess': 'A', 'timestamp': 35}, {'guess': 'N', 'timestamp': 16}, {'guess': 'G', 'timestamp': 18}, {'blank': True}]
```
