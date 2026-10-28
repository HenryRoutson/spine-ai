// AI : Cursor-style paste chips for agent chat — UI chips, LLM sees <pasted>…</pasted>.

import { uid } from "@/lib/id"

export type PastedAttachmentId = string & { readonly __brand: "PastedAttachmentId" }

export type PastedAttachment = {
  id: PastedAttachmentId
  name: string
  text: string
}

/** AI : short pastes stay in the textarea; longer / multiline become chips. */
export const PASTE_CHIP_MIN_CHARS = 20

export function shouldChipPaste(text: string): boolean {
  const t = text.replace(/\r\n/g, "\n")
  return t.includes("\n") || t.length >= PASTE_CHIP_MIN_CHARS
}

function pasteFileName(text: string): string {
  const first = text.trim().split("\n")[0]?.trim() ?? ""
  const stem = (first || "paste").slice(0, 32).replace(/[^\w.-]+/g, "_") || "paste"
  return `${stem}.txt`
}

export async function pastedAttachmentFromClipboardText(text: string): Promise<PastedAttachment> {
  const normalized = text.replace(/\r\n/g, "\n")
  return {
    id: uid<PastedAttachmentId>("paste_"),
    name: pasteFileName(normalized),
    text: normalized,
  }
}

export function pasteChipPreview(attachment: PastedAttachment, maxChars = 40): string {
  const oneLine = attachment.text.trim().replace(/\s+/g, " ")
  if (oneLine.length <= maxChars) return oneLine || "Pasted"
  return `${oneLine.slice(0, maxChars - 1)}…`
}

// AI : escape so a clipboard containing </pasted> cannot break the region.
function escapePastedBody(text: string): string {
  return text.replaceAll("</pasted>", "</pasted\u200b>")
}

export function serializePastedBlock(attachment: PastedAttachment): string {
  return `<pasted id="${attachment.id}">\n${escapePastedBody(attachment.text)}\n</pasted>`
}

/** AI : wire form for the model — typed prompt + tagged paste chips. */
export function composeMessageWithPastes(typed: string, pastes: PastedAttachment[]): string {
  const parts: string[] = []
  const trimmed = typed.trim()
  if (trimmed) parts.push(trimmed)
  for (const p of pastes) parts.push(serializePastedBlock(p))
  return parts.join("\n\n")
}

/** AI : bubble display — typed text only; chips render separately. */
export function typedTextFromComposedMessage(
  content: string,
  pastes: PastedAttachment[] | undefined,
): string {
  if (!pastes?.length) return content
  let rest = content
  for (const p of pastes) {
    const block = serializePastedBlock(p)
    rest = rest.split(block).join("")
  }
  return rest.replace(/^\n+|\n+$/g, "").trim()
}
