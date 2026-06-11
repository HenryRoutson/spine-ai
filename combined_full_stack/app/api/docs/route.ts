import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { pdfBytesToText } from "@/lib/server/pdf_to_text";
import { savePdfBytes } from "@/lib/server/store";
import type { DocLabel, InputType } from "@/lib/server/types";

// AI : real upload path — replaces the frontend's pseudo-hash addDoc(name+size).
// AI : PDFs are parsed to text at ingest (like seed docs); everything else is stored verbatim.
const EXT_TYPE: Record<string, InputType> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  json: "json",
  txt: "text",
  md: "text",
  html: "web",
  png: "image",
  jpg: "image",
  jpeg: "image",
};

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });
  const label = (form.get("label") as DocLabel) ?? "inference";
  const type = EXT_TYPE[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "text";

  const bytes = new Uint8Array(await file.arrayBuffer());
  let content: string;
  try {
    content = type === "pdf" ? await pdfBytesToText(bytes) : new TextDecoder().decode(bytes);
  } catch (err) {
    return NextResponse.json({ error: `could not parse ${file.name}: ${(err as Error).message}` }, { status: 422 });
  }

  const store = await getStore();
  const doc = store.addDoc(file.name, type, content, label);
  if (type === "pdf") savePdfBytes(doc.id, bytes); // AI : keep the original for the PDF viewer
  await store.flush();
  return NextResponse.json(doc);
}
