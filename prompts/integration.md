# Agent `integration`: merge everything, cross-game checks, finale (runs on main)

Read CLAUDE.md. You run on main after the human has merged the fan-out branches (or ask them to,
listing the order below). Unlike the parallel agents, you may edit shared files.

1. **Merge check.** Confirm these branches are merged into main, in this order: worktree-design,
   worktree-backend, then every game. For each game, re-run its scope check against main
   (`node scripts/check-scope.mjs <agent> main` from its branch) and report any violations.
2. **Shared changes.** Read every `src/games/*/HANDOFF.md` "Shared changes requested". Apply the
   reasonable ones to `src/lib`, `src/components` or `src/styles`; list any you declined and why.
   Re-run all tests after each.
3. **Cross-game.** Re-run the Quordle generator with `--exclude content/puzzles/wordle`. Then run every
   generator from clean and confirm `content/` is byte-identical apart from that change (determinism).
4. **Visual pass.** Screenshot every game, the hub and the auth pages at 375px and 1280px with
   `playwright-cli` / `pnpm shot`, now that the design system is merged. Audit them with
   `web-design-guidelines` and `redesign-existing-projects` (audit only, no redesign). Fix anything
   that broke because a game styled around a component instead of through tokens.
5. **Switch to Supabase.** With `VITE_DATA_SOURCE=supabase` against the real project, play one round of
   every game with a test account: start, refresh mid-game, continue in another browser, finish,
   confirm it can't be replayed, stats update, the friends board appears after finishing.
6. **Upload.** `npx tsx scripts/upload-puzzles.ts --dry-run`, then for real. Verify counts per game.
7. **Finale.** Add `getMessage()` to DataSource and both adapters (reads `messages`; the database
   returns nothing until she's the recipient, it's the day, and enough games are done). On BIRTHDAY,
   the hub calls it after each finished game; once it returns a message, show an "Open your surprise"
   card. `src/pages/Finale.tsx` renders heading, message, optional photos and video from a private
   Supabase Storage bucket readable only by her (storage policy in a new migration, with a test).
   Big celebration on open: confetti plus a reveal choreographed with `motion` (follow `motion-framer`).
8. `pnpm test`, `pnpm test:db` and `pnpm build` pass. Commit and summarise.
