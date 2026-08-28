// AI : live A/B misses (explode / combine / assemble / fork / llm vs llm-batch) — one block for thinking, harness, JSON.
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
  return `Choose exactly one TOPOLOGY and build that spine (first thinking line: TOPOLOGY: <name>):
- batch-map — many same-kind files, ONE row each (receipts, invoices): list[Document] + llm-batch. Never a single llm.
- explode — MANY rows PER file (action items, line items): llm-batch structureOut is a WRAPPER with items: list[Row], then custom-code flatten. Do NOT set llm-batch structureOut to the row type.
- split-join — one document split into lines, then one report: custom-code split → llm-batch → custom-code join.
- combine — two RAW document kinds (policy + expenses): process the first on the spine, put the second input immediately before combine. Not fork. Not assemble until both are parsed.
- assemble — two already-parsed outputs (resumes + job): assembleBindings after both parses. Bind quoted lists to "Link Quotes". Not combine, not a custom-code zip, not a third upload.
- fork — independent extracts on ONE document (risks / parties / dates): fork product join, then memo. Lane llms structureIn is Document. Not one mega-llm, not parallel.

Mistakes that still look I/O-valid — do not ship them:
- receipts / merchant+date → one llm (must be llm-batch)
- several action items per note → llm-batch structureOut = ActionItem (must be wrapper + flatten)
- policy + expenses → fork or assemble (must be combine; side file immediately before combine)
- resumes + job → combine or a third upload (must be assemble after both parses)
- independent risks/parties/dates → one ExtractedData llm or parallel (must be fork)`
}

export function parseThinkingTopology(thinking: string): VibeTopologyName | null {
  const m = thinking.match(/^\s*TOPOLOGY:\s*([a-z-]+)/im)
  const raw = m?.[1]?.toLowerCase()
  return (VIBE_TOPOLOGIES as readonly string[]).includes(raw ?? "") ? (raw as VibeTopologyName) : null
}

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

export function formatTopologyRetryErrors(task: string, kinds: string[]): string {
  const hints = topologyAdvice(task, kinds)
  if (!hints.length) return ""
  return `Topology mismatch:\n${hints.map((h) => `- ${h}`).join("\n")}`
}
