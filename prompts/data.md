# Agent `data`: shared word lists, geo data and archives

Read CLAUDE.md. You run in your own worktree at the same time as the `foundation` agent, which is
scaffolding the app on main. You may only edit `wordlists/`, `data/`, `public/assets/shared/` and
`scripts/_data/` (check: `node scripts/check-scope.mjs data`). There is no package.json yet: use
Python and Node's standard library, or `npx --yes` for one-off tools. Don't add a package.json.

Work without waiting for approval. 13 game agents start from your output, so make it correct and
documented.

1. `wordlists/enable1.txt`: the ENABLE word list (public domain; widely mirrored as enable1.txt).
2. `wordlists/common.txt`:
   `pip install wordfreq` then
   `python -c "from wordfreq import top_n_list; open('wordlists/common.txt','w').write('\n'.join(top_n_list('en', 50000)))"`
3. `wordlists/blocklist.txt`: the LDNOOBW English list plus slurs, lowercase, one per line.
4. Geo:
   - world-atlas `countries-50m.json` → `data/geo/`. Write `public/assets/shared/countries.json`
     (TopoJSON with ISO 3166 alpha-2 codes and English names on each feature) and
     `public/assets/shared/country-names.json` (code → name + aliases: "USA", "United States", "America"…).
   - India states and union territories (DataMeet "maps" repo, States layer) → `data/geo/india/`,
     simplified to `public/assets/shared/india-states.json` with names and codes. Use current
     boundaries (Ladakh, the merged Dadra and Nagar Haveli and Daman and Diu).
5. Archives, raw and untouched: `data/connections/` (Hugging Face eric27n/NYT-Connections; fallback
   tm21cy/NYT-Connections) and `data/mini/` (github.com/chrisnunes57/nyt-mini-crosswords, data.json).
6. `data/README.md`: every file's source URL, licence and format, with an example record and counts.
   Note any quirks found (missing dates, split numbers, duplicates).
7. Sanity-check everything with a script in `scripts/_data/` (counts, a few lookups) and put its output
   in data/README.md.
8. Check scope, commit everything, and reply with a summary of what's there.
