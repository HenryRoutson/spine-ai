#!/usr/bin/env bash
# AI : copy committed hooks into .git/hooks (no git config).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIT_DIR="$ROOT/.git"
if [ -f "$GIT_DIR" ]; then
  GIT_DIR="$(sed -n 's/^gitdir: //p' "$GIT_DIR")"
  case "$GIT_DIR" in
    /*) ;;
    *) GIT_DIR="$ROOT/$GIT_DIR" ;;
  esac
fi
if [ ! -d "$GIT_DIR" ]; then
  exit 0
fi

mkdir -p "$GIT_DIR/hooks"
cp "$ROOT/scripts/git-hooks/pre-commit" "$GIT_DIR/hooks/pre-commit"
chmod +x "$GIT_DIR/hooks/pre-commit"
