# Redesign agent `globle`: Globle

Game id: `globle` · Dev server port: **5211** · Scope check: `node scripts/check-scope.mjs globle`

Read CLAUDE.md, then follow `prompts/redesign/_game.md` step by step for this game.

## Restyle and a real colour bug: already fixed, on main
Both are already done, outside this worktree — **don't redo either**:
- The globe's colours (ocean/graticule/country-outline/unguessed-fill/heat scale) all blended
  together, for two stacked reasons: `Globe.tsx`'s `cssVar()` was reading CSS custom properties off
  the wrong DOM element (silently always falling back to a hardcoded placeholder navy palette, never
  the real theme), and once that was fixed, the actual theme.css values were also too close
  together. Both fixed; verify live it still looks right, but don't re-investigate.
- `src/games/globle/theme.css` is otherwise already redesigned.

## Focus: wire in `GlideCombobox`
`src/components/fx/GlideCombobox.tsx` isn't used anywhere yet. Read its own prop doc comment first.

- Replace `src/games/globle/components/GuessInput.tsx`'s internals (or the whole component) with
  `GlideCombobox`. It currently takes `guessedCodes: ReadonlySet<string>` and matches against each
  country's name plus aliases, filtering out already-guessed codes entirely ("there's nothing useful
  to guess again" — that file's own comment) — map `guessedCodes` to `excludeValues`.
- Keep the `Globe` canvas and its proximity-colour fills untouched — this is purely a swap of the
  text guess input beneath the globe.
