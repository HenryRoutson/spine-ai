// AI : one-shot generator for docs/tasks_examples.md → seeds/*.json + validates via loadProjectSeed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  customCodeMergeTableRowsFromCombined,
  customCodeParseDocBodyToParsedTable,
  customCodeParseDocToTableRows,
  MD_TABLE_PARSER_PREAMBLE,
} from "../lib/markdown_table_parse";
import { loadProjectSeed, SEEDS_DIR } from "../lib/server/seed";
import { BUILTIN_DOCUMENT_ID } from "../lib/server/builtin_models";
import { FieldType, type StructureDef, type StructureModelId } from "../lib/server/types";

const DOC_ID = BUILTIN_DOCUMENT_ID;

// AI : meta-type helpers — StructureDef is the shape used to define StructureModel entries
type StructureFieldDef = StructureDef["fields"][number];
const sid = (id: string): StructureModelId => id as StructureModelId;
const STRUCT = (def: StructureDef) => def;
// AI : seeds are hand-written JSON-ish literals — accept the enum's wire strings and brand them here.
const field = (
  id: string,
  name: string,
  type: `${FieldType}`,
  description: string,
  extra: { ref?: string; minItems?: number; deterministic?: boolean; testTolerance?: number } = {},
): StructureFieldDef => ({
  id,
  name,
  type: type as FieldType,
  optional: false,
  description,
  ...(extra.ref ? { ref: sid(extra.ref) } : {}),
  ...(extra.minItems !== undefined ? { minItems: extra.minItems } : {}),
  ...(extra.deterministic !== undefined ? { deterministic: extra.deterministic } : {}),
  ...(extra.testTolerance !== undefined ? { testTolerance: extra.testTolerance } : {}),
});

const PARSE_TABLE = customCodeParseDocBodyToParsedTable();
const PARSE_ROWS = customCodeParseDocToTableRows();

const STRATEGIES = (prefix: string) => [
  {
    id: `s_single_${prefix}`,
    kind: "single-llm",
    name: "Single LLM Call",
    enabled: true,
    model: "deepseek-v4",
    accuracy: 78,
    latencyMs: 3200,
    costCents: 8,
    passRate: 90,
  },
  {
    id: `s_agent_${prefix}`,
    kind: "claude-code",
    name: "Agent (Frontier)",
    enabled: true,
    model: "deepseek-v4",
    accuracy: 92,
    latencyMs: 28000,
    costCents: 160,
    passRate: 97,
  },
  {
    id: `s_cheap_${prefix}`,
    kind: "cheap-agent",
    name: "Agent (Cheap Model)",
    enabled: true,
    model: "deepseek-v4",
    accuracy: 82,
    latencyMs: 18000,
    costCents: 12,
    passRate: 89,
  },
];

const TABLE_ROW = {
  id: "m_row",
  name: "TableRow",
  description: "One markdown table row as JSON (parsed before LLM steps).",
  fields: [
    { id: "f_rid", name: "row_id", type: "text", optional: false, description: "Stable row id" },
    { id: "f_cells", name: "cells_json", type: "text", optional: false, description: "Row object as JSON string" },
  ],
};

const PARSED_TABLE = {
  id: "m_parsed",
  name: "ParsedTable",
  description: "Markdown table converted to JSON rows.",
  fields: [
    { id: "f_rows", name: "rows_json", type: "text", optional: false, description: "JSON array of row objects" },
    { id: "f_count", name: "row_count", type: "int", optional: false, description: "Number of data rows" },
  ],
};

const MERGED_TWO = {
  id: "m_merged2",
  name: "MergedTwoTables",
  description: "Two parsed tables as JSON strings.",
  fields: [
    { id: "f_a", name: "table_a_json", type: "json", optional: false, description: "First table JSON array" },
    { id: "f_b", name: "table_b_json", type: "json", optional: false, description: "Second table JSON array" },
  ],
};

const MERGED_THREE = {
  id: "m_merged3",
  name: "MergedThreeTables",
  description: "PO, delivery note, and invoice as JSON row arrays.",
  fields: [
    { id: "f_po", name: "po_json", type: "text", optional: false, description: "Purchase order lines" },
    { id: "f_dn", name: "delivery_json", type: "text", optional: false, description: "Delivery note lines" },
    { id: "f_inv", name: "invoice_json", type: "text", optional: false, description: "Invoice lines" },
  ],
};

const DESC = (inputDescription: string) => ({ inputDescription });

// AI : single source of truth — seeds/*.json is generated from this script, not edited by hand
const EXPENSE_POLICY_INPUT_DESC = "Markdown expense policy table listing category limits and approval rules";
const EXPENSE_REPORT_INPUT_DESC = "Submitted employee expense report as a markdown table of line items";
const OPEN_INVOICES_INPUT_DESC = "Markdown table of open accounts-payable invoices awaiting payment";
const BANK_STATEMENT_INPUT_DESC = "Bank statement markdown table of March transactions including outflows";
const W2_INPUT_DESC = "W-2 wage statement for tax year 2024 as a markdown table of box values";
const FORM_1099_INPUT_DESC = "1099-MISC supplemental income form as a markdown table";
const PO_INPUT_DESC = "Purchase order markdown table listing SKU lines, quantities, and unit prices";
const DELIVERY_NOTE_INPUT_DESC = "Delivery note markdown table showing quantities actually shipped";
const VENDOR_INVOICE_INPUT_DESC = "Vendor invoice markdown table billing SKUs, quantities, and prices";
const AUDIT_TXN_SAMPLE_INPUT_DESC = "AP transaction sample markdown table drawn for audit testing";
const AUDIT_JE_INPUT_DESC = "Journal entry excerpt markdown table with refs and amounts";
const HOMEWORK_MARKING_SCHEMA_INPUT_DESC =
  "MarkingSchema JSON — assignment_title and sections with nested RubricQuestion lists";
const STUDENT_SUBMISSIONS_INPUT_DESC =
  "One student's completed homework sheet — markdown with question prompts and student work answers";
