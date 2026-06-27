// AI : one-shot — drop per-project SourceDocument models; point I/O at shared Document (m_builtin_document).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUILTIN_DOCUMENT_ID } from "../lib/server/builtin_models";
import { loadProjectSeed, SEEDS_DIR } from "../lib/server/seed";

const DOC_ID = BUILTIN_DOCUMENT_ID;
const LEGACY_DOC_IDS = new Set(["m_doc", "m_src"]);

const DOC_FIELD_NAMES = [
  "bank_statement",
  "expense_report",
  "form_1099",
  "delivery_note",
  "vendor_invoice",
  "journal_entries",
  "mapping",
  "user_report",
  "app_logs",
];

function migrateCode(str: string): string {
  let s = str.replace(/SourceDocument/g, "Document");
  s = s.replace(/\b(doc|d)\.body\b/g, "$1.content");
  for (const f of DOC_FIELD_NAMES) {
    s = s.replace(new RegExp(`\\b${f}\\.body\\b`, "g"), `${f}.content`);
  }
  s = s.replace(
    /marking_schema: \{ doc_id: "marking_schema", purpose: "derived rubric", body: JSON\.stringify\(schema\) \}/,
    'marking_schema: { filename: "marking_schema.json", content: JSON.stringify(schema) }',
  );
  s = s.replace(
    /\(\{ doc_id: s\.doc_id \?\? "", purpose: s\.purpose \?\? "student", body: s\.body \?\? "" \}\)/,
    '({ filename: s.filename ?? "student.md", content: s.content ?? "" })',
  );
  s = s.replace(/typeof ms\?\.body === "string"/g, 'typeof ms?.content === "string"');
  s = s.replace(/JSON\.parse\(ms\.body\)/g, "JSON.parse(ms.content)");
  s = s.replace(/const body = sub\.body \?\? ""/g, 'const content = sub.content ?? ""');
  s = s.replace(/\(body\.match/g, "(content.match");
  s = s.replace(/sub\.purpose\?\.replace/g, "sub.filename?.replace");
  return s;
}

function replaceId(value: unknown, removed: Set<string>): unknown {
  if (typeof value === "string") {
    if (LEGACY_DOC_IDS.has(value) || removed.has(value)) return DOC_ID;
    if (value.includes("SourceDocument") || value.includes(".body")) return migrateCode(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => replaceId(v, removed));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceId(v, removed);
    return out;
  }
  return value;
}

for (const file of readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"))) {
  const path = join(SEEDS_DIR, file);
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    models: { id: string; name: string }[];
  };
  const removed = new Set(
    raw.models.filter((m) => m.name === "SourceDocument").map((m) => m.id),
  );
  raw.models = raw.models.filter((m) => m.name !== "SourceDocument");
  const migrated = replaceId(raw, removed) as typeof raw;
  writeFileSync(path, `${JSON.stringify(migrated, null, 2)}\n`);
  loadProjectSeed(path);
  console.log(`migrated ${file}`);
}
