#!/usr/bin/env bash
# Launch parallel Claude Code agents, one git worktree each, in a tmux session.
#
#   scripts/launch.sh                  # all fan-out agents
#   scripts/launch.sh wordle bee       # just these
#   DRY_RUN=1 scripts/launch.sh        # print the commands, start nothing
#   NO_TMUX=1 scripts/launch.sh        # print commands to paste into your own terminals
#   PERMISSION_MODE=acceptEdits scripts/launch.sh   # if auto mode isn't available to you
#   NO_ATTACH=1 scripts/launch.sh      # start in the background; attach later with: tmux attach -t puzzles
#
# Each agent runs:  claude -w <agent> -n <agent> --permission-mode <mode> "Read prompts/<agent>.md ..."
# which creates .claude/worktrees/<agent>/ on branch worktree-<agent>, from main's HEAD.
set -euo pipefail

ALL_AGENTS=(design backend wordle quordle bee sudoku digits connections mini zip worldle flagle globle travle states)
MODE="${PERMISSION_MODE:-auto}"
SESSION="${TMUX_SESSION:-puzzles}"
STAGGER="${STAGGER:-4}"   # seconds between starts, so worktree creation doesn't race
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [[ $# -gt 0 ]]; then AGENTS=("$@"); else AGENTS=("${ALL_AGENTS[@]}"); fi

# ---- preflight -------------------------------------------------------------
fail() { echo "✗ $*" >&2; exit 1; }

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || fail "Run this from the main branch (you're on '$branch')."
[[ -z "$(git status --porcelain)" ]] || fail "Main has uncommitted changes. Commit them first: agents branch from main's last commit."
git check-ignore -q .claude/worktrees/x || fail ".claude/worktrees/ is not in .gitignore."
for a in "${AGENTS[@]}"; do
  [[ -f "prompts/$a.md" ]] || fail "No prompt file prompts/$a.md (agent '$a')."
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
    [[ ! -d ".claude/worktrees/$a" ]] || echo "• note: .claude/worktrees/$a exists; claude will reopen it."
  done
fi

cmd_for() {
  printf '%s -w %s -n %s --permission-mode %s "Read prompts/%s.md and carry out that task. Work without waiting for approval."' \
    "$CLAUDE_BIN" "$1" "$1" "$MODE" "$1"
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
