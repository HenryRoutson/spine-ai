// AI : Typed n8n-style pieces — schema + auto UI + shareable JSON. No live Slack/Gmail.
// AI : Execution is local n8n Code-node JS (lib/n8n-run.ts), not n8n Cloud.
// AI : TODO (n8n-sidecar-S4-ui) — catalog stays transform-only; live apps are workflows on n8n, not new pieces here.

export const DEFAULT_N8N_TIMEOUT_MS = 60_000

export type n8n_node_type_string = string
export type piece_id_string = string

export type PiecePropType = "string" | "number" | "boolean" | "json" | "select"

export type PieceProp = {
  name: string
  displayName: string
  type: PiecePropType
  description?: string
  required?: boolean
  default?: unknown
  options?: { value: string; label: string }[]
}

export type ShareablePiece = {
  id: piece_id_string
  n8nNodeType: n8n_node_type_string
  displayName: string
  description: string
  category: string
  props: PieceProp[]
  n8nCode: string
}

export type N8nNodeCatalogEntry = ShareablePiece & {
  version: number
}

export function piecePropDefaults(piece: ShareablePiece): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const p of piece.props) {
    if (p.default !== undefined) out[p.name] = p.default
  }
  return out
}

function piece(
  n8nNodeType: n8n_node_type_string,
  displayName: string,
  description: string,
  category: string,
  props: PieceProp[],
  n8nCode: string,
): N8nNodeCatalogEntry {
  return {
    id: n8nNodeType,
    n8nNodeType,
    displayName,
    description,
    category,
    version: 1,
    props,
    n8nCode: n8nCode.trim(),
  }
}

