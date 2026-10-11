# Spelling Bee — research

## Sources

**Rules / scoring** (no single result surfaced NYT's own rules page directly, so this is
triangulated across several independent write-ups that mostly agree):
- [How to play the NYT Spelling Bee — Sportskeeda](https://sportskeeda.com/mobile-games/how-play-nyt-spelling-bee) — 4-letter minimum, 1 point for 4-letter words, 1 point per letter for longer words.
- [What is a pangram in the NYT Spelling Bee? — Sportskeeda](https://sportskeeda.com/mobile-games/pangram-nyt-spelling-bee) — pangram = uses all 7 letters, worth +7 bonus on top of length score; a puzzle can have more than one pangram.
- [Scoring in the NYT Spelling Bee: Queen Bee, Genius and more — Sportskeeda](https://www.sportskeeda.com/mobile-games/nyt-spelling-bee-scoring-queen-bee-genius) — rank ladder, Queen Bee = every word found.
- [All NYT Spelling Bee badges — Beebom](https://beebom.com/puzzle/nyt-spelling-bee-badges-list/) — full ladder order: Beginner → Good Start → Moving Up → Good → Solid → Nice → Great → Amazing → Genius → Queen Bee.
- [Spelling Bee Buddy guide](https://www.startupeditor.com/?p=7219) — the specific percentage table that recurs across fan sites: Beginner 0%, Good Start 2%, Moving Up 5%, Good 8%, Solid 15%, Nice 25%, Great 40%, Amazing 50%, Genius 70%, Queen Bee 100% — and notes thresholds are rounded per puzzle since they're fractions of that day's point total.
- Cross-check: [Eastern Herald's May 29 2026 worked example](https://easternherald.com/2026/05/29/nyt-spelling-bee-answers-may-29-2026/) lists Great 68 / Amazing 85 / Genius 119 against a 170-point ceiling — 40% / 50% / 70%, consistent with the table above.
- [Wikipedia — The New York Times Spelling Bee](https://en.wikipedia.org/wiki/The_New_York_Times_Spelling_Bee) — background, confirms "S" is deliberately never one of the 7 letters (it would trivially pluralize almost every answer).

**Open-source implementations / algorithms:**
- [philshem/open-spelling-bee](https://github.com/philshem) (Python CLI) — draws words from SCOWL, generates+solves locally, several dictionary-size presets. Confirms the "pick a pangram, derive the letter set, filter the dictionary down to subset-of-letters-and-contains-center" generation shape. MIT-style licence; no code copied (Python, not applicable to our TS stack).
- [smacdo/spellingbee](https://github.com/smacdo/spellingbee) (Rust) — CLI + library for solving/scoring NYT's daily puzzle; scores answers and flags pangrams the same way (length-based score + flat pangram bonus). Confirms the scoring formula above independently. No code copied.
- [xiangaoole/spelling_bee_solver](https://github.com/xiangaoole/spelling_bee_solver) (Ruby) — pangram-first solver: choose 6 of the remaining letters, combine with a required letter, spellcheck. Validates the "pangram defines the letter set" generation order we use below.
- [danmolloy/spelling-bee](https://github.com/danmolloy/spelling-bee) (React) — hive built from plain CSS hexagons (clip-path/border-based), not SVG or a hex-grid library. Confirms a hand-rolled CSS hexagon is the standard, dependency-free approach for a web clone — matches our "no new npm packages" constraint, since `react-hexagon`/`react-hexgrid` aren't installed and we can't add them.

No GPL/AGPL code was read closely enough to copy, and nothing was copied from any of the above — they informed the algorithm and layout approach only, not any literal code.

## Comparison

| Approach | Strengths | Weaknesses | Licence / usable here |
|---|---|---|---|
| Pangram-first + bitmask/submask dictionary (this project's prompt, confirmed by philshem & xiangaoole) | O(masks × 7 centers × 64 submasks) — trivially fast over tens of thousands of words; deterministic; easy to guarantee "contains center letter" and "pangram" as mask properties | Needs a dictionary pre-grouped by letter-mask | Reimplemented from scratch in TS — exactly what the task prompt asks for |
| Brute-force "for every word, check every candidate set" | Simple to write | O(words × candidates) — too slow to explore thousands of candidate letter-sets for 365 unique days | — |
| CSS-hexagon hive (danmolloy) | Zero dependencies, flat-top hexagons via `clip-path: polygon(...)`, trivial to theme via CSS vars | None for our purposes | Pattern only, no code copied |
| SVG/library hex-grid (`react-hexagon`, `react-hexgrid`) | Nicer math for grid layouts | Not installed; "no new npm packages" rule forbids adding it | Not used |

## Chosen approach

**Generator** (`scripts/bee/generate.ts`):
1. Pool = `ENABLE1 ∩ common.txt[:40000]`, minus `blocklist.txt`, minus any word containing the
   letter **S** anywhere (not just the puzzle's 7 letters — matches NYT's real rule: a puzzle
   never includes S as one of the 7 letters, and words are filtered on that basis, not special-cased
   per plural), minus words shorter than 4 letters. This single pool avoids the two documented failure
   modes clones mention: too many obscure Scrabble-only words (hence intersecting with `common.txt`,
   not raw ENABLE1) and trivial S-pluralization (hence dropping S entirely, not just from the center).
2. Compute each pool word's **letter-mask**: a 26-bit integer, bit per distinct letter used. Group
   into `wordsByMask: Map<mask, word[]>` — only keeping entries whose mask has ≤7 bits set (anything
   with more distinct letters can never fit in a 7-letter hive).
3. **Candidate letter-sets** are exactly the masks in that map with **7** bits set — i.e. real pool
   words that happen to use exactly 7 distinct letters (pangram candidates). This guarantees every
   candidate set has at least one real, common pangram.
4. For each candidate mask, try each of its 7 letters as **center**. Enumerate the 2⁶ = 64 submasks
   of the other 6 letters, OR each with the center bit, and look up `wordsByMask` for each resulting
   submask — this is the "submask enumeration" the prompt asks for, and it mechanically enforces
   both constraints at once: the result's letters ⊆ the 7-letter set (submask of a 7-letter mask),
   and it contains the center (every submask is OR'd with the center bit before lookup, so a lookup
   hit's own mask always has that bit set). Union of all 64 lookups = that (mask, center)'s answer
   list; the subset of those whose own mask equals the full 7-letter mask = its pangrams (≥1, by
   construction from step 3).
5. Keep only (mask, center) pairs whose answer count falls in **20–60** (the prompt's target). Where
   a mask has several qualifying centers, keep the one whose count is closest to the middle of that
   range (~40) — an approximation of how NYT seems to pick "the" center for a given set, favoring
   the most balanced puzzle over the easiest or hardest.
6. Deterministically shuffle the resulting pool of valid (mask, center) puzzles with
   `mulberry32(7)` (seed **7**, per the prompt) and assign the first `SCHEDULE_DAYS` of them, one
   per day from `LAUNCH_DATE`. Throws if fewer than `SCHEDULE_DAYS` valid puzzles exist. Masks are
   deduplicated so no two days reuse the same 7 letters.
7. `maxScore` = sum of `score(word)` over the day's answers, where `score(word) = (word.length === 4
   ? 1 : word.length) + (isPangram(word) ? 7 : 0)` — this is what rank % is measured against, so it
   varies day to day exactly like the real game's thresholds do.
8. No reserve: Bee is generated fresh, not archive-sourced, so every day file is
   `{ "payload": <puzzle>, "reserve": null }` per `_game.md`.

**Rank ladder** (`logic.ts`), as a fraction of `maxScore`, rounded up to the nearest point like the
real game: Beginner 0%, Good Start 2%, Moving Up 5%, Good 8%, Solid 15%, Nice 25%, Great 40%,
Amazing 50%, Genius 70%, Queen Bee 100% (found every answer). **Won = Genius or above at finish**,
per the task prompt — Queen Bee is shown as a distinct badge but doesn't change the won/lost
boolean (a puzzle's `won` is really "did she reach Genius", Queen Bee is a bonus flex on top).

**Game UI** (`index.tsx` + `components/`):
- **Hive**: center hexagon + 6 outer hexagons in a honeycomb, built from a handful of flat-top CSS
  hexagons (`clip-path: polygon(...)`) in `theme.css` — no new hex-grid dependency, following
  danmolloy's clone. The 6 outer letters start in a seeded-random order (derived from the puzzle's
  own letters, so it's identical across her devices on load) and re-randomize client-side only on
  **Shuffle** — shuffling is cosmetic and never persisted, matching the real game (reloading
  reshuffles too).
- **Input**: tapping a hex or typing on a physical keyboard appends that letter to a live word
  buffer shown above the hive; **Delete**/Backspace removes the last letter; **Enter**/the Enter
  button submits. Unlike the shared `<Keyboard>` component (a QWERTY grid used by Wordle/Quordle),
  Bee's "keyboard" *is* the hive — there's no on-screen QWERTY to show, so `index.tsx` runs its own
  minimal `keydown` listener (same "ignore when focused on an editable element" guard `Keyboard.tsx`
  uses) rather than importing a component built around a different layout entirely.
- **Feedback messages**: short, auto-dismissing text ("Already found!", "Not in word list",
  "Too short", "Missing center letter", plus celebratory "Pangram!"/"Great!"/"Nice!" on a correct
  word) with a shake animation on the hive for a rejected word and a bounce/pop for an accepted one,
  honoring `prefers-reduced-motion` (no shake/bounce, message only) via `motion`'s built-in
  reduced-motion handling (CLAUDE.md's shared `brand.css` also force-shortens all durations/iterations
  under `prefers-reduced-motion: reduce`, so even an unguarded transition degrades safely).
- **Found-words list**: alphabetical, each tagged with its score and a 🔆 pangram marker.
- **Rank bar**: a segmented progress bar across the 10-rank ladder with the current rank highlighted
  and score shown; doubles as `ResultModal`'s `extraContent`/`statsExtraContent`.
- **Completion**: state stays `in_progress` across sessions on the same puzzle day (save after every
  accepted word). It becomes `won`/`lost` when she taps **"Finish for today"**, or the instant she
  finds every answer (auto-finish to Queen Bee), *or* — per the prompt — the moment she opens a day
  whose puzzle date is before today's and that day still has an `in_progress` play (e.g. she leaves
  today's puzzle unfinished, it rolls into the archive at midnight, and she reopens it later): that
  auto-finishes it on load with whatever she'd found, rather than letting an old day stay open
  forever. Implemented as a `useEffect` that checks `date < todayKey()` (only to detect "is this a
  past day", never to pick *which* puzzle to show — that's always `usePuzzle`'s own `date`) against
  an `in_progress` play and calls `finish()` immediately.
- **Share summary**: never lists which words were found (that's the actual spoiler — the answer
  pool). Just rank, score/maxScore, word count, pangram count and puzzle number, e.g.
  `"Spelling Bee #12\n🐝 Genius — 182/260 points, 28 words (2 pangrams)"`. No site URL is included:
  no `SITE_URL`-style constant exists anywhere in `src/` (checked), and `_example`'s own
  `buildSummary` likewise omits one — inventing a URL isn't something this task can safely do, so
  this follows that existing precedent.

## Skills used
- `motion-framer`: hive hex pop/bounce on accept, shake on reject, rank-bar fill animation, letter
  tiles on the found-words list — read for the `motion` component API, variants and
  `prefers-reduced-motion` handling patterns.
- `ui-ux-pro-max`: palette contrast check for the yellow centre hex against white/black text, hive
  touch-target sizing on mobile (≥44px), font pairing sanity check for Libre Franklin as a bold
  display face.
- `playwright-cli`: screenshots at 375px/1280px and a keyboard-only run, via `pnpm shot`.
- `web-design-guidelines`: final self-review pass before HANDOFF.md (contrast, focus states, tap
  target sizes, aria labels on the hive buttons and feedback messages).

## Edge cases (each gets a test)
1. Word shorter than 4 letters → rejected, "Too short" (never reaches the dictionary check).
2. Word missing the center letter → rejected, "Missing center letter".
3. Word using a letter outside the 7 → rejected before dictionary lookup ("invalid letter" — the
   hive shouldn't even let you tap/type a letter that isn't one of the 7, but physical-keyboard
   typing can still produce one).
4. Word not in `answers` (even if it only uses valid letters and the center) → "Not in word list".
5. Word already in `found` → "Already found!", no duplicate score.
6. Correct word that is a pangram → scored `length + 7`, flagged, distinct celebratory message.
7. Correct 4-letter word → scored exactly 1, not 4.
8. Case-insensitivity: lowercase/mixed-case typed input normalizes the same as uppercase.
9. Finding every answer → immediately finishes as Queen Bee/Genius (both, since 100% ⊇ 70%),
   without needing "Finish for today".
10. Tapping "Finish for today" with 0 words found → finishes as lost, Beginner, score 0.
11. Serializing `{ found: [...] }` mid-game to JSON and restoring it reproduces identical found
    list, score and rank.
12. `buildSummary` never contains any string from `puzzle.answers` (the actual spoiler check).
13. The `{}` gotcha: `state.found` must default to `[]` via `{ ...DEFAULT_STATE, ...play?.state }`
    the instant after `start()`, before first `save()` lands.
14. Rank boundary rounding: a score exactly on a threshold (e.g. exactly 70% of maxScore) counts as
    reaching that rank, not the one below.
15. Opening an earlier day's still-`in_progress` play auto-finishes it with its existing `found` —
    covered at the `index.tsx` level (documented here; see HANDOFF.md for how it's exercised).
16. Generator: every candidate (mask, center) kept has 20–60 answers and ≥1 pangram; no two
    scheduled days share the same 7-letter mask; no scheduled puzzle's letters include "S".

## Deliberately left out
- No "spill the bee" / duplicate-letter visual hint feature NYT added later — out of scope for a
  first build; `answers` already gives the client everything needed if we want to add hints later.
- No obscure-word difficulty dial — the single common-pool filter in step 1 is the only "avoid
  obscure words" lever, per the task's research focus, rather than a second curation pass.
- No per-letter "how many words start with this letter" hint grid — NYT added this later; not in
  the task prompt's requirements.

## Build plan
1. `scripts/bee/generate.ts` + `scripts/bee/generate.test.ts` (bitmask/submask helpers, pool
   filtering, rank math) → run for the full schedule → `scripts/out/bee-samples.md`.
2. `logic.ts` + `logic.test.ts`: scoring, pangram detection, validation, rank ladder, summary.
3. `index.tsx` + `components/Hive.tsx` + `components/RankBar.tsx` + `components/FoundWords.tsx`,
   `theme.css`.
4. Dev server on port 5203, check at `?date=` across 3+ days, 375px, physical keyboard only.
5. Screenshots, `web-design-guidelines` self-review, HANDOFF.md.
