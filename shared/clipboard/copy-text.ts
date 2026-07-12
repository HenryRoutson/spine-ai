// AI : clipboard.writeText rejects with NotAllowedError when the document
// isn't focused (devtools open, or write deferred past the click by an await).
// Refocus, try the async API, and fall back to a hidden textarea + execCommand.
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    window.focus()
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement("textarea")
    el.value = text
    el.style.position = "fixed"
    el.style.opacity = "0"
    document.body.appendChild(el)
    el.focus()
    el.select()
    document.execCommand("copy")
    el.remove()
  }
}
