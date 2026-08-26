// AI : optional public usage docs on shared links — off by default so project Docs stay private.

export const MAX_VIEWER_MARKDOWN_CHARS = 48_000

export type viewer_markdown_string = string & { __brand: "viewer_markdown" }

export function normalizeViewerMarkdown(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, MAX_VIEWER_MARKDOWN_CHARS)
}

export function composeViewerMarkdown(opts: {
  showDocs: boolean
  instructions: string
  appendProjectDocs: boolean
  projectDocumentation: string
}): string {
  if (!opts.showDocs) return ""
  const parts: string[] = []
  const instructions = opts.instructions.trim()
  if (instructions) parts.push(instructions)
  if (opts.appendProjectDocs) {
    const docs = opts.projectDocumentation.trim()
    if (docs) parts.push(docs)
  }
  return parts.join("\n\n").slice(0, MAX_VIEWER_MARKDOWN_CHARS)
}
