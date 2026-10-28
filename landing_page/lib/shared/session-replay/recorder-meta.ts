// AI : client-side labels for replay chunk meta — no DOM deps beyond HTMLElement.

export type replay_chunk_meta = {
  pages: string[]
  clickedComponents: string[]
}

const MAX_ITEMS = 40

export function currentPagePath(): string {
  if (typeof window === "undefined") return "/"
  return window.location.pathname || "/"
}

export function elementClickLabel(el: HTMLElement, appWindow?: string | null): string {
  const tagged =
    el.getAttribute("data-spine-id") ??
    el.getAttribute("data-component") ??
    el.getAttribute("data-testid") ??
    el.getAttribute("data-spine-window")
  if (tagged) return tagged.trim().slice(0, 200)
  if (appWindow) return `${appWindow}:${compactElementLabel(el)}`.slice(0, 200)
  return compactElementLabel(el)
}

function compactElementLabel(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label")
  if (aria) return aria.replace(/\s+/g, " ").trim().slice(0, 120)
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim()
  if (text) return text.slice(0, 120)
  const name = el.getAttribute("name")
  if (name) return name.slice(0, 120)
  return el.tagName.toLowerCase()
}

export function createReplayMetaBuffer(initialPage?: string): {
  recordPage: (path: string) => void
  recordClick: (label: string) => void
  hasPending: () => boolean
  drain: () => replay_chunk_meta
} {
  const pendingPages = new Set<string>()
  const components = new Set<string>()
  // AI : baseline page — navigations away from it are pending; re-record after drain is not.
  let lastPage = initialPage?.trim().slice(0, 200) ?? ""

  return {
    recordPage(path: string) {
      const t = path.trim().slice(0, 200)
      if (!t || pendingPages.size >= MAX_ITEMS) return
      if (t === lastPage || pendingPages.has(t)) return
      pendingPages.add(t)
      lastPage = t
    },
    recordClick(label: string) {
      const t = label.trim().slice(0, 200)
      if (!t || components.size >= MAX_ITEMS) return
      components.add(t)
    },
    hasPending(): boolean {
      return pendingPages.size > 0 || components.size > 0
    },
    drain(): replay_chunk_meta {
      const out = {
        pages: [...pendingPages],
        clickedComponents: [...components],
      }
      pendingPages.clear()
      components.clear()
      return out
    },
  }
}
