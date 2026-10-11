# Sansita's Puzzles — build plan

Launch: **Sat 17 Oct 2026** (invite-only, friends sign in with Google).
Birthday finale for Sansita: **Sat 23 Jan 2027**.

All 14 games are built **at the same time** by parallel Claude Code agents, one git worktree each.

```
Phase 0   foundation (on main) ─┐                 2 agents at once
          data (worktree) ──────┘
              │ merge data
Phase 1   design · backend · wordle · quordle · bee · sudoku(+mini) · digits ·
          connections · mini · zip · worldle · flagle · globle · travle · states
                                                  15 agents at once
              │ scripts/merge-all.sh
Phase 2   integration (on main)                   1 agent
Phase 3   QA with two accounts, deploy            you
```

Why there's a short Phase 0: every agent needs the same scaffold, data layer, component props and
word/geo data. Building those first and freezing them is what lets 15 agents work without waiting on
or breaking each other. The design agent restyles components *while* games use them, through frozen
props and token names, so nothing in Phase 1 depends on anything else in Phase 1.

## Schedule

| Day | What |
|---|---|
| Sat 10 Oct | Manual setup (below). Phase 0: foundation + data in parallel. Merge data. |
| Sun 11 Oct | Phase 1: launch all 15 agents. Check in on them every hour or two. |
| Mon 12 Oct | Agents finish. Review each branch, merge with `scripts/merge-all.sh`. Relaunch any stragglers. |
| Tue 13 Oct | Phase 2: integration, Supabase switch-over, puzzle upload. |
| Wed 14 Oct | Phase 3: QA on phone and laptop with two accounts. Deploy. |
| Thu–Fri | Buffer. |
| Sat 17 Oct | Launch: send the invite link. |

## Before you start: limits to know

- **Usage limits.** 15 agents draw on your Claude plan's usage at the same time, so you'll reach your
  limits much faster than with one session. If that's a concern, launch in two batches:
  `scripts/launch.sh design backend wordle quordle bee sudoku digits`, then the rest later.
- **Your machine.** Each agent runs Node, tests and a dev server. 15 at once is heavy for a laptop.
  If it slows to a crawl, use batches the same way. pnpm keeps disk use down; each worktree still
  costs some space.
- **Your Mac:** keep the screen awake while agents run (`caffeinate -dims` in a spare Terminal tab),
  and keep the lid open or plugged in. A sleeping Mac pauses every agent.
- **Permissions.** Agents start in auto mode (`--permission-mode auto`), where a classifier approves
  routine actions instead of asking you. If auto mode isn't available on your account, use
  `PERMISSION_MODE=acceptEdits scripts/launch.sh`; the allowlist in `.claude/settings.json` covers the
  common commands, but expect some prompts across the windows.

## Manual setup (about an hour, day 1)

Repo: `~/Documents/Projects/Puzzles` on your Mac, GitHub repo `puzzles` (private). Your 45 skills are
already in `.claude/skills/`; they get committed so every agent's worktree has them.

1. **Add the starter files** to the folder without touching your skills:
   ```bash
   cd ~/Documents/Projects/Puzzles
   unzip -n ~/Downloads/puzzles-starter.zip -d .     # -n: never overwrite existing files
   chmod +x scripts/*.sh scripts/*.mjs
   ```
2. **First commit and GitHub:**
   ```bash
   git init -b main && git add -A && git commit -m "Starter: plan, prompts, scripts, schema, skills"
   gh auth status || gh auth login
   gh repo create puzzles --private --source . --push
   ```
3. **Trust the folder and check the skills:** run `claude` in the folder, accept the trust prompt if
   asked, type `/skills`, and check the 11 skills mapped in CLAUDE.md "Skills" are available. Then `/exit`.
   Without trust, `claude -w` refuses to start and every agent fails.
4. **Supabase:** create a free project in the Mumbai region. In the SQL editor, paste and run
   `supabase/migrations/0001_init.sql`. Then set your invite code:
   `insert into private.app_config values ('invite_code', '<something only friends get>');`
   Note the project URL, the anon (publishable) key and the service role key.
5. **Google sign-in:**
   - Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.
     Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Providers → Google: paste the client ID and secret, enable.
   - Supabase → Authentication → URL Configuration: add `http://localhost:5173` and
     `http://localhost:5102` to redirect URLs. Add the Vercel URL after the first deploy.
   - Email login isn't used: Supabase's built-in email only sends to your own team, 2 per hour.
6. **Secrets:** `.env.local` in the repo root (gitignored):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # local only: never in Vercel, never VITE_-prefixed
   ```
   Agents are denied reading `.env` files (`.claude/settings.json`). The backend agent can work fully
   against mocks; you test the live parts in Phase 2.
7. **Vercel:** import the repo later (Phase 3) with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
   `VITE_DATA_SOURCE=supabase`.

## Phase 0: foundation and data (2 agents at once)

```bash
scripts/launch.sh data        # data agent in its own worktree, inside tmux. Detach: Ctrl-b d
# in a second terminal, on main:
claude -n foundation "Read prompts/foundation.md and carry out that task."
```
The foundation agent works directly on main. When both have finished:
```bash
git merge --no-ff worktree-data -m "Merge data"
pnpm install && pnpm test && pnpm build
```
Before Phase 1, spend 10 minutes on what everyone will build against:
- `pnpm shot http://localhost:5173/_example /tmp/x.png 375` works (agents rely on it for screenshots;
  start `pnpm dev` first).
