# Soft theme — site pink + per-game palettes

Screenshots: `docs/theme/before/` and `docs/theme/after/`, hub + `/signin` + `/dev/themes` + all
14 games, at 375px and 1280px (`?date=2026-10-17` on game URLs so today's puzzle renders).

Built with the `ui-ux-pro-max`, `design-system` and `web-design-guidelines` skills: palette
derivation and contrast-pair reasoning followed `ui-ux-pro-max`'s accessible-color-pairs guidance,
token layering followed `design-system`'s token-tier approach (the project's existing
site-tier/game-tier split), and every finished game page was re-read against
`web-design-guidelines`' text-contrast and colour-only-meaning rules.

All contrast numbers below are WCAG relative-luminance ratios, checked with a small script against
the *actual* rendered pairs (grepped out of each game's `.tsx`, not guessed) — `--game-accent` in
particular is rendered as **text**, not just a fill: `GameLayout`'s header icon hover and the
archive "Back to today" link, plus `ArchivePicker`'s hover state, all render every game's own
`--game-accent` as text color on `--game-surface` / `--game-surface-2`. That one shared-component
fact drove most of the per-game "accent" decisions below: several games needed a *second*, brighter
token for their signature decorative color (the thing that makes the game look like itself) because
the single `--game-accent` token had to stay dark enough to clear 4.5:1 as text.

Colour-blindness checks used a Brettel/Viénot-style simulation (protanopia/deuteranopia/tritanopia)
on each semantically-meaningful color group (feedback trios, multi-group sets), comparing simulated
colors pairwise with a redmean perceptual distance — not eyeballed.

## Site palette (`src/styles/brand.css`)

Built around `#E89E88` (H14° S68% L72%). `--brand-bg`/`--brand-surface`/`--brand-surface-2` are
soft, barely-saturated tints of that hue — pale blush, near-white, a slightly deeper blush card
tint. `#E89E88` itself measures only ~2:1 against white, far under the 4.5:1 a link or button
needs, so `--brand-accent` is a **deeper shade of the same 14° hue** (`#b64220`, ~5.2–5.5:1 as
text/link color, ~5.5:1 with white button text) rather than the pastel itself. Because the accent
is now dark enough to need white text, `--brand-accent-fg` flips from the original's warm-dark
text to white. `--brand-danger` and `--brand-muted` were both nudged slightly to clear 4.5:1 against
the new warmer backgrounds (pre-existing values were ~0.2–0.3 short). Token **names** are
untouched — only values changed, per CLAUDE.md.

## Wordle feedback trio

Wordle, Quordle, Mini, Bee, Zip, and Sudoku/Mini-Sudoku's unused placeholders all share one
softened green/gold/grey trio (`#367846` / `#8a6a28` / `#6d757e`), all ≥4.5:1 with the white tile
letters every one of these renders. The grey leans very slightly cool (not fully warm-neutral) —
a fully warm grey landed almost on top of the green under a deuteranopia simulation (the classic
green/grey collision that real Wordle has too, and which it also doesn't fully solve); this was
the best achievable separation while keeping the green actually reading as green and the grey
reading as neutral to someone with typical vision.

## Per-game palettes

- **Wordle** — soft sage green (135°), tiles still pure white, feedback trio above. Square tiles,
  no rounding, unchanged.
- **Quordle** — its own pale lavender-indigo (248°), not the pink site bg, so it reads apart from
  the hub chrome. Feedback trio same as Wordle. The four board tints were re-tuned for white-text
  contrast; board-3 (terracotta) and board-4 (olive-amber) sit closer together than ideal under a
  deuteranopia simulation after both were darkened for contrast — boards are also identified by
  fixed quadrant position and distinct words, so this is an accepted, documented tradeoff rather
  than a silent one.
- **Spelling Bee** — honey-cream page; the hive hexagons keep a bright, soft sunflower yellow
  (`--bee-center-bg`, background only, dark text on top — no contrast problem there).
  `--game-accent` itself is a deep honey (`#7c660e`) because Bee's own UI renders it as the active
  center-letter text color, where the original bright yellow measured ~1.6:1.
- **Connections** — warm mustard-cream; the bright mustard lives on in the easiest group's tile
  color. `--game-accent` deepened the same way as Bee (was ~2.9:1 as the shared header/archive
  text). The four group colors were re-verified for contrast and re-spaced for colour-blindness:
  blue and purple sat only 13 units apart under deuteranopia in the first pass and were pushed to
  distinct hues (not just lightness), landing ≥60 apart on every pair under every simulated type.
- **Digits** — tangerine (28°), a clear step from the site's own pink (14°) and States' rust (16°)
  so the three don't blur on the hub. Pastel round circles softened but still high-contrast with
  body text (they only ever carry `--game-fg`, never accent text).
- **Flagle** — kept close to current on purpose: softening the backdrop toward the family's pastel
  would start competing with the one thing Flagle needs to stay the strongest color on the page —
  the flag itself. Two small, necessary AA fixes: `--game-muted` was 4.2:1 against its own bg
  (now 4.6+), and the "Correct!" text in `--tile-correct` was 2.9:1 against the page (now 4.6+,
  same green hue, just deeper).
- **Globle** — stays a genuinely dark night globe; lightening it toward the family pastel would
  undo the whole point of a glowing heat-map on a dark sphere. The deep crimson accent was
  pre-existing but measured only ~2.9:1 against its own dark surfaces as the shared header/archive
  text; brightened to a warm coral-red that clears 4.5:1 both that way and as a background (its
  text flips to the dark navy ocean color, not white, since the new red is too light for white
  text). The heat scale (far→close gradient, solved mint, unguessed navy) in `logic.ts` softened to
  match and was re-checked for colour-blind separation — mint vs. the gold-to-red scale stays a
  different hue family, not just a different lightness, under every simulated type.
- **Mini Crossword** — off the pink bg into its own warm near-neutral newspaper page; the ink
  block is warm near-black rather than jet. `--game-accent` is a quiet ink-blue, serving the same
  role the original near-black accent did.
- **Mini Sudoku** — already close to the family's softness; mainly deepened its bright magenta
  accent (was ~3:1 against its own surfaces as the shared header/archive text and the selected-cell
  number).
- **States** — terracotta deepened and pulled a step further from the site's own pink hue so the
  two don't blur; indigo secondary accent and the silhouette fill colors softened but unchanged in
  role (silhouette colors are SVG fills, not text, so not AA-constrained the way `--game-accent` is).
- **Sudoku** — warmer cream paper, same ink-blue identity, slightly lifted ink.
- **Travle** — warmed sea-teal. The "unconnected" route-status color deliberately leans cool/slate
  rather than the family's usual warm neutral: a warm tan read almost identically to the green
  "on-path" color under a protanopia/deuteranopia simulation, and Travle's whole theme is
  sea/map-colored anyway, so a cool slate still belongs tonally.
- **Worldle** — sage-teal (160°), kept a clear step from Wordle's own green (135°) so the two read
  as different games on the hub. Proximity badges (high/mid/low/cold) re-verified for contrast and
  colour-blind separation.
- **Zip** — golden tangerine (36°), distinct from both the site pink and Digits' own tangerine
  (28°). The vivid orange→purple path gradient (`--zip-path-start`/`--zip-path-end`, kept in sync
  with the literal hex constants at the top of `components/Grid.tsx`) stays vivid and decorative;
  `--game-accent` is a deeper amber because it's rendered as the shared header/archive text.

## Exceptions summary

- **Flagle** — kept closest to its current palette of any game; the flag must stay the page's one
  strong color.
- **Globle** — kept its dark night-globe identity rather than joining the light pastel family; only
  its accent red and heat-scale gradient were adjusted, both for pre-existing contrast gaps.
- **Quordle board-3/board-4** and **Connections' first pass** — documented, not silent,
  colour-blindness tradeoffs after contrast fixes pulled colors toward each other; see above.
