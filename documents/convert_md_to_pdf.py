#!/usr/bin/env python3
"""Convert a Markdown file to a PDF for the legal-evaluation demo's document_to_text step.

The PDF is the artefact the pipeline ingests (demo only uses PDFs), so the priority is
clean, extractable text that preserves the original phrasing for quote grounding.

Usage:
    python3 convert_md_to_pdf.py [input.md] [output.pdf]
Defaults to legal_doc_text.md -> legal_doc_text.pdf next to this script.
"""

from pathlib import Path
import sys

import markdown
from xhtml2pdf import pisa # type:ignore

MdPath = Path  # AI : the source markdown file
PdfPath = Path  # AI : the rendered PDF target

# AI : print-friendly styling; serif + generous spacing keeps extracted text well separated
STYLE = """
@page { size: A4; margin: 2.2cm; }
body { font-family: Times, serif; font-size: 11pt; line-height: 1.5; color: #111; }
h1 { font-size: 18pt; }
h2 { font-size: 13pt; margin-top: 16pt; }
p { margin: 6pt 0; text-align: justify; }
"""


def md_to_pdf(src: MdPath, dst: PdfPath) -> PdfPath:
    body = markdown.markdown(src.read_text(encoding="utf-8"), extensions=["extra"])
    html = f"<html><head><style>{STYLE}</style></head><body>{body}</body></html>"
    with dst.open("wb") as f:
        # AI : pisa returns an err object truthy only on failure
        if pisa.CreatePDF(html, dest=f).err: # type:ignore
            raise RuntimeError(f"failed to render {dst}")
    return dst


def main() -> None:
    here = Path(__file__).parent
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "legal_doc_text.md"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".pdf")
    print(f"{md_to_pdf(src, dst)}  ({dst.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