- `src/components/types.ts`: do the shared components' props cover all 14 games? (Keyboard for
  Wordle/Quordle, a slot in ResultModal for game-specific results, and so on.)
- `src/lib/data/types.ts` matches CLAUDE.md, and `src/games/_example/` runs at `/_example`.
- `data/README.md` looks complete.

Fix anything now, on main, and commit. These are frozen once Phase 1 starts.

## Phase 1: fan-out (15 agents at once)

```bash
scripts/launch.sh             # all 15, in tmux session "puzzles"
```
Each agent gets its own worktree at `.claude/worktrees/<agent>/` on branch `worktree-<agent>`, its own
dev server port, and a prompt file in `prompts/`. Agents research, write `RESEARCH.md`, build, test,
check their own scope, write `HANDOFF.md`, commit `"<id>: done"` and stop. They don't wait for
approval along the way.

**Checking in:**
```bash
tmux attach -t puzzles                     # Ctrl-b w lists windows; Ctrl-b n/p next/previous
git for-each-ref --format='%(refname:short)  %(committerdate:relative)  %(subject)' 'refs/heads/worktree-*'
```
That second line shows every agent's latest commit; `<id>: done` means finished. An agent that's
asking you something, or has stopped early, is waiting in its tmux window. Answer it there.

**If an agent goes wrong:** in its window, tell it what to fix. To restart one from scratch: exit it,
`git worktree remove --force .claude/worktrees/<agent> && git branch -D worktree-<agent>`, then
`scripts/launch.sh <agent>` (with a different `TMUX_SESSION=` if "puzzles" is still open).

## Review and merge

For each finished game, before merging (about 10 minutes each):
1. Read `src/games/<id>/RESEARCH.md` (the approach) and `HANDOFF.md` (the review list).
2. Skim `scripts/out/<id>-samples.md`: are these puzzles fun and fair?
3. Play it once: `cd .claude/worktrees/<id> && PORT=<its port> pnpm dev`.

Then:
```bash
scripts/merge-all.sh          # merges design, backend, then every finished game
pnpm install && pnpm test && pnpm build
```
It skips (and explains) any agent that isn't finished, has uncommitted work, or touched files outside
its scope. Merge conflicts shouldn't happen, since every agent owns separate folders; if one does,
the script aborts that merge and tells you.

If a game isn't ready by launch, leave it out. Games are discovered automatically, so an unmerged game
simply doesn't appear on the hub, and you can merge it any day later.

## Phase 2: integration (1 agent, on main)

```bash
claude -n integration "Read prompts/integration.md and carry out that task."
```
It applies the shared changes games asked for, re-runs the Quordle generator against Wordle's answers,
checks determinism, does a visual pass now that the design system is merged, switches to Supabase,
uploads puzzles and builds the birthday finale.

After Sansita signs up, add her finale message in the SQL editor:
```sql
insert into public.messages (recipient, unlock_date, required_games, content)
select user_id, '2027-01-23', 14, '{"title": "...", "body": "...", "photos": [], "video": null}'
from public.profiles where display_name = 'Sansita';
```
Lower `required_games` if 14 games in one day feels like too many. The database enforces it.

## Phase 3: QA and deploy

With two accounts (yours plus a second Google account):
- [ ] Both accounts get the same puzzle for every game on the same day
- [ ] A finished game can't be replayed (refresh, another device, another browser)
- [ ] An unfinished game continues on another device exactly where it stopped
- [ ] Tomorrow's puzzles aren't readable: from the browser console with the anon key, query
      `puzzles` for tomorrow's date and expect no rows
- [ ] The build contains no puzzle content: grep `dist/` for three future answers, expect nothing
- [ ] The service role key isn't in Vercel's env vars or the bundle
- [ ] Share text has no answers; opens the share sheet on phone, copies on laptop
- [ ] Friends board hidden until you finish, then shows both accounts
- [ ] Streaks: win yesterday and today → 2; an archive catch-up doesn't extend a streak
- [ ] Puzzles flip at midnight India time (local adapter `?date=` override)
- [ ] Every game at 375px and with only a physical keyboard
- [ ] A signed-in non-member (no invite code) sees nothing
- [ ] noindex meta and robots.txt present
- [ ] Deploy to Vercel; add its URL to Supabase's Site URL and redirect URLs

Launch: send `https://<site>/join?invite=<invite code>` to your friends.

Free-plan note: Supabase pauses a free project after about a week with too little activity. Daily
players keep it awake; if everyone stops for a week, unpause it from the dashboard.

## Reference: agents, ports, scopes

| Agent | Builds | Port | Prompt |
|---|---|---|---|
| foundation | scaffold, frozen interfaces, local adapter (on main, Phase 0) | 5173 | prompts/foundation.md |
| data | word lists, geo, archives (Phase 0) | — | prompts/data.md |
| design | design system, hub, themes page | 5101 | prompts/design.md |
| backend | Supabase adapter, sign-in, upload script | 5102 | prompts/backend.md |
| wordle · quordle · bee | word games | 5201–5203 | prompts/<agent>.md |
| sudoku | Sudoku and Mini Sudoku | 5204 | prompts/sudoku.md |
| digits · connections · mini · zip | | 5205–5208 | |
| worldle · flagle · globle · travle · states | geography | 5209–5213 | |
| integration | merge follow-up, finale (on main, Phase 2) | 5173 | prompts/integration.md |

Exact scopes: `scripts/check-scope.mjs`. Every game agent also follows `prompts/_game.md`.
