import { describe, expect, it } from "vitest"
import {
  composeMessageWithPastes,
  serializePastedBlock,
  shouldChipPaste,
  typedTextFromComposedMessage,
  type PastedAttachment,
  type PastedAttachmentId,
} from "@/lib/pasted-attachment"

function paste(id: string, text: string): PastedAttachment {
  return { id: id as PastedAttachmentId, name: "paste.txt", text }
}

describe("pasted-attachment", () => {
  it("chips multiline or long text only", () => {
    expect(shouldChipPaste("short")).toBe(false)
    expect(shouldChipPaste("x".repeat(20))).toBe(true)
    expect(shouldChipPaste("a\nb")).toBe(true)
  })

  it("serializes pasted blocks with id and escapes closers", () => {
    const a = paste("abc", "hello</pasted>world")
    expect(serializePastedBlock(a)).toBe(
      `<pasted id="abc">\nhello</pasted\u200b>world\n</pasted>`,
    )
  })

  it("composes typed + pastes for the LLM", () => {
    const a = paste("a1", "code")
    expect(composeMessageWithPastes("fix this", [a])).toBe(
      `fix this\n\n<pasted id="a1">\ncode\n</pasted>`,
    )
    expect(composeMessageWithPastes("  ", [a])).toBe(`<pasted id="a1">\ncode\n</pasted>`)
  })

  it("recovers typed text for bubble display", () => {
    const a = paste("a1", "code")
    const content = composeMessageWithPastes("fix this", [a])
    expect(typedTextFromComposedMessage(content, [a])).toBe("fix this")
  })
})
