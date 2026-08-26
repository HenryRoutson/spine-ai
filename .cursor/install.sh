#!/usr/bin/env bash
# AI : Cloud Agent install phase — idempotent system deps (Docker + Supabase CLI) + repo npm deps.
# AI : Safe to re-run: system installs are skipped when already present (e.g. booting from a snapshot).
set -euo pipefail
cd "$(dirname "$0")/.."

# AI : nested-VM Docker + Supabase CLI. Only install when missing so snapshot boots stay fast.
if ! command -v docker >/dev/null 2>&1 || ! command -v supabase >/dev/null 2>&1; then
  sudo apt-get update -qq
  # AI : keep existing conffiles non-interactively (fuse3 prompts on /etc/fuse.conf otherwise).
  # AI : --force-confold is a dpkg option, so pass it via -o Dpkg::Options, not directly to apt-get.
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
    docker.io fuse-overlayfs iptables git curl
  if ! command -v supabase >/dev/null 2>&1; then
    arch="$(dpkg --print-architecture)"
    latest="$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
      | grep -oP '"tag_name":\s*"\K[^"]+')"
    curl -fsSL -o /tmp/supabase.deb \
      "https://github.com/supabase/cli/releases/download/${latest}/supabase_${latest#v}_linux_${arch}.deb"
    sudo dpkg -i /tmp/supabase.deb
  fi
fi

# AI : nested-VM Docker needs the fuse-overlayfs storage driver, legacy iptables, and the
# AI : containerd snapshotter disabled (default-on in Docker 29+). daemon.json is durable state.
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "storage-driver": "fuse-overlayfs",
  "features": { "containerd-snapshotter": false },
  "iptables": true
}
JSON
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true

# AI : let the runtime user reach the Docker socket without sudo on later boots.
sudo groupadd -f docker
sudo usermod -aG docker "$(id -un)"

# AI : repo dependencies — npm install across all apps + shared sync (idempotent).
python3 scripts/setup_local.py deps
