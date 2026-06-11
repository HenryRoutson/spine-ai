import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

type PdfText = string;

// AI : prebuilt "document to text" — default JS PDF reader (demo only feeds PDFs).
// AI : the pitch's DeepSeek OCR path is a TODO placeholder (see docToTextOcrPlaceholder).
// AI : bytes variant added for the /api/docs upload route (no temp file needed).
export async function pdfBytesToText(bytes: Uint8Array): Promise<PdfText> {
  const parser = new PDFParse({ data: bytes });
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

// AI : TODO placeholder — DeepSeek OCR option for scanned docs. Falls back to the JS reader.
export async function docToTextOcrPlaceholder(path: string): Promise<PdfText> {
  return pdfToText(path);
}
