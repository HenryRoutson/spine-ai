import { createHash } from "node:crypto"
import type { DocId } from "@/lib/types"

export function hashContent(content: string): DocId {
  return (`sha_${createHash("sha256").update(content).digest("hex").slice(0, 16)}`) as DocId
}
