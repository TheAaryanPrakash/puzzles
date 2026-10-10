#!/usr/bin/env bash
# Merge finished agent branches into main, design and backend first.
# For each agent: the branch must exist, its worktree must be clean, its scope check must pass.
# Agents whose last commit isn't "<id>: done" are skipped unless FORCE=1.
#
#   scripts/merge-all.sh               # every agent that's ready
#   scripts/merge-all.sh wordle bee    # just these
#   DRY_RUN=1 scripts/merge-all.sh     # report readiness only
set -uo pipefail

ORDER=(design backend wordle quordle bee sudoku digits connections mini zip worldle flagle globle travle states)
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
if [[ $# -gt 0 ]]; then AGENTS=("$@"); else AGENTS=("${ORDER[@]}"); fi

[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || { echo "✗ Run from main."; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "✗ Main has uncommitted changes."; exit 1; }

merged=(); skipped=()
for a in "${AGENTS[@]}"; do
  b="worktree-$a"; wt=".claude/worktrees/$a"
  if ! git show-ref -q --verify "refs/heads/$b"; then skipped+=("$a (no branch)"); continue; fi
  if git merge-base --is-ancestor "$b" main; then echo "• $a: already merged"; continue; fi
  last="$(git log -1 --format=%s "$b")"
  if [[ "$last" != *"done"* && -z "${FORCE:-}" ]]; then skipped+=("$a (last commit: \"$last\")"); continue; fi
  if [[ -d "$wt" ]]; then
    if [[ -n "$(git -C "$wt" status --porcelain)" ]]; then skipped+=("$a (uncommitted work in $wt)"); continue; fi
    if ! (cd "$wt" && node scripts/check-scope.mjs "$a" main >/dev/null 2>&1); then
      skipped+=("$a (scope check failed: run it in $wt)"); continue
    fi
  fi
  if [[ -n "${DRY_RUN:-}" ]]; then echo "• $a: ready"; continue; fi
  if git merge --no-ff -q "$b" -m "Merge $a"; then
    merged+=("$a"); echo "✓ merged $a"
  else
    git merge --abort; skipped+=("$a (merge conflict: aborted, resolve by hand)")
  fi
done

echo
[[ ${#merged[@]} -gt 0 ]] && echo "Merged: ${merged[*]}"
if [[ ${#skipped[@]} -gt 0 ]]; then echo "Skipped:"; printf '  - %s\n' "${skipped[@]}"; fi
if [[ ${#merged[@]} -gt 0 ]]; then
  echo; echo "Now run: pnpm install && pnpm test && pnpm build"
fi
