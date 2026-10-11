# states — HANDOFF

## Built

The full Worldle-in-India loop, localized per RESEARCH.md:

- **Generator** (`scripts/states/`): `silhouette.ts` builds one self-fitted 320×320 SVG path per
  feature from `public/assets/shared/india-states.json` (TopoJSON, 36 features); `pool.ts` is a
  seeded (101), no-immediate-repeat shuffle cycling through all 36 every 36 days; `generate.ts` wires
  both into `content/puzzles/states/*.json` (day file `{ code }`, `reserve: null`) and
  `public/assets/states/silhouettes.json` (name + centroid + path + viewBox + India's own
  `maxDistanceKm`, so the client never needs the raw topology). Ran for the full 365-day schedule;
  `scripts/out/states-samples.md` has 5 sample days, the full 36-territory roster and the
  multi-part/tiny-silhouette notes.
- **Logic** (`logic.ts`): distance/bearing/arrow/proximity via the shared `lib/geo.ts`, scaled to
  India's own max centroid distance (3,105 km) instead of Earth's antipodal distance — otherwise
  every guess inside India would read 85–100%. Aliases for renamed states (Orissa, Mysore, Madras,
  Pondicherry, Uttaranchal), split/merged UTs, and common short forms (UP, MP, TN, ...); deliberately
  *not* aliased: "Bombay" (split into two states, no single correct answer) and "UK" (reads as United
  Kingdom). Full reasoning and the alias table are in RESEARCH.md §4.
- **UI**: `StateCombobox` is an APG-pattern accessible combobox (arrow keys, `Enter`, `Escape`,
  `aria-activedescendant`, shake animation on an unresolvable guess); `Silhouette` renders the
  per-feature SVG path, recoloring terracotta → green/brown on win/loss; `GuessList` shows newest
  guess on top with a spring slide-in, distance, a direction-arrow badge, and the same proximity
  squares used in the share summary. All motion branches on `useReducedMotion`.
- Theme: terracotta/indigo/cream, Poppins, per the prompt.
- 130 tests pass (`pnpm vitest run`), `pnpm build` succeeds, `node scripts/check-scope.mjs states`
  passes (387 files, all in scope).

## Review

1. **Alias table** (`logic.ts` `STATE_ALIASES`) — a friend who grew up with different state names
   than the ones I picked might expect one I left out; easy to extend.
2. **Direction-arrow badge color** — I changed the arrow from plain text to a small indigo circle
   (`GuessList.tsx`) late, to make it read as the signature accent rather than decoration; take a
   look at `src/games/states/screenshots/{desktop,mobile}.png` (after a guess) and say if it should
   be plainer.
3. **Multi-part silhouettes** — Andaman & Nicobar, West Bengal (56 parts from river/border detail)
   and a few others render as scattered shapes rather than one solid blob; intentional (matches
   Worldle's own handling of archipelago countries) but worth eyeballing at `?date=` for a day whose
   answer is one of these.
4. **Tiny UTs at full silhouette size** — Chandigarh/Delhi/Lakshadweep/Puducherry render at the same
   visual size as Rajasthan (per-feature fit, not a shared scale) — intentional, but means the
   silhouette alone never hints at the answer's real-world size.
5. Physical-keyboard-only run and 375px/1280px screenshots done via `pnpm shot`-style Playwright
   scripts (not checked in — see Known issues); worth a manual tab-through once more after merge,
   since GameLayout's own header/help/archive controls are the design agent's restyle target too.

## Shared changes requested

None.

## Licences

None — no code copied. Flagle's (MIT) distance/direction *concept* informed the approach but
`src/lib/geo.ts` already implements it independently (see RESEARCH.md §2–3).

## Known issues

- None known. The debug Playwright scripts used to check keyboard focus order and capture
  screenshots were scratch files, not committed (see RESEARCH.md's "Build plan" — screenshots
  themselves are committed under `src/games/states/screenshots/`).
