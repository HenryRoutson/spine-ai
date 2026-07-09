#!/usr/bin/env bash
# AI : copy repo-root shared/ modules into each Next app's lib/shared/ (+ public assets).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sync_dir() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  # AI : copy files only (no nested node_modules); preserve relative layout.
  cp -R "$src/." "$dest/"
}

# AI : apps that consume @shared/* → ./lib/shared/*
for APP in combined_full_stack landing_page; do
  DEST="$ROOT/$APP/lib/shared"
  mkdir -p "$DEST"
  sync_dir "$ROOT/shared/legal" "$DEST/legal"
  sync_dir "$ROOT/shared/clipboard" "$DEST/clipboard"
  sync_dir "$ROOT/shared/landing-demo" "$DEST/landing-demo"
  sync_dir "$ROOT/shared/landing-proxy" "$DEST/landing-proxy"
  sync_dir "$ROOT/shared/rate-limit" "$DEST/rate-limit"
  sync_dir "$ROOT/shared/session-replay" "$DEST/session-replay"
  sync_dir "$ROOT/shared/json-viewer" "$DEST/json-viewer"
  # AI : json-viewer.html must be served from public/
  mkdir -p "$ROOT/$APP/public"
  cp "$ROOT/shared/json-viewer/json-viewer.html" "$ROOT/$APP/public/json-viewer.html"
done

# AI : dashboard only needs session-replay types today
mkdir -p "$ROOT/dashboard/lib/shared/session-replay"
sync_dir "$ROOT/shared/session-replay" "$ROOT/dashboard/lib/shared/session-replay"

echo "synced shared → combined_full_stack + landing_page (+ dashboard session-replay)"
