# Redesign agent `states`: States

Game id: `states` · Dev server port: **5213** · Scope check: `node scripts/check-scope.mjs states`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/states/theme.css` is already redesigned (`--game-accent` moved to the approved heat-scale
"hot" coral, re-derived for AA). Don't re-derive it. The silhouette-size bug (several small UTs
rendering as near-invisible specks — Lakshadweep, Puducherry, Andaman & Nicobar, the merged
Dadra-Nagar-Haveli-Daman-Diu) was also already fixed this session, in the generator
(`scripts/states/silhouette.ts`) — not something to redo.

## Focus: wire in `GlideCombobox`
`src/components/fx/GlideCombobox.tsx` isn't used anywhere yet — it was in fact written with this
exact game in mind (its own prop comment names `resolveGuess` from `src/games/states/logic.ts`
directly). Read `GlideCombobox`'s own prop doc comment first.

- Replace `src/games/states/components/StateCombobox.tsx`'s internals (or the whole component)
  with `GlideCombobox`. It already calls `resolveGuess(query, nameIndex)` — a confident fast typist
  can hit Enter on a full, unambiguous name without ever opening the suggestion list (that file's
  own comment) — wire this straight into `GlideCombobox`'s `resolveFreeText`. Map `disabledCodes` to
  `excludeValues`.
- Keep `Silhouette.tsx` and `GuessList.tsx` untouched — this is purely a swap of the guess input.

## The "green/yellow squares" (investigate before touching anything nearby)
`squaresForPct` in `logic.ts` renders Worldle's own 🟩🟨⬛ proximity-square convention (rounded
down to the nearest 10%, documented against Worldle's FAQ worked example) — and unlike most
share-text helpers on this site, it's rendered **both** in the live in-game guess list
(`GuessList.tsx`) and in the post-game share text, not just the share text. It's plain Unicode
emoji, so it can't be retheme'd via CSS tokens, and the guesses list already carries the same
information as plain text for screen readers (`${distanceKm} kilometers away, ${proximityPct}%
close`). Don't change the emoji scheme itself (it deliberately matches the real Worldle's
convention) — just confirm live that it still reads clearly in the new dark layout, and don't mistake
it for something `theme.css` controls when restyling the guess list around it.
