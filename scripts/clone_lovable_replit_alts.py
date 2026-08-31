#!/usr/bin/env python3
# AI : shallow-clone MIT Lovable/Replit alts to /tmp/lovable-alts — do not vendor into git.
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

DEST = Path("/tmp/lovable-alts")

# AI : port=True rows are the ones Spine F3 implements. Others are comparison-only.
REPOS = (
    ("bolt.diy", "https://github.com/stackblitz-labs/bolt.diy.git"),
    ("open-lovable", "https://github.com/mendableai/open-lovable.git"),
    ("gpt-engineer", "https://github.com/gpt-engineer-org/gpt-engineer.git"),
    ("dyad", "https://github.com/dyad-sh/dyad.git"),
    ("claudable", "https://github.com/opactorai/Claudable.git"),
)


def clone(name: str, url: str) -> int:
    target = DEST / name
    if target.exists():
        print(f"exists {target}")
        return 0
    cmd = ["git", "clone", "--depth", "1", "--filter=blob:none", url, str(target)]
    print(" ".join(cmd))
    return subprocess.call(cmd)


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    if sys.argv[1:] == ["clean"]:
        shutil.rmtree(DEST, ignore_errors=True)
        print(f"removed {DEST}")
        return 0
    failed = 0
    for name, url in REPOS:
        failed += 0 if clone(name, url) == 0 else 1
    if failed:
        print(f"{failed} clone(s) failed", file=sys.stderr)
        return 1
    print(f"cloned into {DEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
