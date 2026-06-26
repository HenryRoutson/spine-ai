import { readFileSync } from "node:fs";

type PdfText = string;

// AI : pdfjs expects browser globals — @napi-rs/canvas supplies them for Node/Vercel.
async function loadPdfParse() {
  const { DOMMatrix, Image, ImageData, Path2D } = await import("@napi-rs/canvas");
  Object.assign(globalThis, { DOMMatrix, Image, ImageData, Path2D });
  await import("pdf-parse/worker");
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  return { PDFParse, CanvasFactory };
}

// AI : prebuilt "document to text" — default JS PDF reader (demo only feeds PDFs).
// AI : the pitch's DeepSeek OCR path is a TODO placeholder (see docToTextOcrPlaceholder).
// AI : bytes variant added for the /api/docs upload route (no temp file needed).
export async function pdfBytesToText(bytes: Uint8Array): Promise<PdfText> {
  const { PDFParse, CanvasFactory } = await loadPdfParse();
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

export async function pdfToText(path: string): Promise<PdfText> {
  return pdfBytesToText(new Uint8Array(readFileSync(path)));
}

// AI : DeepSeek OCR placeholder — use doc-to-text step with docParseMode "llm" instead.
export async function docToTextOcrPlaceholder(path: string): Promise<PdfText> {
  return pdfToText(path);
}
