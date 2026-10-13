# Redesign agent `travle`: Travle

Game id: `travle` · Dev server port: **5212** · Scope check: `node scripts/check-scope.mjs travle`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle: already done
`src/games/travle/theme.css` is already redesigned (the 3-tier guess classification — on-path /
adjacent / unconnected — renders as a dot fill and an SVG map-region fill, no text ever sits on top
of these colours). Don't re-derive it.

## Focus: wire in `GlideCombobox`
`src/components/fx/GlideCombobox.tsx` isn't used anywhere yet. Read its own prop doc comment first.

- Replace `src/games/travle/components/CountryCombobox.tsx`'s internals (or the whole component)
  with `GlideCombobox`. It currently takes `excludeCodes: Set<string>` ("codes that should never be
  suggested again — already guessed, or the start/end themselves") and matches by name or any alias
  (`matches()` in that file) — map `excludeCodes` to `excludeValues`.
- Keep `Map.tsx` and `GuessList.tsx` untouched — this is purely a swap of the guess input.
