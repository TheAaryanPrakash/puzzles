#!/usr/bin/env bash
# Launch parallel Claude Code agents, one git worktree each, in a tmux session.
#
#   scripts/launch.sh                  # all fan-out agents
#   scripts/launch.sh wordle bee       # just these
#   DRY_RUN=1 scripts/launch.sh        # print the commands, start nothing
#   NO_TMUX=1 scripts/launch.sh        # print commands to paste into your own terminals
#   PERMISSION_MODE=acceptEdits scripts/launch.sh   # if auto mode isn't available to you
#   NO_ATTACH=1 scripts/launch.sh      # start in the background; attach later with: tmux attach -t puzzles
#   REDESIGN=1 scripts/launch.sh       # phase-2 mode: prompts/redesign/<id>.md, one agent per game
#                                      # (no design/backend — phase 1 already merged those), worktree
#                                      # identifier "ui-<id>" instead of "<id>" so branch/folder names
#                                      # (worktree-ui-<id> / .claude/worktrees/ui-<id>) never collide
#                                      # with a still-present phase-1 worktree of the same game.
#
# Each agent runs:  claude -w <worktree-id> -n <agent> --permission-mode <mode> "Read <prompt file> ..."
# which creates .claude/worktrees/<worktree-id>/ on branch worktree-<worktree-id>, from main's HEAD.
set -euo pipefail

ALL_AGENTS=(design backend wordle quordle bee sudoku digits connections mini zip worldle flagle globle travle states)
# Phase 2 (REDESIGN=1): every game gets its own restyle pass, including chess (not part of the
# phase-1 fan-out above — it was built separately, see CLAUDE.md "Chess"). sudoku still covers both
# sudoku and mini-sudoku in one agent, same grouping as phase 1 (prompts/redesign/sudoku.md says so).
REDESIGN_AGENTS=(wordle quordle bee sudoku digits connections mini zip worldle flagle globle travle states chess)
MODE="${PERMISSION_MODE:-auto}"
STAGGER="${STAGGER:-4}"   # seconds between starts, so worktree creation doesn't race
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [[ -n "${REDESIGN:-}" ]]; then
  PROMPT_DIR="prompts/redesign"
  WT_PREFIX="ui-"
  DEFAULT_AGENTS=("${REDESIGN_AGENTS[@]}")
  SESSION="${TMUX_SESSION:-puzzles-redesign}"
else
  PROMPT_DIR="prompts"
  WT_PREFIX=""
  DEFAULT_AGENTS=("${ALL_AGENTS[@]}")
  SESSION="${TMUX_SESSION:-puzzles}"
fi

if [[ $# -gt 0 ]]; then AGENTS=("$@"); else AGENTS=("${DEFAULT_AGENTS[@]}"); fi

# ---- preflight -------------------------------------------------------------
fail() { echo "✗ $*" >&2; exit 1; }

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || fail "Run this from the main branch (you're on '$branch')."
[[ -z "$(git status --porcelain)" ]] || fail "Main has uncommitted changes. Commit them first: agents branch from main's last commit."
git check-ignore -q .claude/worktrees/x || fail ".claude/worktrees/ is not in .gitignore."
for a in "${AGENTS[@]}"; do
  [[ -f "$PROMPT_DIR/$a.md" ]] || fail "No prompt file $PROMPT_DIR/$a.md (agent '$a')."
done
if [[ -z "${DRY_RUN:-}" ]]; then
  command -v "$CLAUDE_BIN" >/dev/null || fail "$CLAUDE_BIN is not on your PATH."
  # claude -w refuses to start until this folder's workspace-trust prompt has been accepted.
  if [[ -z "${TRUST_OK:-}" ]]; then
    echo "Claude Code must have been opened once in $ROOT with the trust prompt accepted,"
    echo "or every agent will fail with 'Workspace trust not yet accepted'."
    read -r -p "Done that already? [y/N] " reply
    [[ "$reply" =~ ^[Yy] ]] || fail "Run 'claude' here once, accept the prompt, exit, then re-run (or set TRUST_OK=1)."
  fi
  for a in "${AGENTS[@]}"; do
    wt=".claude/worktrees/${WT_PREFIX}$a"
    [[ ! -d "$wt" ]] || echo "• note: $wt exists; claude will reopen it."
  done
fi

cmd_for() {
  printf '%s -w %s -n %s --permission-mode %s "Read %s/%s.md and carry out that task. Work without waiting for approval."' \
    "$CLAUDE_BIN" "${WT_PREFIX}$1" "$1" "$MODE" "$PROMPT_DIR" "$1"
}

# ---- launch ----------------------------------------------------------------
if [[ -n "${DRY_RUN:-}" || -n "${NO_TMUX:-}" ]] || ! command -v tmux >/dev/null; then
  [[ -n "${DRY_RUN:-}${NO_TMUX:-}" ]] || echo "tmux not found. Run each command in its own terminal, from $ROOT:"
  for a in "${AGENTS[@]}"; do cmd_for "$a"; echo; done
  exit 0
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  fail "tmux session '$SESSION' already exists. Attach with: tmux attach -t $SESSION (or set TMUX_SESSION=other)."
fi

first=1
for a in "${AGENTS[@]}"; do
  if [[ $first -eq 1 ]]; then
    tmux new-session -d -s "$SESSION" -n "$a" -c "$ROOT"
    first=0
  else
    sleep "$STAGGER"
    tmux new-window -t "$SESSION" -n "$a" -c "$ROOT"
  fi
  tmux send-keys -t "$SESSION:$a" "$(cmd_for "$a")" C-m
  echo "• started $a"
done

echo
echo "All ${#AGENTS[@]} agents started in tmux session '$SESSION'."
echo "Switch windows: Ctrl-b then n / p, or Ctrl-b w for a list. Detach: Ctrl-b d."
if [[ -n "${TMUX:-}" || -n "${NO_ATTACH:-}" ]]; then
  echo "Attach with: tmux attach -t $SESSION"
else
  tmux attach -t "$SESSION"
fi
