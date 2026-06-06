#!/usr/bin/env bash
# Install project git hooks. Safe to run multiple times (idempotent).
# Called automatically by scripts/post-merge.sh after every git merge,
# and should be run once manually after a fresh clone.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_SRC="$REPO_ROOT/scripts/check-replit-secrets.sh"
HOOK_DST="$HOOKS_DIR/pre-commit"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "setup-git-hooks: .git/hooks directory not found — are you inside a git repo?"
  exit 1
fi

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "setup-git-hooks: $HOOK_SRC not found, skipping."
  exit 0
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "setup-git-hooks: installed $HOOK_SRC -> $HOOK_DST"
