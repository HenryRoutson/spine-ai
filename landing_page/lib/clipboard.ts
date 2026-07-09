// AI : clipboard.writeText rejects when the document isn't focused — fall back to execCommand.
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    window.focus();
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}
