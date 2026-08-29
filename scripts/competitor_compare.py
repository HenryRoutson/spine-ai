#!/usr/bin/env python3
# AI : same-prompt comparison for Lovable, Replit, and Base44.
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from competitor_compare.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