// AI : n8n Code-node JS — items = [{ json }]; return items. Spine types wrap this.
const BUNDLED: N8nNodeCatalogEntry[] = [
  piece(
    "n8n-nodes-base.set",
    "Set fields",
    "Copy or rename fields on each item — typed Set node (no HTTP).",
    "core",
    [
      {
        name: "keepOnlySet",
        displayName: "Keep only set fields",
        type: "boolean",
        default: false,
        description: "Drop fields that are not in assignments",
      },
      {
        name: "assignments",
        displayName: "Assignments",
        type: "json",
        required: true,
        default: { name: "={{ $json.name }}" },
        description: "Map output field → source field or literal",
      },
    ],
    `const keepOnlySet = Boolean($parameter.keepOnlySet);
const assignments = $parameter.assignments && typeof $parameter.assignments === "object" ? $parameter.assignments : {};
return items.map((item) => {
  const src = item.json && typeof item.json === "object" ? item.json : {};
  const next = keepOnlySet ? {} : { ...src };
  for (const [key, raw] of Object.entries(assignments)) {
    const expr = String(raw ?? "").replace(/^=/, "");
    const m = expr.match(/^\\{\\{\\s*\\$json\\.([A-Za-z0-9_]+)\\s*\\}\\}$/);
    next[key] = m ? src[m[1]] : expr;
  }
  return { json: next };
});`,
  ),
  piece(
    "n8n-nodes-base.filter",
    "Filter",
    "Keep items where a field matches an operator — typed Filter node.",
    "core",
    [
      { name: "field", displayName: "Field", type: "string", required: true, default: "status" },
      {
        name: "operator",
        displayName: "Operator",
        type: "select",
        default: "equals",
        options: [
          { value: "equals", label: "equals" },
          { value: "notEquals", label: "not equals" },
          { value: "contains", label: "contains" },
          { value: "exists", label: "exists" },
        ],
      },
      { name: "value", displayName: "Value", type: "string", default: "" },
    ],
    `const field = String($parameter.field ?? "");
const op = String($parameter.operator ?? "equals");
const want = String($parameter.value ?? "");
return items.filter((item) => {
  const got = item.json?.[field];
  if (op === "exists") return got != null && got !== "";
  const text = String(got ?? "");
  if (op === "contains") return text.includes(want);
  if (op === "notEquals") return text !== want;
  return text === want;
});`,
  ),
  piece(
    "n8n-nodes-base.sort",
    "Sort",
    "Sort a list of items by a field.",
    "core",
    [
      { name: "field", displayName: "Field", type: "string", required: true, default: "name" },
      {
        name: "direction",
        displayName: "Direction",
        type: "select",
        default: "asc",
        options: [
          { value: "asc", label: "ascending" },
          { value: "desc", label: "descending" },
        ],
      },
    ],
    `const field = String($parameter.field ?? "");
const dir = String($parameter.direction ?? "asc") === "desc" ? -1 : 1;
return [...items].sort((a, b) => {
  const av = String(a.json?.[field] ?? "");
  const bv = String(b.json?.[field] ?? "");
  return av < bv ? -dir : av > bv ? dir : 0;
});`,
  ),
  piece(
    "n8n-nodes-base.limit",
    "Limit",
    "Keep the first N items.",
    "core",
    [{ name: "maxItems", displayName: "Max items", type: "number", required: true, default: 10 }],
    `const n = Number($parameter.maxItems ?? 10);
return items.slice(0, Number.isFinite(n) && n > 0 ? n : 10);`,
  ),
  piece(
    "n8n-nodes-base.removeDuplicates",
    "Remove duplicates",
    "Drop items that share a key field.",
    "core",
    [{ name: "field", displayName: "Key field", type: "string", required: true, default: "id" }],
    `const field = String($parameter.field ?? "id");
const seen = new Set();
return items.filter((item) => {
  const key = String(item.json?.[field] ?? "");
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});`,
  ),
  piece(
    "n8n-nodes-base.itemLists",
    "Split out field",
    "Turn a list field on one object into one item per element (n8n Item Lists).",
    "core",
    [{ name: "fieldToSplitOut", displayName: "Field to split out", type: "string", required: true, default: "items" }],
    `const field = String($parameter.fieldToSplitOut ?? "items");
const out = [];
for (const item of items) {
  const list = item.json?.[field];
  if (!Array.isArray(list) || !list.length) {
    out.push(item);
    continue;
  }
  for (const row of list) {
    const json = row && typeof row === "object" && !Array.isArray(row) ? { ...item.json, ...row } : { ...item.json, [field]: row };
    delete json[field];
    out.push({ json });
  }
}
return out;`,
  ),
  piece(
    "n8n-nodes-base.crypto",
    "Hash field",
    "Add a deterministic hash of a field (local, not a vendor API).",
    "transform",
    [
      { name: "field", displayName: "Field", type: "string", required: true, default: "email" },
      { name: "outputField", displayName: "Output field", type: "string", required: true, default: "hash" },
    ],
    `function djb2(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) + text.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}
const field = String($parameter.field ?? "email");
const outField = String($parameter.outputField ?? "hash");
return items.map((item) => ({
  json: { ...item.json, [outField]: djb2(String(item.json?.[field] ?? "")) },
}));`,
  ),
  piece(
    "n8n-nodes-base.dateTime",
    "Date & time",
    "Copy a date field into an ISO-ish string on each item.",
    "transform",
    [
      { name: "field", displayName: "Date field", type: "string", required: true, default: "created_at" },
      { name: "outputField", displayName: "Output field", type: "string", required: true, default: "iso" },
    ],
    `const field = String($parameter.field ?? "created_at");
const outField = String($parameter.outputField ?? "iso");
return items.map((item) => {
  const raw = item.json?.[field];
  const d = new Date(String(raw ?? ""));
  const iso = Number.isNaN(d.getTime()) ? String(raw ?? "") : d.toISOString();
  return { json: { ...item.json, [outField]: iso } };
});`,
  ),
  piece(
    "n8n-nodes-base.html",
    "HTML extract",
    "Strip tags from an HTML field into plain text.",
    "transform",
    [
      { name: "field", displayName: "HTML field", type: "string", required: true, default: "html" },
      { name: "outputField", displayName: "Output field", type: "string", required: true, default: "text" },
    ],
    `const field = String($parameter.field ?? "html");
const outField = String($parameter.outputField ?? "text");
return items.map((item) => {
  const html = String(item.json?.[field] ?? "");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
  return { json: { ...item.json, [outField]: text } };
});`,
  ),
  piece(
    "n8n-nodes-base.markdown",
    "Markdown",
    "Wrap a text field as a markdown heading block (local, not a renderer API).",
    "transform",
    [
      { name: "field", displayName: "Text field", type: "string", required: true, default: "body" },
      { name: "outputField", displayName: "Output field", type: "string", required: true, default: "markdown" },
      { name: "heading", displayName: "Heading", type: "string", default: "Note" },
    ],
    `const field = String($parameter.field ?? "body");
const outField = String($parameter.outputField ?? "markdown");
const heading = String($parameter.heading ?? "Note");
return items.map((item) => ({
  json: { ...item.json, [outField]: "## " + heading + "\\n\\n" + String(item.json?.[field] ?? "") },
}));`,
  ),
  piece(
    "n8n-nodes-base.spreadsheetFile",
    "Parse CSV",
    "Parse a CSV string field into row objects (first line = headers).",
    "files",
    [
      { name: "field", displayName: "CSV field", type: "string", required: true, default: "csv" },
      { name: "outputField", displayName: "Rows field", type: "string", required: true, default: "rows" },
    ],
    `const field = String($parameter.field ?? "csv");
const outField = String($parameter.outputField ?? "rows");
function parseCsv(text) {
  const lines = String(text ?? "").split(/\\r?\\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}
return items.map((item) => ({
  json: { ...item.json, [outField]: parseCsv(item.json?.[field]) },
}));`,
  ),
  piece(
    "n8n-nodes-base.code",
    "Code",
    "Run n8n-style JavaScript on typed items. Prefer a catalog piece when one fits.",
    "core",
    [],
    `return items;`,
  ),
]