const HOMEWORK_COMBINE_INPUT_DESC =
  "One student homework Document (new input) plus flat RubricQuestion list from Marking Questions List (pipeline state)";
const SECTION_GRADES_OUTPUT_DESC =
  "List of SectionGrade rows — student_label, section_id, score, max_score, correct, mistake_explanation (one row per student × rubric question)";
const HOMEWORK_GRADE_PROMPT =
  "Apply criteria literally and deterministically. When criteria lists alternate bands (e.g. 'award exactly N pts if…'), check those bands before summing components — pick exactly one band score, never mix. Score MUST equal the exact points from the matching band or component sum — use only point values explicitly named in criteria (no rounding, no extra credit, no in-between scores). Score is an integer from 0 to max_score inclusive. Copy max_score from input unchanged. Set correct=true iff score equals max_score; never set correct=true when score is below max_score. Copy student_label and section_id exactly from input. When correct is false, mistake_explanation must cite the rubric clause applied and state the student's wrong value vs the required value. When correct is true, mistake_explanation must be an empty string.";
const HOMEWORK_ASSEMBLE_TS =
  '(_combined, state) => { const stableJson = (v) => { if (v === null || typeof v !== "object") return JSON.stringify(v); if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]"; return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableJson(v[k])).join(",") + "}"; }; const schema = state["Marking Schema"]; const subs = state["Student Submissions"]; const list = Array.isArray(subs) ? subs : subs ? [subs] : []; const text = (s) => (typeof s?.content === "string" ? s.content : typeof s?.body === "string" ? s.body : ""); const name = (s, i) => (typeof s?.filename === "string" && s.filename ? s.filename : typeof s?.doc_id === "string" ? s.doc_id : `student_${i + 1}.md`); return { marking_schema: { filename: "marking_schema.json", content: stableJson(schema ?? {}) }, student_submissions: list.map((s, i) => ({ filename: name(s, i), content: text(s) })) }; }';
const FEEDBACK_DUMP_INPUT_DESC = "Raw product feedback dump — bullet list of user comments";
const FEEDBACK_DUMP_SPLIT_DESC = "Product feedback Document from the upload step, ready to split into bullet items";
const SLA_UPTIME_INPUT_DESC = "Vendor SLA uptime report markdown table with measured availability per service";
const BUG_REPORT_INPUT_DESC = "User-submitted bug report describing steps to reproduce and expected behavior";
const APP_LOGS_INPUT_DESC = "Application log snippet around the time of the reported failure";
const BUG_ENRICH_COMBINED_INPUT_DESC = "Combined bug input — user_report document plus app_logs log excerpt";

const parseTableRowsDesc = (tableTopic: string) => `TableRow list parsed from the ${tableTopic} markdown table`;
const parseTableDesc = (tableTopic: string) => `ParsedTable parsed from the ${tableTopic} markdown table`;

const parseStep = (
  id: string,
  label: string,
  inId: string,
  outId: string,
  code: string,
  list: boolean,
  inputDescription: string,
) => ({
  id,
  kind: "custom-code",
  label,
  note: "Markdown table → CSV-style cells → JSON rows (no raw markdown to LLM).",
  inputDescription,
  inStructureId: inId,
  outStructureId: outId,
  ...(list ? { outType: { kind: "list", item: { kind: "ref", modelId: outId } } } : {}),
  cached: true,
  avgMs: 8,
  avgCostCents: 0,
  fallbackList: [{ typescript: code }],
});

