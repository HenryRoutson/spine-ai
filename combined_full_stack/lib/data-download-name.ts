import { firstMatchingModelName } from "@/lib/structure-match-parse"
import type { StructureModel, TypeAlias } from "@/lib/types"

function filenameSlug(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/@/g, "_at_")
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "unknown"
  )
}

function formatDownloadDatetime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// AI : matches server doc id hash — sha256 first 16 hex chars.
export async function shortContentHash(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `sha_${hex.slice(0, 16)}`
}

export type DownloadBaseNameInput = {
  content: string
  projectName?: string
  userEmail?: string | null
  models?: StructureModel[]
  typeAliases?: TypeAlias[]
  modelName?: string
}

// AI : autopipeline_project_user_datetime_pydantic_model_json_hash
export async function buildDownloadBaseName(input: DownloadBaseNameInput): Promise<string> {
  const hash = await shortContentHash(input.content)
  const model =
    input.modelName ??
    firstMatchingModelName(input.content, input.models ?? [], input.typeAliases ?? [])
  return [
    "autopipeline",
    filenameSlug(input.projectName ?? "project"),
    filenameSlug(input.userEmail ?? "anonymous"),
    formatDownloadDatetime(),
    filenameSlug(model),
    "json",
    hash,
  ].join("_")
}
