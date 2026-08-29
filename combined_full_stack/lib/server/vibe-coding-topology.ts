// AI : data-shape planning for vibe — generic principles, not eval-task phrases.
export const VIBE_TOPOLOGIES = [
  "batch-map",
  "explode",
  "split-join",
  "combine",
  "assemble",
  "fork",
] as const

export type VibeTopologyName = (typeof VIBE_TOPOLOGIES)[number]

export function buildVibeTopologyPromptBlock(): string {
  return `Infer the spine from DATA SHAPE (first thinking line: TOPOLOGY: <name>). Do not copy a canned example.
- batch-map — many files of the same kind, one structured row each: one list[Document] input + llm-batch. Not a single llm over concatenated files.
- explode — many rows inside each file: llm-batch structureOut is a WRAPPER with a list field, then custom-code flatten. Do not set llm-batch structureOut to the row type (that is one row per file).
- split-join — split text, map each piece, join a report: custom-code split → llm-batch → custom-code join.
- combine — two different RAW document kinds: process the first on the spine, put the second input immediately before combine. Not fork. Not assemble until both are parsed.
- assemble — two already-parsed outputs: assembleBindings after both parses. Bind quoted lists to the auto-inserted Link Quotes label. Not combine, not a custom-code zip, not a third upload.
- fork — independent extracts on ONE document: fork with product join; each lane llm structureIn is Document. Not one mega-llm, not parallel.

The platform already derives Zod, SQL tables, LLM field prompts, OCR (pdf/image → text), and Link Quotes from your structures. See derived/schema.sql, derived/schema.zod.ts, derived/models.py, derived/prompts.md. Prefer sql steps for table reads/writes — omit sql for SELECT * from the out structure. Leave llm prompts empty unless you need extra instructions. Use tuple[text,quote] on copied spans so hosted-site uploads can be quoted. Do not invent {state.X} prompt templates.`
}

export function parseThinkingTopology(thinking: string): VibeTopologyName | null {
  const m = thinking.match(/^\s*TOPOLOGY:\s*([a-z-]+)/im)
  const raw = m?.[1]?.toLowerCase()
  return (VIBE_TOPOLOGIES as readonly string[]).includes(raw ?? "") ? (raw as VibeTopologyName) : null
}

// AI : scoring-only for known A/B example prompts. Never inject into live VALIDATION.md or retries.
export function topologyAdvice(task: string, kinds: string[]): string[] {
  const t = task.toLowerCase()
  const has = (k: string) => kinds.includes(k)
  const hints: string[] = []
  if (
    (t.includes("hundreds of unstructured receipts") || t.includes("merchant and date from receipts")) &&
    !has("llm-batch")
  ) {
    hints.push("batch-map: many same-kind files need llm-batch, not a single llm")
  }
  if (
    (t.includes("several action items") || t.includes("one spreadsheet row per item")) &&
    !(has("llm-batch") && has("custom-code"))
  ) {
    hints.push(
      "explode: llm-batch structureOut must be a WRAPPER (items: list[Row]) then custom-code flatten — not one Row per file",
    )
  }
  if (
    t.includes("summarize each") &&
    t.includes("checklist") &&
    !(has("custom-code") && has("llm-batch"))
  ) {
    hints.push("split-join: split lines with custom-code, llm-batch each line, then custom-code join")
  }
  if (t.includes("policy table") || (t.includes("expense") && t.includes("policy"))) {
    if (!has("combine")) {
      hints.push("combine: policy + expenses — process policy first, side file immediately before combine")
    } else if (!has("custom-code")) {
      hints.push(
        "combine: parse the policy table with custom-code before the side input; after combine, custom-code merge then one llm — not extra llms on raw files",
      )
    }
  }
  if (t.includes("job description") || t.includes("skill matches")) {
    if (!has("assemble")) {
      hints.push("assemble: resumes + job must assemble after both parses (assembleBindings), not combine or custom-code zip")
    } else if (!has("custom-code")) {
      hints.push(
        "assemble: after assemble, custom-code flatten to skill-match rows; bind quoted resume lists to Link Quotes",
      )
    }
  }
  if (
    ((t.includes("independently") && t.includes("memo")) || t.includes("risks, parties, and dates")) &&
    !has("fork")
  ) {
    hints.push("fork: independent extracts on one contract need fork + product join, then memo; lane structureIn is Document")
  }
  return hints
}

export function formatTopologyRetryErrors(_task: string, _kinds: string[]): string {
  // AI : live retries must not FAIL I/O-valid pipelines because the user prompt matched a few-shot phrase.
  return ""
}
