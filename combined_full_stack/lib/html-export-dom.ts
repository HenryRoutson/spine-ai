import { RUN_HTML_EXPORT_SKIP_ATTR } from "@/lib/html-export-mark"

function cssFromSheet(sheet: CSSStyleSheet): string {
  try {
    return [...sheet.cssRules].map((rule) => rule.cssText).join("\n")
  } catch {
    return sheet.href ? `@import url(${JSON.stringify(sheet.href)});` : ""
  }
}

export function collectPageCss(): string {
  const parts: string[] = []
  for (const sheet of document.styleSheets) parts.push(cssFromSheet(sheet))
  const adopted = document.adoptedStyleSheets
  if (adopted) {
    for (const sheet of adopted) parts.push(cssFromSheet(sheet))
  }
  return parts.filter(Boolean).join("\n")
}

export function cssVarsFrom(el: Element): string {
  const cs = getComputedStyle(el)
  const lines: string[] = []
  for (let i = 0; i < cs.length; i++) {
    const name = cs.item(i)
    if (!name.startsWith("--")) continue
    lines.push(`  ${name}: ${cs.getPropertyValue(name).trim()};`)
  }
  return lines.join("\n")
}

export function exportableIframes(root: Element): HTMLIFrameElement[] {
  return [...root.querySelectorAll("iframe")].filter(
    (el) => !el.closest(`[${RUN_HTML_EXPORT_SKIP_ATTR}]`),
  )
}

// AI : cloneNode copies attributes, not live .value/.checked — stamp those before outerHTML.
export function copyFormState(src: Element, dst: Element): void {
  const srcFields = src.querySelectorAll("input, textarea, select")
  const dstFields = dst.querySelectorAll("input, textarea, select")
  srcFields.forEach((el, i) => {
    const d = dstFields[i]
    if (!d) return
    if (el instanceof HTMLInputElement && d instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        d.checked = el.checked
        if (el.checked) d.setAttribute("checked", "")
        else d.removeAttribute("checked")
      } else {
        d.value = el.value
        d.setAttribute("value", el.value)
      }
    } else if (el instanceof HTMLTextAreaElement && d instanceof HTMLTextAreaElement) {
      d.value = el.value
      d.textContent = el.value
    } else if (el instanceof HTMLSelectElement && d instanceof HTMLSelectElement) {
      d.value = el.value
      for (let o = 0; o < d.options.length; o++) {
        const opt = d.options[o]!
        if (opt.value === el.value) opt.setAttribute("selected", "")
        else opt.removeAttribute("selected")
      }
    }
  })
}