const seeds: Record<string, unknown> = {
  expense_auditor: {
    id: "p_expense_audit",
    name: "Expense Report Auditor",
    kind: "finance-compliance",
    models: [
      TABLE_ROW,
      {
        id: "m_combined",
        name: "AuditInput",
        description: "Auto-generated by the Combine Inputs step.",
        auto: true,
        fields: [
          { id: "f_report", name: "expense_report", type: "document", optional: false, description: "Submitted expense report" },
          { id: "f_policy", name: "policy_rows", type: "list[model]", optional: false, description: "Parsed policy limits", ref: "m_row" },
        ],
      },
      MERGED_TWO,
      {
        id: "m_flag",
        name: "ComplianceFlag",
        description: "One flagged or cleared expense line.",
        fields: [
          { id: "f_line", name: "line_id", type: "text", optional: false, description: "Expense line id" },
          { id: "f_cat", name: "category", type: "text", optional: false, description: "Expense category" },
          { id: "f_amt", name: "amount_usd", type: "float", optional: false, description: "Line amount" },
          { id: "f_ok", name: "compliant", type: "bool", optional: false, description: "Within policy" },
          { id: "f_issue", name: "issue", type: "text", optional: true, description: "Violation description if non-compliant" },
        ],
      },
    ],
    modules: [
      { id: "mod_in_policy", kind: "input", label: "Expense Policy", inputType: "text", inputNameContains: "expense_policy", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(EXPENSE_POLICY_INPUT_DESC) },
      parseStep("mod_parse_policy", "Parse Policy Table", DOC_ID, "m_row", PARSE_ROWS, true, parseTableRowsDesc("expense policy")),
      { id: "mod_in_report", kind: "input", label: "Expense Report", inputType: "text", inputNameContains: "expense_report", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(EXPENSE_REPORT_INPUT_DESC) },
      { id: "mod_combine", kind: "combine", label: "Combine Inputs", inStructureId: "m_row", outStructureId: "m_combined", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Parsed policy rows from the first input, ready to merge with the expense report document") },
      parseStep(
        "mod_merge",
        "Merge Parsed Tables",
        "m_combined",
        "m_merged2",
        customCodeMergeTableRowsFromCombined("policy_rows", "expense_report", "table_a_json", "table_b_json"),
        false,
        "Combined audit input bundling parsed policy rows with the expense report document",
      ),
      {
        id: "mod_audit",
        kind: "llm",
        label: "Audit Lines",
        inStructureId: "m_merged2",
        outStructureId: "m_flag",
                inputDescription: "Merged JSON tables — policy limits in table_a_json and expense lines in table_b_json",
        prompt:
          "table_a_json is the travel policy limits (JSON array). table_b_json is submitted expenses (JSON array). For EACH expense row, output one ComplianceFlag: line_id from the row index, category and amount_usd from the row, compliant verdict vs policy limits, and issue text if non-compliant.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 2800,
        avgCostCents: 9,
      },
      { id: "mod_out", kind: "output", label: "Compliance Flags", inStructureId: "m_flag", outStructureId: "m_flag", outType: { kind: "list", item: { kind: "ref", modelId: "m_flag" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of ComplianceFlag records — one per audited expense line") },
    ],
    strategies: STRATEGIES("expense"),
    docs: [
      { name: "acme_expense_policy.md", type: "text", label: "inference", file: "expense_auditor/expense_policy.md" },
      { name: "jordan_lee_expense_report.md", type: "text", label: "inference", file: "expense_auditor/expense_report.md" },
    ],
  },

  bank_reconciler: {
    id: "p_bank_reconcile",
    name: "Bank Statement Reconciler",
    kind: "finance-ops",
    models: [
      TABLE_ROW,
      {
        id: "m_combined",
        name: "ReconcileInput",
        auto: true,
        description: "Bank statement document + parsed open invoices.",
        fields: [
          { id: "f_stmt", name: "bank_statement", type: "document", optional: false, description: "Bank statement" },
          { id: "f_inv", name: "invoice_rows", type: "list[model]", optional: false, description: "Parsed invoices", ref: "m_row" },
        ],
      },
      MERGED_TWO,
      {
        id: "m_match",
        name: "ReconcileLine",
        description: "One bank transaction match result.",
        fields: [
          { id: "f_desc", name: "description", type: "text", optional: false, description: "Bank line description" },
          { id: "f_amt", name: "amount_usd", type: "float", optional: false, description: "Transaction amount" },
          { id: "f_matched", name: "matched", type: "bool", optional: false, description: "Matched to an invoice" },
          { id: "f_inv", name: "invoice_ref", type: "text", optional: true, description: "Matched invoice id" },
          { id: "f_note", name: "explanation", type: "text", optional: false, description: "Match rationale or why unmatched" },
        ],
      },
    ],
    modules: [
      { id: "mod_in_inv", kind: "input", label: "Open Invoices", inputType: "text", inputNameContains: "open_invoices", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(OPEN_INVOICES_INPUT_DESC) },
      parseStep("mod_parse_inv", "Parse Invoice Table", DOC_ID, "m_row", PARSE_ROWS, true, parseTableRowsDesc("open accounts-payable invoice")),
      { id: "mod_in_stmt", kind: "input", label: "Bank Statement", inputType: "text", inputNameContains: "bank_statement", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(BANK_STATEMENT_INPUT_DESC) },
      { id: "mod_combine", kind: "combine", label: "Combine Inputs", inStructureId: "m_row", outStructureId: "m_combined", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Parsed invoice rows from the first input, ready to merge with the bank statement") },
      parseStep(
        "mod_merge",
        "Merge Tables",
        "m_combined",
        "m_merged2",
        customCodeMergeTableRowsFromCombined("invoice_rows", "bank_statement", "table_b_json", "table_a_json"),
        false,
        "Combined reconcile input — parsed invoice rows plus bank statement document",
      ),
      {
        id: "mod_recon",
        kind: "llm",
        label: "Match Transactions",
        inStructureId: "m_merged2",
        outStructureId: "m_match",
                inputDescription: "Merged JSON — bank statement rows in table_a_json and open invoices in table_b_json",
        prompt:
          "table_a_json is bank statement rows; table_b_json is open invoices. For each bank outflow (negative amount), output one ReconcileLine with matched=true if an invoice explains it, else matched=false with explanation.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 3000,
        avgCostCents: 10,
      },
      { id: "mod_out", kind: "output", label: "Reconciliation", inStructureId: "m_match", outStructureId: "m_match", outType: { kind: "list", item: { kind: "ref", modelId: "m_match" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of ReconcileLine records — one match verdict per bank outflow") },
    ],
    strategies: STRATEGIES("bank"),
    docs: [
      { name: "march_bank_statement.md", type: "text", label: "inference", file: "bank_reconciler/bank_statement.md" },
      { name: "open_invoices.md", type: "text", label: "inference", file: "bank_reconciler/open_invoices.md" },
    ],
  },

  tax_workpaper: {
    id: "p_tax_workpaper",
    name: "Tax Workpaper Preparer",
    kind: "tax-prep",
    models: [
      TABLE_ROW,
      {
        id: "m_combined",
        name: "TaxFormInput",
        auto: true,
        description: "W-2 parsed rows + 1099 document.",
        fields: [
          { id: "f_misc", name: "form_1099", type: "document", optional: false, description: "1099-MISC document" },
          { id: "f_w2", name: "w2_rows", type: "list[model]", optional: false, description: "Parsed W-2 boxes", ref: "m_row" },
        ],
      },
      MERGED_TWO,
      {
        id: "m_field",
        name: "WorkpaperField",
        description: "One sourced field on the client workpaper.",
        fields: [
          { id: "f_name", name: "field_name", type: "text", optional: false, description: "Workpaper field label" },
          { id: "f_val", name: "value", type: "text", optional: false, description: "Normalized value" },
          { id: "f_src", name: "source_form", type: "text", optional: false, description: "W-2 or 1099" },
          { id: "f_box", name: "source_box", type: "text", optional: true, description: "Form box or field" },
        ],
      },
    ],
    modules: [
      { id: "mod_in_w2", kind: "input", label: "W-2", inputType: "text", inputNameContains: "w2_2024", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(W2_INPUT_DESC) },
      parseStep("mod_parse_w2", "Parse W-2 Table", DOC_ID, "m_row", PARSE_ROWS, true, parseTableRowsDesc("W-2 wage statement")),
      { id: "mod_in_1099", kind: "input", label: "1099-MISC", inputType: "text", inputNameContains: "1099", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(FORM_1099_INPUT_DESC) },
      { id: "mod_combine", kind: "combine", label: "Combine Inputs", inStructureId: "m_row", outStructureId: "m_combined", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Parsed W-2 box rows from the first input, ready to merge with the 1099 document") },
      parseStep(
        "mod_merge",
        "Merge Form Tables",
        "m_combined",
        "m_merged2",
        customCodeMergeTableRowsFromCombined("w2_rows", "form_1099", "table_a_json", "table_b_json"),
        false,
        "Combined tax input — W-2 row JSON in table_a_json and 1099 fields in table_b_json",
      ),
      {
        id: "mod_workpaper",
        kind: "llm",
        label: "Populate Workpaper",
        inStructureId: "m_merged2",
        outStructureId: "m_field",
                inputDescription: "Merged form tables — parsed W-2 rows and 1099 field rows as JSON arrays",
        prompt:
          "table_a_json is parsed W-2 box rows; table_b_json is parsed 1099 field rows. Emit standardized WorkpaperField entries for wages, federal withholding, 401(k), state tax, and 1099 other income — each with source_form and source_box.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 2600,
        avgCostCents: 8,
      },
      { id: "mod_out", kind: "output", label: "Client Workpaper", inStructureId: "m_field", outStructureId: "m_field", outType: { kind: "list", item: { kind: "ref", modelId: "m_field" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of WorkpaperField entries sourced from W-2 and 1099 forms") },
    ],
    strategies: STRATEGIES("tax"),
    docs: [
      { name: "alex_morgan_w2_2024.md", type: "text", label: "inference", file: "tax_workpaper/w2_2024.md" },
      { name: "alex_morgan_1099_misc.md", type: "text", label: "inference", file: "tax_workpaper/form_1099_misc.md" },
    ],
  },

  procurement_match: {
    id: "p_procurement_match",
    name: "Procurement Three-Way Match",
    kind: "procurement",
    models: [
      TABLE_ROW,
      {
        id: "m_po_dn",
        name: "PoDeliveryInput",
        auto: true,
        description: "PO rows + delivery note document.",
        fields: [
          { id: "f_dn", name: "delivery_note", type: "document", optional: false, description: "Delivery note" },
          { id: "f_po", name: "po_rows", type: "list[model]", optional: false, description: "Parsed PO lines", ref: "m_row" },
        ],
      },
      {
        id: "m_dual",
        name: "PoDeliveryJson",
        description: "PO and delivery tables as JSON.",
        fields: [
          { id: "f_po", name: "po_json", type: "text", optional: false, description: "PO lines JSON" },
          { id: "f_dn", name: "delivery_json", type: "text", optional: false, description: "Delivery lines JSON" },
        ],
      },
      {
        id: "m_inv_in",
        name: "InvoiceBundleInput",
        auto: true,
        description: "Invoice document + PO/DN JSON bundle.",
        fields: [
          { id: "f_inv", name: "vendor_invoice", type: "document", optional: false, description: "Vendor invoice" },
          { id: "f_prior", name: "po_and_delivery", type: "model", optional: false, description: "Parsed PO and DN", ref: "m_dual" },
        ],
      },
      MERGED_THREE,
      {
        id: "m_line",
        name: "MatchLine",
        description: "Three-way match result for one SKU line.",
        fields: [
          { id: "f_sku", name: "sku", type: "text", optional: false, description: "Line SKU" },
          { id: "f_status", name: "match_status", type: "text", optional: false, description: "match | mismatch | partial" },
          { id: "f_detail", name: "detail", type: "text", optional: false, description: "Cited qty/price differences" },
        ],
      },
    ],
    modules: [
      { id: "mod_in_po", kind: "input", label: "Purchase Order", inputType: "text", inputNameContains: "purchase_order", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(PO_INPUT_DESC) },
      parseStep("mod_parse_po", "Parse PO Table", DOC_ID, "m_row", PARSE_ROWS, true, parseTableRowsDesc("purchase order")),
      { id: "mod_in_dn", kind: "input", label: "Delivery Note", inputType: "text", inputNameContains: "delivery_note", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(DELIVERY_NOTE_INPUT_DESC) },
      { id: "mod_combine_dn", kind: "combine", label: "Attach Delivery Note", inStructureId: "m_row", outStructureId: "m_po_dn", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Parsed PO rows from the first input, ready to merge with the delivery note document") },
      parseStep(
        "mod_merge_po_dn",
        "Parse PO + DN",
        "m_po_dn",
        "m_dual",
        `${MD_TABLE_PARSER_PREAMBLE}(c)=>({po_json:JSON.stringify(c.po_rows.map(r=>JSON.parse(r.cells_json))),delivery_json:JSON.stringify(mdFirstTableRows(c.delivery_note.content))})`,
        false,
        "Combined PO and delivery note — parsed PO rows plus delivery note document",
      ),
      { id: "mod_in_inv", kind: "input", label: "Vendor Invoice", inputType: "text", inputNameContains: "vendor_invoice", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(VENDOR_INVOICE_INPUT_DESC) },
      { id: "mod_combine_inv", kind: "combine", label: "Attach Invoice", inStructureId: "m_dual", outStructureId: "m_inv_in", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Parsed PO and delivery JSON bundle, ready to merge with the vendor invoice") },
      parseStep(
        "mod_merge_all",
        "Parse Invoice + Bundle",
        "m_inv_in",
        "m_merged3",
        `${MD_TABLE_PARSER_PREAMBLE}(c)=>({po_json:c.po_and_delivery.po_json,delivery_json:c.po_and_delivery.delivery_json,invoice_json:JSON.stringify(mdFirstTableRows(c.vendor_invoice.content))})`,
        false,
        "Combined procurement bundle — PO/DN JSON plus vendor invoice document",
      ),
      {
        id: "mod_match",
        kind: "llm",
        label: "Three-Way Match",
        inStructureId: "m_merged3",
        outStructureId: "m_line",
                inputDescription: "Merged JSON — purchase order, delivery note, and vendor invoice row arrays",
        prompt:
          "Compare po_json, delivery_json, and invoice_json row arrays. For each SKU present in any document, output one MatchLine with match_status and detail citing quantity or price mismatches (e.g. short-shipped SEAL-88 billed on invoice).",
        model: "deepseek-v4",
        cached: true,
        avgMs: 3200,
        avgCostCents: 11,
      },
      { id: "mod_out", kind: "output", label: "Match Report", inStructureId: "m_line", outStructureId: "m_line", outType: { kind: "list", item: { kind: "ref", modelId: "m_line" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of MatchLine records — one three-way match verdict per SKU") },
    ],
    strategies: STRATEGIES("proc"),
    docs: [
      { name: "acme_purchase_order_po77821.md", type: "text", label: "inference", file: "procurement_match/purchase_order.md" },
      { name: "acme_delivery_note_dn99214.md", type: "text", label: "inference", file: "procurement_match/delivery_note.md" },
      { name: "acme_vendor_invoice_inv44102.md", type: "text", label: "inference", file: "procurement_match/vendor_invoice.md" },
    ],
  },

  audit_sampler: {
    id: "p_audit_sampler",
    name: "Audit Sample Tester",
    kind: "audit",
    models: [
      TABLE_ROW,
      {
        id: "m_combined",
        name: "AuditSampleInput",
        auto: true,
        description: "Transaction sample + journal entries.",
        fields: [
          { id: "f_je", name: "journal_entries", type: "document", optional: false, description: "Journal entry excerpt" },
          { id: "f_txn", name: "transaction_rows", type: "list[model]", optional: false, description: "Parsed AP transactions", ref: "m_row" },
        ],
      },
      MERGED_TWO,
      {
        id: "m_sample",
        name: "SampleVerdict",
        description: "Audit test result for one sampled transaction.",
        fields: [
          { id: "f_txn", name: "txn_id", type: "text", optional: false, description: "Transaction id" },
          { id: "f_doc", name: "supporting_doc_ok", type: "bool", optional: false, description: "Invoice or receipt on file" },
          { id: "f_je", name: "je_tie_ok", type: "bool", optional: false, description: "Ties to journal entry" },
          { id: "f_note", name: "finding", type: "text", optional: false, description: "Auditor note" },
        ],
      },
    ],
    modules: [
      { id: "mod_in_txn", kind: "input", label: "Transaction Sample", inputType: "text", inputNameContains: "transaction_sample", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(AUDIT_TXN_SAMPLE_INPUT_DESC) },
      parseStep("mod_parse_txn", "Parse Transaction Table", DOC_ID, "m_row", PARSE_ROWS, true, parseTableRowsDesc("AP transaction sample")),
      { id: "mod_in_je", kind: "input", label: "Journal Entries", inputType: "text", inputNameContains: "journal_entries", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(AUDIT_JE_INPUT_DESC) },
      { id: "mod_combine", kind: "combine", label: "Combine Inputs", inStructureId: "m_row", outStructureId: "m_combined", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Parsed transaction rows from the first input, ready to merge with journal entries") },
      parseStep(
        "mod_merge",
        "Merge Audit Tables",
        "m_combined",
        "m_merged2",
        customCodeMergeTableRowsFromCombined("transaction_rows", "journal_entries", "table_a_json", "table_b_json"),
        false,
        "Combined audit input — transaction row JSON in table_a_json and journal entry document",
      ),
      {
        id: "mod_test",
        kind: "llm",
        label: "Test Sample",
        inStructureId: "m_merged2",
        outStructureId: "m_sample",
                inputDescription: "Merged JSON — AP transactions in table_a_json and journal entries in table_b_json",
        prompt:
          "table_a_json lists AP transactions; table_b_json lists journal entries. For each transaction in table_a_json, output one SampleVerdict: whether supporting docs exist (per txn notes), whether JE ref ties and amounts match, and a brief finding.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 3000,
        avgCostCents: 10,
      },
      { id: "mod_out", kind: "output", label: "Sample Results", inStructureId: "m_sample", outStructureId: "m_sample", outType: { kind: "list", item: { kind: "ref", modelId: "m_sample" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of SampleVerdict records — one audit test result per sampled transaction") },
    ],
    strategies: STRATEGIES("audit"),
    docs: [
      { name: "ap_transaction_sample_q1.md", type: "text", label: "inference", file: "audit_sampler/transaction_sample.md" },
      { name: "journal_entries_excerpt.md", type: "text", label: "inference", file: "audit_sampler/journal_entries.md" },
    ],
  },

  homework_grader: {
    id: "p_homework_grader",
    name: "Homework Grader",
    kind: "education",
    models: [
      STRUCT({
        id: sid("m_rubric_q"),
        name: "RubricQuestion",
        description: "One question in the marking schema.",
        fields: [
          field("f_qid", "question_id", "text", "Stable question id"),
          field("f_prompt", "prompt", "text", "Question text"),
          field("f_max", "max_score", "int", "Points possible"),
          field("f_criteria", "marking_criteria", "text", "How to award marks"),
        ],
      }),
      STRUCT({
        id: sid("m_rubric_sec"),
        name: "RubricSection",
        description: "One section in the derived marking schema.",
        fields: [
          field("f_sid", "section_id", "text", "Section id"),
          field("f_title", "title", "text", "Section title"),
          field("f_max", "max_score", "int", "Points possible for the section"),
          field("f_criteria", "criteria", "text", "Section-level marking notes"),
          field("f_questions", "questions", "list[model]", "Questions in this section", { ref: "m_rubric_q" }),
        ],
      }),
      STRUCT({
        id: sid("m_schema"),
        name: "MarkingSchema",
        description: "Structured rubric — assignment sections and questions to grade against.",
        dynamic: true,
        fields: [
          field("f_title", "assignment_title", "text", "Homework title"),
          field("f_sections", "sections", "list[model]", "Sections to grade", { ref: "m_rubric_sec" }),
        ],
      }),
      STRUCT({
        id: sid("m_hw_combined"),
        name: "HomeworkGraderInput",
        description: "Auto-generated by the Combine Inputs step.",
        auto: true,
        fields: [
          field("f_student_doc", "student_submission", "document", "Student submission attached at combine"),
          field("f_questions", "marking_questions", "list[model]", "Flat rubric questions from the template", {
            ref: "m_rubric_q",
          }),
        ],
      }),
      STRUCT({
        id: sid("m_work"),
        name: "GraderWork",
        description: "Marking schema document plus student submission documents.",
        fields: [
          field("f_schema", "marking_schema", "document", "Derived rubric (JSON in content)"),
          {
            id: "f_subs",
            name: "student_submissions",
            type: FieldType.ListDocument,
            optional: false,
            description: "Student homework sheets",
            minItems: 1,
          },
        ],
      }),
      STRUCT({
        id: sid("m_gradable"),
        name: "GradableSection",
        description: "One student × question row ready for batch grading.",
        fields: [
          field("f_student", "student_label", "text", "Student name or id"),
          field("f_sid", "section_id", "text", "Matches rubric section id"),
          field("f_title", "title", "text", "Section and question title"),
          field("f_body", "body", "text", "Question prompt and student work"),
          field("f_max", "max_score", "int", "Points possible"),
          field("f_criteria", "criteria", "text", "Marking criteria for this question"),
        ],
      }),
      STRUCT({
        id: sid("m_grade"),
        name: "SectionGrade",
        description: "Marks for one homework question.",
        fields: [
          field("f_student", "student_label", "text", "Student graded"),
          field("f_sid", "section_id", "text", "Matches section id"),
          field("f_score", "score", "int", "Points awarded", { testTolerance: 1 }),
          field("f_max", "max_score", "int", "Points possible"),
          field("f_correct", "correct", "bool", "True when the student earns full marks (score equals max_score)"),
          field(
            "f_mistake",
            "mistake_explanation",
            "text",
            "When correct is false, explain what went wrong with concrete details; empty string when correct",
            { deterministic: false },
          ),
        ],
      }),
    ],
    modules: [
      {
        id: "mod_in_schema",
        kind: "input",
        label: "Marking Schema",
        note: "Structured rubric JSON — sections and questions to grade against.",
        inputType: "json",
        inputNameContains: "marking_schema",
        outStructureId: "m_schema",
        cached: true,
        avgMs: 90,
        avgCostCents: 0,
        ...DESC(HOMEWORK_MARKING_SCHEMA_INPUT_DESC),
      },
      {
        id: "mod_questions",
        kind: "custom-code",
        label: "Marking Questions List",
        note: "Flatten rubric questions — one list item per gradable question.",
        inputDescription: "MarkingSchema object — sections with nested RubricQuestion lists",
        inStructureId: "m_schema",
        outStructureId: "m_rubric_q",
                cached: true,
        avgMs: 3,
        avgCostCents: 0,
        fallbackList: [{ typescript: "(schema) => (schema.sections ?? []).flatMap((s) => s.questions ?? [])" }],
      },
      {
        id: "mod_in_students",
        kind: "input",
        label: "Student Submissions",
        note: "One or more completed student homework sheets to grade.",
        inputType: "text",
        inputNameContains: "homework_student",
        inputMinCount: 1,
        inputCompatWith: {
          moduleId: "mod_in_schema",
          keys: [
            {
              label: "assignment title",
              upstream: { kind: "json-path", path: "assignment_title", normalize: "lower-trim" },
              local: {
                kind: "text-regex",
                pattern: "^#\\s*(.+?)\\s+—\\s+Student",
                group: 1,
                normalize: "lower-trim",
              },
            },
            {
              label: "question IDs",
              compare: "set-equal",
              upstream: {
                kind: "json-path",
                path: "sections[].questions[].question_id",
                normalize: "question-id-set",
              },
              local: { kind: "question-ids-text" },
            },
          ],
        },
        outStructureId: DOC_ID,
                cached: true,
        avgMs: 90,
        avgCostCents: 0,
        ...DESC(STUDENT_SUBMISSIONS_INPUT_DESC),
      },
      {
        id: "mod_combine",
        kind: "combine",
        label: "Combine Inputs",
        note: "Merges flat marking questions with each student submission document.",
        inputDescription: HOMEWORK_COMBINE_INPUT_DESC,
        inStructureId: "m_rubric_q",
        outStructureId: "m_hw_combined",
        cached: true,
        avgMs: 40,
        avgCostCents: 0,
      },
      {
        id: "mod_assemble",
        kind: "custom-code",
        label: "Assemble Grader Work",
        note: "Merge derived schema with all student submissions from pipeline state.",
        inputDescription: "HomeworkGraderInput from combine — schema JSON plus student submission documents in pipeline state",
        inStructureId: "m_hw_combined",
        outStructureId: "m_work",
        cached: true,
        avgMs: 6,
        avgCostCents: 0,
        fallbackList: [
          {
            typescript: HOMEWORK_ASSEMBLE_TS,
          },
        ],
      },
      {
        id: "mod_flatten",
        kind: "custom-code",
        label: "Flatten Sections",
        note: "One gradable row per student × rubric question.",
        inputDescription: "GraderWork — marking_schema Document plus list of student submission Documents",
        inStructureId: "m_work",
        outStructureId: "m_gradable",
                cached: true,
        avgMs: 10,
        avgCostCents: 0,
        fallbackList: [
          {
            typescript:
              '(work) => { let sections = []; const ms = work.marking_schema; if (ms?.sections) sections = ms.sections; else if (typeof ms?.content === "string") { try { sections = JSON.parse(ms.content).sections ?? []; } catch {} } const out = []; for (const sub of work.student_submissions ?? []) { const content = sub.content ?? ""; const student = (content.match(/Student:\\s*([^\\n]+)/i) || [])[1]?.trim() || sub.filename?.replace(/\\.md$/i, "") || "student"; for (const sec of sections) { for (const q of sec.questions ?? []) { const qRe = new RegExp(`\\\\*\\\\*${q.question_id}\\\\.\\\\*\\\\*[\\\\s\\\\S]*?(Student work:[^\\\\n]*)`, "i"); const workLine = (content.match(qRe) || [])[1]?.trim() ?? ""; out.push({ student_label: student, section_id: sec.section_id, title: `${sec.title} — ${q.question_id}`, body: `${q.prompt ?? ""}${workLine ? "\\n" + workLine : ""}`, max_score: q.max_score ?? 1, criteria: q.marking_criteria ?? sec.criteria ?? "" }); } } } return out; }',
          },
        ],
      },
      {
        id: "mod_grade",
        kind: "llm-batch",
        label: "Grade Each Section",
        inStructureId: "m_gradable",
        outStructureId: "m_grade",
                inputDescription: "List of GradableSection objects — student_label, question body, max_score, and criteria",
        prompt: HOMEWORK_GRADE_PROMPT,
        model: "deepseek-v4",
        cached: true,
        avgMs: 2400,
        avgCostCents: 6,
      },
      {
        id: "mod_out",
        kind: "output",
        label: "Final Output",
        inStructureId: "m_grade",
        outStructureId: "m_grade",
                cached: true,
        avgMs: 40,
        avgCostCents: 0,
        ...DESC(SECTION_GRADES_OUTPUT_DESC),
      },
      {
        id: "mod_assert",
        kind: "assert",
        label: "Grade Count Check",
        note: "len(Student Submissions) × len(Marking Questions List) = len(Final Output)",
        inStructureId: "m_grade",
        outStructureId: "m_grade",
                ...DESC(SECTION_GRADES_OUTPUT_DESC),
        cached: true,
        avgMs: 2,
        avgCostCents: 0,
        fallbackList: [
          {
            typescript:
              'const nStudents = len(step("Student Submissions"));\nconst nQuestions = len(step("Marking Questions List"));\nconst nOut = len(step("Final Output"));\nif (nStudents * nQuestions !== nOut) {\n  throw new Error(`expected ${nStudents}×${nQuestions}=${nStudents * nQuestions} grades, got ${nOut}`);\n}',
          },
          {
            python:
              "n_students = len_of(step('Student Submissions'))\nn_questions = len_of(step('Marking Questions List'))\nn_out = len_of(step('Final Output'))\nif n_students * n_questions != n_out:\n    raise ValueError(f'expected {n_students}×{n_questions}={n_students * n_questions} grades, got {n_out}')",
          },
        ],
      },
    ],
    strategies: STRATEGIES("hw"),
    docs: [
      { name: "homework_marking_schema.json", type: "json", label: "inference", file: "homework_grader/homework_marking_schema.json" },
      { name: "homework_student_sam.md", type: "text", label: "inference", file: "homework_grader/homework_student_sam.md" },
      { name: "homework_student_jordan.md", type: "text", label: "inference", file: "homework_grader/homework_student_jordan.md" },
      { name: "homework_student_alex.md", type: "text", label: "inference", file: "homework_grader/homework_student_alex.md" },
      { name: "classroom_algebra_ii_inference.json", type: "json", label: "inference", file: "homework_grader/classroom_algebra_ii_inference.json" },
      { name: "first_grade_inference.json", type: "json", label: "inference", file: "homework_grader/first_grade_inference.json" },
      { name: "university_latex_inference.json", type: "json", label: "inference", file: "homework_grader/university_latex_inference.json" },
      { name: "homework_marking_schema_first_grade.json", type: "json", label: "inference", file: "homework_grader/homework_marking_schema_first_grade.json" },
      { name: "homework_student_riley_first_grade.md", type: "text", label: "inference", file: "homework_grader/homework_student_riley_first_grade.md" },
      { name: "homework_marking_schema_university.json", type: "json", label: "inference", file: "homework_grader/homework_marking_schema_university.json" },
      { name: "homework_student_priya_university.md", type: "text", label: "inference", file: "homework_grader/homework_student_priya_university.md" },
      { name: "homework_grader_testing.json", type: "json", label: "training", file: "homework_grader/homework_grader_testing.json" },
      { name: "homework_first_grade_testing.json", type: "json", label: "training", file: "homework_grader/homework_first_grade_testing.json" },
      { name: "homework_university_testing.json", type: "json", label: "training", file: "homework_grader/homework_university_testing.json" },
    ],
  },

  feedback_router: {
    id: "p_feedback_router",
    name: "Product Feedback Router",
    kind: "product-ops",
    models: [
      {
        id: "m_item",
        name: "FeedbackItem",
        description: "One bullet of user feedback.",
        fields: [
          { id: "f_id", name: "feedback_id", type: "text", optional: false, description: "Stable id" },
          { id: "f_text", name: "text", type: "text", optional: false, description: "Verbatim feedback" },
        ],
      },
      {
        id: "m_route",
        name: "RoutedFeedback",
        description: "Classified feedback with bucket and quote.",
        fields: [
          { id: "f_id", name: "feedback_id", type: "text", optional: false, description: "Matches input id" },
          { id: "f_bucket", name: "bucket", type: "text", optional: false, description: "eng | design | docs | sales | praise" },
          { id: "f_quote", name: "representative_quote", type: "text", optional: false, description: "Short quote" },
        ],
      },
    ],
    modules: [
      { id: "mod_in", kind: "input", label: "Feedback Dump", inputType: "text", inputNameContains: "product_feedback", outStructureId: DOC_ID, cached: true, avgMs: 80, avgCostCents: 0, ...DESC(FEEDBACK_DUMP_INPUT_DESC) },
      {
        id: "mod_split",
        kind: "custom-code",
        label: "Split Bullets",
        ...DESC(FEEDBACK_DUMP_SPLIT_DESC),
        inStructureId: DOC_ID,
        outStructureId: "m_item",
                cached: true,
        avgMs: 5,
        avgCostCents: 0,
        fallbackList: [
          {
            typescript:
              '(doc)=>doc.content.split("\\n").filter((l)=>l.trim().startsWith("-")).map((l,i)=>({feedback_id:String(i+1),text:l.replace(/^-\\s*/,"").trim()}))',
          },
        ],
      },
      {
        id: "mod_route",
        kind: "llm-batch",
        label: "Classify Each Item",
        inStructureId: "m_item",
        outStructureId: "m_route",
                inputDescription: "List of FeedbackItem objects — one bullet of verbatim user feedback",
        prompt: "Classify product feedback into eng, design, docs, sales, or praise. Include a short representative_quote. Keep feedback_id.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 1800,
        avgCostCents: 4,
      },
      { id: "mod_out", kind: "output", label: "Routed Feedback", inStructureId: "m_route", outStructureId: "m_route", outType: { kind: "list", item: { kind: "ref", modelId: "m_route" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of RoutedFeedback records — bucket and quote per feedback item") },
    ],
    strategies: STRATEGIES("fb"),
    docs: [{ name: "march_product_feedback.txt", type: "text", label: "inference", file: "feedback_router/product_feedback.txt" }],
  },

  sla_breach: {
    id: "p_sla_breach",
    name: "Vendor SLA Breach Report",
    kind: "vendor-ops",
    models: [
      PARSED_TABLE,
      {
        id: "m_breach",
        name: "SlaBreachRow",
        description: "One service breach line for account managers.",
        fields: [
          { id: "f_svc", name: "service", type: "text", optional: false, description: "Service name" },
          { id: "f_uptime", name: "uptime_pct", type: "float", optional: false, description: "Measured uptime" },
          { id: "f_breach", name: "breached", type: "bool", optional: false, description: "Below SLA target" },
          { id: "f_credit", name: "credit_note", type: "text", optional: true, description: "Contract credit if any" },
        ],
      },
    ],
    modules: [
      { id: "mod_in", kind: "input", label: "SLA Uptime Report", inputType: "text", inputNameContains: "sla_uptime", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(SLA_UPTIME_INPUT_DESC) },
      parseStep("mod_parse", "Parse Uptime Table", DOC_ID, "m_parsed", PARSE_TABLE, false, parseTableDesc("vendor SLA uptime report")),
      {
        id: "mod_breach",
        kind: "llm",
        label: "Build Breach Table",
        inStructureId: "m_parsed",
        outStructureId: "m_breach",
                inputDescription: "ParsedTable with rows_json — JSON array of uptime rows from the SLA report",
        prompt:
          "rows_json is a JSON array parsed from the uptime markdown table. Emit one SlaBreachRow per service with breached=true when the Breach column is yes. Include credit_note from the document narrative when breached.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 2200,
        avgCostCents: 7,
      },
      { id: "mod_out", kind: "output", label: "Breach Table", inStructureId: "m_breach", outStructureId: "m_breach", outType: { kind: "list", item: { kind: "ref", modelId: "m_breach" } }, cached: true, avgMs: 40, avgCostCents: 0, ...DESC("List of SlaBreachRow records — one breach verdict per monitored service") },
    ],
    strategies: STRATEGIES("sla"),
    docs: [
      { name: "cloudhost_sla_uptime_march_2025.md", type: "text", label: "inference", file: "sla_breach/sla_uptime_report.md" },
      { name: "sla_breach_testing.json", type: "json", label: "training", file: "sla_breach/sla_breach_testing.json" },
    ],
  },

  bug_enricher: {
    id: "p_bug_enricher",
    name: "Bug Report Enricher",
    kind: "engineering",
    models: [
      {
        id: "m_combined",
        name: "BugEnrichInput",
        auto: true,
        description: "User report (pipeline) + log snippet document.",
        fields: [
          { id: "f_logs", name: "app_logs", type: "document", optional: false, description: "Log excerpt" },
          { id: "f_report", name: "user_report", type: "model", optional: false, description: "Parsed bug report", ref: DOC_ID },
        ],
      },
      {
        id: "m_enriched",
        name: "EnrichedBug",
        description: "Structured bug ticket ready for triage.",
        fields: [
          { id: "f_steps", name: "repro_steps", type: "list[text]", optional: false, description: "Numbered repro steps" },
          { id: "f_sev", name: "severity", type: "text", optional: false, description: "critical | high | medium | low" },
          { id: "f_comp", name: "likely_component", type: "text", optional: false, description: "Suspected code area" },
          { id: "f_summary", name: "summary", type: "text", optional: false, description: "One-line title" },
        ],
      },
    ],
    modules: [
      { id: "mod_in_report", kind: "input", label: "Bug Report", inputType: "text", inputNameContains: "bug_report", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(BUG_REPORT_INPUT_DESC) },
      { id: "mod_in_logs", kind: "input", label: "App Logs", inputType: "text", inputNameContains: "app_logs", outStructureId: DOC_ID, cached: true, avgMs: 90, avgCostCents: 0, ...DESC(APP_LOGS_INPUT_DESC) },
      { id: "mod_combine", kind: "combine", label: "Combine Inputs", inStructureId: DOC_ID, outStructureId: "m_combined", cached: true, avgMs: 40, avgCostCents: 0, ...DESC(BUG_REPORT_INPUT_DESC) },
      {
        id: "mod_enrich",
        kind: "llm",
        label: "Enrich Bug",
        inStructureId: "m_combined",
        outStructureId: "m_enriched",
        inputDescription: BUG_ENRICH_COMBINED_INPUT_DESC,
        prompt:
          "user_report is the bug report Document (use user_report.content). app_logs is the log document (use app_logs.content). Infer repro_steps, severity, likely_component (e.g. export/pdf/fonts), and a concise summary.",
        model: "deepseek-v4",
        cached: true,
        avgMs: 2400,
        avgCostCents: 7,
      },
      { id: "mod_out", kind: "output", label: "Enriched Ticket", inStructureId: "m_enriched", outStructureId: "m_enriched", cached: true, avgMs: 40, avgCostCents: 0, ...DESC("Single EnrichedBug object — structured ticket ready for engineering triage") },
    ],
    strategies: STRATEGIES("bug"),
    docs: [
      { name: "ticket_8842_bug_report.md", type: "text", label: "inference", file: "bug_enricher/bug_report.md" },
      { name: "ticket_8842_app_logs.md", type: "text", label: "inference", file: "bug_enricher/app_logs_snippet.md" },
    ],
  },
};

for (const [file, seed] of Object.entries(seeds)) {
  const path = join(SEEDS_DIR, `${file}.json`);
  writeFileSync(path, `${JSON.stringify(seed, null, 2)}\n`);
  loadProjectSeed(path);
  console.log(`wrote + validated ${file}.json`);
}
