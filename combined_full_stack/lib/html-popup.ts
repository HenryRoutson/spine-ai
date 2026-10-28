import { JSON_VIEWER_MESSAGE_FULLSCREEN } from "@shared/json-viewer/types"
import {
  HTML_EXPORT_EXPAND_ATTR,
  HTML_EXPORT_EXPAND_ROOT_ATTR,
  HTML_EXPORT_EXPAND_TITLE_ATTR,
} from "@/lib/html-export-mark"

// AI : PopupModal (live) and saved HTML overlays use the same chrome classes.

export type HtmlPopupChrome = {
  overlay: string
  backdrop: string
  panel: string
  header: string
  title: string
  close: string
  closeSvg: string
  body: string
}

export const HTML_POPUP_CHROME: HtmlPopupChrome = {
  overlay: "fixed inset-0 z-[80] flex items-center justify-center p-[5vh]",
  backdrop: "absolute inset-0 bg-background/70 backdrop-blur-sm",
  panel: "relative flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
  header: "flex items-center justify-between border-b border-border px-4 py-2.5",
  title: "font-mono text-xs text-muted-foreground",
  close: "rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground",
  closeSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  body: "flex min-h-0 flex-1 flex-col",
}

export const HTML_POPUP_OVERLAY_ATTR = "data-html-popup-overlay"

export type HtmlPopupExpandBoot = {
  messageType: string
  expandAttr: string
  expandRootAttr: string
  expandTitleAttr: string
  overlayAttr: string
  chrome: HtmlPopupChrome
}

// AI : no free variables — inference-html-export embeds this via Function#toString.
export function bindHtmlPopupExpand(root: ParentNode, opts: HtmlPopupExpandBoot): () => void {
  const ownerDoc = (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument
  const ownerWin = ownerDoc?.defaultView
  if (!ownerDoc || !ownerWin) return function () {}
  // AI : rebind so nested listeners see Document/Window, not Document | null.
  const doc: Document = ownerDoc
  const win: Window = ownerWin
  const chrome = opts.chrome
  const unbind: Array<() => void> = []
  let overlay: HTMLElement | null = null

  function close(): void {
    if (!overlay) return
    overlay.remove()
    overlay = null
  }

  function openPanel(title: string, fill: (body: HTMLElement) => void): void {
    close()
    const wrap = doc.createElement("div")
    wrap.setAttribute(opts.overlayAttr, "")
    wrap.className = chrome.overlay

    const backdrop = doc.createElement("button")
    backdrop.type = "button"
    backdrop.setAttribute("aria-label", "Close viewer")
    backdrop.className = chrome.backdrop
    backdrop.addEventListener("click", close)

    const panel = doc.createElement("div")
    panel.className = chrome.panel

    const header = doc.createElement("div")
    header.className = chrome.header

    const titleEl = doc.createElement("span")
    titleEl.className = chrome.title
    titleEl.textContent = title

    const closeBtn = doc.createElement("button")
    closeBtn.type = "button"
    closeBtn.setAttribute("aria-label", "Close viewer")
    closeBtn.className = chrome.close
    closeBtn.innerHTML = chrome.closeSvg
    closeBtn.addEventListener("click", close)

    header.appendChild(titleEl)
    header.appendChild(closeBtn)

    const body = doc.createElement("div")
    body.className = chrome.body
    fill(body)

    panel.appendChild(header)
    panel.appendChild(body)
    wrap.appendChild(backdrop)
    wrap.appendChild(panel)
    doc.body.appendChild(wrap)
    overlay = wrap
  }

  function openIframe(iframe: HTMLIFrameElement, title: string): void {
    if (iframe.closest("[" + opts.overlayAttr + "]")) return
    const srcdoc = iframe.getAttribute("srcdoc") || iframe.srcdoc || ""
    if (!srcdoc) return
    openPanel(title, function (body) {
      const big = doc.createElement("iframe")
      big.title = iframe.title || title
      big.className = "min-h-0 w-full flex-1 border-0 bg-background"
      big.style.height = "100%"
      big.srcdoc = srcdoc
      big.addEventListener("load", function () {
        try {
          big.contentDocument && big.contentDocument.body.removeAttribute("data-fs")
        } catch (_) {}
      })
      body.appendChild(big)
    })
  }

  function iframeForSource(source: MessageEventSource | null): HTMLIFrameElement | null {
    const iframes = root.querySelectorAll("iframe")
    for (let i = 0; i < iframes.length; i++) {
      const el = iframes[i] as HTMLIFrameElement
      if (el.contentWindow === source) return el
    }
    return null
  }

  function onMessage(e: MessageEvent): void {
    const origin = win.location.origin
    if (origin !== "null" && e.origin !== origin && e.origin !== "null") return
    if (!e.data || e.data.type !== opts.messageType) return
    const iframe = iframeForSource(e.source)
    if (!iframe) return
    openIframe(iframe, iframe.title || "JSON")
  }

  function onExpandClick(e: Event): void {
    const btn = e.currentTarget as HTMLElement
    const host = btn.closest("[" + opts.expandRootAttr + "]")
    if (!host) return
    const title = host.getAttribute(opts.expandTitleAttr) || "Preview"
    const iframe = host.querySelector("iframe") as HTMLIFrameElement | null
    if (iframe) {
      openIframe(iframe, title)
      return
    }
    const kids = host.children
    const src = kids.length > 1 ? (kids[kids.length - 1] as HTMLElement) : null
    if (!src) return
    openPanel(title, function (body) {
      const clone = src.cloneNode(true) as HTMLElement
      clone.style.maxHeight = "none"
      clone.style.height = "100%"
      clone.style.overflow = "auto"
      body.appendChild(clone)
    })
  }

  win.addEventListener("message", onMessage)
  unbind.push(function () {
    win.removeEventListener("message", onMessage)
  })

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") close()
  }
  win.addEventListener("keydown", onKey)
  unbind.push(function () {
    win.removeEventListener("keydown", onKey)
  })

  const buttons = root.querySelectorAll("[" + opts.expandAttr + "]")
  for (let b = 0; b < buttons.length; b++) {
    const btn = buttons[b] as HTMLElement
    btn.addEventListener("click", onExpandClick)
    unbind.push(function () {
      btn.removeEventListener("click", onExpandClick)
    })
  }

  return function () {
    close()
    for (let u = 0; u < unbind.length; u++) unbind[u]!()
  }
}

export function htmlPopupExpandBootScript(): string {
  const opts: HtmlPopupExpandBoot = {
    messageType: JSON_VIEWER_MESSAGE_FULLSCREEN,
    expandAttr: HTML_EXPORT_EXPAND_ATTR,
    expandRootAttr: HTML_EXPORT_EXPAND_ROOT_ATTR,
    expandTitleAttr: HTML_EXPORT_EXPAND_TITLE_ATTR,
    overlayAttr: HTML_POPUP_OVERLAY_ATTR,
    chrome: HTML_POPUP_CHROME,
  }
  return `(${bindHtmlPopupExpand.toString()})(document, ${JSON.stringify(opts)});`
}
