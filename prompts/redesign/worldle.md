# Redesign agent `worldle`: Worldle

Game id: `worldle` · Dev server port: **5209** · Scope check: `node scripts/check-scope.mjs worldle`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/worldle/theme.css` is already redesigned (proximity scale reuses Globle's approved
heat-scale swatches). Don't re-derive it.

## Focus: wire in `GlideCombobox`
`src/components/fx/GlideCombobox.tsx` isn't used anywhere yet. Read its own prop doc comment first.

- Replace `src/games/worldle/components/CountryAutocomplete.tsx`'s internals (or the whole
  component, caller's choice) with `GlideCombobox`. It currently takes `excludeCodes: string[]` and
  calls `searchCountries(query, names, excludeCodes)` with no free-text parsing ("what gets guessed
  is always an unambiguous country code" — read that file's own comment) — map `excludeCodes` to
  `GlideCombobox`'s `excludeValues`, and keep the "only an exact suggestion-list pick submits"
  behaviour via `onSubmit` (not `resolveFreeText`, since this game deliberately has none — don't add
  free-text matching it currently lacks on purpose).
- Keep the silhouette reveal, distance arrow and direction feedback untouched — this is purely a
  swap of the guess input, not the result/feedback UI around it.
