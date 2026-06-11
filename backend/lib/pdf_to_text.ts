import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

type PdfText = string;

// AI : prebuilt "document to text" — default JS PDF reader (demo only feeds PDFs).
// AI : the pitch's DeepSeek OCR path is a TODO placeholder (see docToTextOcrPlaceholder).
export async function pdfToText(path: string): Promise<PdfText> {
  const buffer = readFileSync(path);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

// AI : TODO placeholder — DeepSeek OCR option for scanned docs. Falls back to the JS reader.
export async function docToTextOcrPlaceholder(path: string): Promise<PdfText> {
  return pdfToText(path);
}
