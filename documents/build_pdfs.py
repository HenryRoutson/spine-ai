#!/usr/bin/env python3
"""Compile the LaTeX source documents into the PDFs the legal-evaluation demo ingests.

Each .tex in documents/latex/ is rendered to a .pdf in documents/ using tectonic
(self-contained, fetches packages on demand). Wording in the .tex mirrors the markdown
source so the rule-extraction and quote-grounding steps keep matching against the text.

    brew install tectonic   # one-time
    python3 build_pdfs.py [file.tex ...]   # defaults to every .tex in latex/
"""

from pathlib import Path
import subprocess
import sys

TexPath = Path  # AI : a LaTeX source under latex/
PdfPath = Path  # AI : the compiled PDF written to documents/

HERE = Path(__file__).parent
LATEX_DIR = HERE / "latex"


def build(tex: TexPath, out_dir: PdfPath) -> PdfPath:
    # AI : --outdir lands the .pdf (and aux files) in documents/; tectonic is non-interactive
    subprocess.run(
        ["tectonic", "--chatter", "minimal", "--outdir", str(out_dir), str(tex)],
        check=True,
    )
    return out_dir / tex.with_suffix(".pdf").name


def main() -> None:
    targets = [Path(a) for a in sys.argv[1:]] or sorted(LATEX_DIR.glob("*.tex"))
    if not targets:
        sys.exit(f"no .tex files found in {LATEX_DIR}")
    for tex in targets:
        pdf = build(tex, HERE)
        print(f"{pdf}  ({pdf.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
