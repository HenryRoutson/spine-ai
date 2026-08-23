// AI : vibe/simple UI — inputDescription is a type contract; show everyday words instead.

function humanizeIdent(name: string): string {
  const spaced = name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim()
  if (!spaced) return name
  if (/\b(item|job|row|file|example|document|record)$/.test(spaced) && !spaced.endsWith("s")) {
    return `${spaced}s`
  }
  return spaced
}

function stillTechnical(text: string): boolean {
  return (
    /\blist\s*\[/.test(text) ||
    /\bJSON\b/i.test(text) ||
    /\b(schema|spine|passthrough|wrapper|typeexpr|zod)\b/i.test(text) ||
    /\{[a-zA-Z_.]+\}/.test(text)
  )
}

export function toPlainStepDescription(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined
  let t = raw.trim()
  t = t.replace(/\blist\s*\[\s*([A-Za-z_][\w]*)\s*\]/gi, (_, name: string) => humanizeIdent(name))
  t = t.replace(/\bJSON\s+array\s+of\s+(?:structured\s+)?/gi, "")
  t = t.replace(/\b(?:a\s+)?JSON\b\s*/gi, "")
  t = t.replace(/\barray of (?:structured\s+)?/gi, "")
  t = t.replace(/\barrays?\b/gi, "")
  t = t.replace(/\blist of\s+/gi, "")
  t = t.replace(/\bplain[-\s]?text\s+/gi, "")
  t = t.replace(/\bobjects?\b/gi, "")
  t = t.replace(/\bDocuments?\b/g, "files")
  t = t.replace(/\((?:[a-z][\w]*(?:\s*,\s*)?)+\)/g, "")
  t = t.replace(/\b([A-Za-z][\w ]*?)\.(items|content|rows|json)\b/gi, "$1")
  t = t.replace(/\bon pipeline state\b/gi, "")
  t = t.replace(/\bAND\b/g, "and")
  t = t.replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (m) => humanizeIdent(m))
  t = t.replace(/\b[A-Z][a-z]+(?:[A-Z][a-zA-Z0-9]+)+\b/g, (m) => humanizeIdent(m))
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([,.—])/g, "$1").replace(/\s+—\s*$/g, "").trim()
  t = t.replace(/^[,.\s—]+|[,.\s—]+$/g, "")
  if (!t || stillTechnical(t)) return undefined
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function simpleKindBlurb(kind?: string): string | undefined {
  switch (kind) {
    case "input":
      return undefined
    case "combine":
      return "Puts two things together"
    case "example-select":
      return "Picks the closest matches"
    case "assemble":
      return "Puts the pieces in one place"
    case "llm":
      return "Writes the next result"
    case "llm-batch":
      return "Does this for each row"
    case "output":
      return "The finished result"
    case "custom-code":
    case "transform":
      return "Rearranges the previous step"
    case "merge":
      return "Combines two results"
    case "chunk":
      return "Breaks a long file into smaller pieces"
    case "parallel":
      return "Does several things at once"
    case "fork":
      return "Splits the work into separate paths"
    case "assert":
      return "Checks that the result looks right"
    case "human-review":
      return "Waits for someone to review"
    case "webhook":
      return "Sends the result somewhere else"
    case "n8n":
      return "Runs a typed automation piece"
    case "chatbot":
      return "Has a conversation"
    default:
      return undefined
  }
}

export function simpleStepDescription(
  inputDescription?: string | null,
  kind?: string,
): string | undefined {
  return toPlainStepDescription(inputDescription) ?? simpleKindBlurb(kind)
}

export function toPlainIssueMessage(raw?: string | null): string {
  const t = raw?.trim() ?? ""
  const nameMatch = t.match(/filename must contain "([^"]*)"/i)
  if (nameMatch?.[1]) return `The file name needs to include "${nameMatch[1]}".`
  if (/document for this input step/i.test(t)) return "This file is the wrong kind."
  return "This file doesn't match what this step needs."
}
