#!/usr/bin/env bash
# AI : Cloud Agent per-boot start — Docker daemon + local Supabase + seed user. Must return (non-blocking).
set -euo pipefail
cd "$(dirname "$0")/.."

# AI : start dockerd if the socket is not answering, then wait for readiness.
if ! sudo docker info >/dev/null 2>&1; then
  sudo rm -f /var/run/docker.pid
  sudo bash -c 'nohup dockerd >/var/log/dockerd.log 2>&1 &'
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
# AI : keep the socket group-readable so the runtime user can talk to Docker without sudo.
sudo chown root:docker /var/run/docker.sock 2>/dev/null || true
sudo chmod 660 /var/run/docker.sock 2>/dev/null || true

# AI : .env bootstrap + generated local secrets (dashboard access / landing proxy / ip salt).
python3 scripts/setup_local.py env || true

# AI : OpenRouter — Cursor injects OPENROUTER_KEY; the app reads OPENROUTER_API_KEY from .env.
# AI : Prefer a real secret over the local placeholder so billed inference works in cloud agents.
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-${OPENROUTER_KEY:-sk-or-local-dev-placeholder}}" python3 - <<'PY'
import os, pathlib

def is_missing(v: str) -> bool:
    s = v.strip().strip('"')
    return not s or s.startswith("sk-or-local")

key = (
    os.environ.get("OPENROUTER_API_KEY")
    or os.environ.get("OPENROUTER_KEY")
    or "sk-or-local-dev-placeholder"
)
env = pathlib.Path(".env")
lines = env.read_text().splitlines() if env.exists() else []
out, done = [], False
for line in lines:
    if line.startswith("OPENROUTER_API_KEY="):
        current = line.split("=", 1)[1].strip().strip('"')
        out.append(line if not is_missing(current) else f'OPENROUTER_API_KEY="{key}"')
        done = True
    else:
        out.append(line)
if not done:
    out.append(f'OPENROUTER_API_KEY="{key}"')
env.write_text("\n".join(out) + "\n")
PY

# AI : bring up local Supabase (restarts snapshot containers/volumes) + idempotent test-user seed.
# AI : `sg docker` grants Docker-group access on the very first boot before a fresh login would.
sg docker -c "python3 scripts/setup_local.py supabase"
sg docker -c "python3 scripts/setup_local.py seeds"
