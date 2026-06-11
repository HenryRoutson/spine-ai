import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import { savePdfBytes } from "@/lib/server/store";
import { logger } from "@/lib/server/server_logger";
import type { DocLabel, InputType } from "@/lib/server/types";

const apiLog = logger("api:docs");

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
  if (!(file instanceof File)) {
    apiLog.warn(`POST /api/docs — missing file`);
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  const label = (form.get("label") as DocLabel) ?? "inference";
  const type = EXT_TYPE[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "text";
  apiLog.info(`POST /api/docs upload`, { name: file.name, type, label, sizeKb: Math.round(file.size / 1024) });

  const bytes = new Uint8Array(await file.arrayBuffer());
  let content: string;
  try {
    if (type === "pdf") {
      apiLog.debug(`parsing PDF`, { name: file.name });
      const { pdfBytesToText } = await import("@/lib/server/pdf_to_text");
      content = await pdfBytesToText(bytes);
      apiLog.info(`PDF parsed`, { name: file.name, chars: content.length });
    } else {
      content = new TextDecoder().decode(bytes);
    }
  } catch (err) {
    apiLog.error(`doc parse failed`, { name: file.name, error: (err as Error).message });
    return NextResponse.json({ error: `could not parse ${file.name}: ${(err as Error).message}` }, { status: 422 });
  }

  const store = await getStore();
  const doc = store.addDoc(file.name, type, content, label);
  if (type === "pdf") savePdfBytes(doc.id, bytes); // AI : keep the original for the PDF viewer
  await store.flush();
  apiLog.info(`doc saved`, { docId: doc.id, name: file.name, label });
  return NextResponse.json(doc);
}
