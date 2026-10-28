// AI : topology names for thinking — general teaching only. Do not match eval task strings.

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
- batch-map — many same-kind files, ONE row each: list[Document] + llm-batch. Never a single llm.
- explode — MANY rows PER file: llm-batch structureOut is a WRAPPER with items: list[Row], then custom-code flatten. Do NOT set llm-batch structureOut to the row type.
- split-join — one document split into lines, then one report: custom-code split → llm-batch → custom-code join.
- combine — two RAW document kinds: process the first on the spine, put the second input immediately before combine. Not fork. Not assemble until both are parsed.
- assemble — two already-parsed outputs: assembleBindings after both parses. Bind quoted lists to "Link Quotes". Not combine, not a custom-code zip, not a third upload.
- fork — independent extracts on ONE document: fork product join, then memo. Lane llms structureIn is Document. Not one mega-llm, not parallel.`
}

export function parseThinkingTopology(thinking: string): VibeTopologyName | null {
  const m = thinking.match(/^\s*TOPOLOGY:\s*([a-z-]+)/im)
  const raw = m?.[1]?.toLowerCase()
  return (VIBE_TOPOLOGIES as readonly string[]).includes(raw ?? "") ? (raw as VibeTopologyName) : null
}