const extraPieces: N8nNodeCatalogEntry[] = []

export function listN8nNodes(): N8nNodeCatalogEntry[] {
  const byType = new Map<string, N8nNodeCatalogEntry>()
  for (const p of [...BUNDLED, ...extraPieces]) byType.set(p.n8nNodeType, p)
  return [...byType.values()]
}

export function getN8nNode(type: string | undefined): N8nNodeCatalogEntry | undefined {
  if (!type?.trim()) return undefined
  return listN8nNodes().find((p) => p.n8nNodeType === type.trim() || p.id === type.trim() || p.displayName === type.trim())
}

export function registerSharedPiece(pieceJson: ShareablePiece): N8nNodeCatalogEntry {
  const entry: N8nNodeCatalogEntry = {
    ...pieceJson,
    n8nNodeType: pieceJson.n8nNodeType || pieceJson.id,
    id: pieceJson.id || pieceJson.n8nNodeType,
    version: 1,
    props: pieceJson.props ?? [],
    n8nCode: pieceJson.n8nCode ?? "return items;",
  }
  const idx = extraPieces.findIndex((p) => p.n8nNodeType === entry.n8nNodeType || p.id === entry.id)
  if (idx >= 0) extraPieces[idx] = entry
  else extraPieces.push(entry)
  return entry
}

export function toShareablePiece(entry: N8nNodeCatalogEntry): ShareablePiece {
  return {
    id: entry.id,
    n8nNodeType: entry.n8nNodeType,
    displayName: entry.displayName,
    description: entry.description,
    category: entry.category,
    props: entry.props,
    n8nCode: entry.n8nCode,
  }
}

export function missingN8nParams(entry: N8nNodeCatalogEntry, params: Record<string, unknown> | undefined): string[] {
  const missing: string[] = []
  for (const p of entry.props) {
    if (!p.required) continue
    const v = params?.[p.name]
    if (v == null || v === "") missing.push(p.displayName)
  }
  return missing
}
