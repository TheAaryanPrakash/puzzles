# Redesign agent `flagle`: Flagle

Game id: `flagle` · Dev server port: **5210** · Scope check: `node scripts/check-scope.mjs flagle`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/flagle/theme.css` is already redesigned (neutral surface, by design, so each guessed
flag's own colours stay the thing that reads). Don't re-derive it.

## Focus: wire in `GlideCombobox`
`src/components/fx/GlideCombobox.tsx` isn't used anywhere yet. Read its own prop doc comment first.

- Replace `src/games/flagle/components/CountryAutocomplete.tsx`'s internals (or the whole
  component) with `GlideCombobox`. It currently takes `excludeCodes: string[]` (already-guessed) and
  matches by name, alias or ISO code (`matches()` in that file) — map `excludeCodes` to
  `excludeValues`. If `matches()`'s alias/code matching needs to stay reachable for a typed value
  that isn't in the visible suggestion list, thread it through `resolveFreeText`; otherwise
  `onSubmit` alone (pick-from-list only) is fine — match whatever the current component's actual
  behaviour is, don't change the input contract while restyling it.
- Keep `FlagTiles.tsx` and `GuessHistory.tsx` untouched — this is purely a swap of the guess input.
