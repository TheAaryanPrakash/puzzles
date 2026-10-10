# Game agent procedure (shared by every game prompt)

You are one of ~15 agents building this site at the same time, each in its own git worktree.
Read CLAUDE.md fully first, especially "Research first", "Game contract" and "Parallel work rules".
Then follow these steps in order. **Work without waiting for approval.** The human reviews your
finished branch, so don't stop to ask questions: when something is ambiguous, pick the option the
research supports, note it in HANDOFF.md, and continue.

## 1. Set up
- `pnpm install`
- Confirm `pnpm test` passes on the untouched foundation before you change anything.
- Copy the shape of `src/games/_example/`. It shows the whole contract working end to end.

## 2. Research → `src/games/<id>/RESEARCH.md`
Follow CLAUDE.md "Research first", using the **Research focus** in your prompt file.
Read the SKILL.md of every skill CLAUDE.md maps to game agents (`motion-framer`, `ui-ux-pro-max`,
`playwright-cli`, `web-design-guidelines`) and note in RESEARCH.md how you'll use each one.
Commit RESEARCH.md as soon as it's written ("<id>: research").

## 3. Generator or importer → `content/puzzles/<id>/` and `scripts/out/<id>-samples.md`
- Build it in `scripts/<id>/`, with Vitest tests for its core logic.
- Run it for the full schedule. Read your own samples file critically: would a friend enjoy these
  5 puzzles? Fix the generator if not (too obscure, too easy, repetitive, broken).
- Commit ("<id>: generator").

## 4. Game
- Pure logic in `logic.ts` with tests for every edge case in RESEARCH.md and your prompt.
- UI in `index.tsx` + `components/`, theme in `theme.css`, inside `<GameLayout>`.
- Restorable state, start on first move, finish with a spoiler-free summary (CLAUDE.md contract).
- Signature animations (flips, shakes, merges, slides) with `motion`, following `motion-framer`,
  and every one honours reduced motion.
- Run the dev server on **your** port (`PORT=<port> pnpm dev`). Check the game with
  `?date=` set to at least 3 different days, at 375px wide, and with only a physical keyboard.
  Use `playwright-cli` / `pnpm shot` to screenshot it at 375px and 1280px, look at the screenshots,
  and fix what looks off. Save the final pair as `src/games/<id>/screenshots/{mobile,desktop}.png`.
- Commit in small steps.

## 5. Finish
1. Review your page with the `web-design-guidelines` skill and fix what it finds.
2. `pnpm test` and `pnpm build` pass.
3. `node scripts/check-scope.mjs <agent>` passes.
4. Write `src/games/<id>/HANDOFF.md`:
   - **Built:** what works, with any deviations from the prompt and why.
   - **Review:** the 3–5 things the human should check by hand.
   - **Shared changes requested:** exact file, change and reason, or "None".
   - **Licences:** any copied code and its licence, or "None".
   - **Known issues.**
5. Stop your dev server. Commit everything ("<id>: done"). Don't push or merge.
6. Reply with a 5-line summary: done or blocked, test count, shared changes requested, top review item.
