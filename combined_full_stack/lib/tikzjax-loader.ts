// AI : load TikZJax once — browser WASM TeX → SVG for script[type=text/tikz].

const TIKZJAX_BASE = "https://cdn.jsdelivr.net/npm/@planktimerr/tikzjax@1.0.7/dist"
const TIKZJAX_JS = `${TIKZJAX_BASE}/tikzjax.js`
const TIKZJAX_CSS = `${TIKZJAX_BASE}/fonts.css`

let loadPromise: Promise<void> | null = null

function ensureStylesheet(): void {
  if (typeof document === "undefined") return
  if (document.querySelector(`link[data-tikzjax-fonts="1"]`)) return
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = TIKZJAX_CSS
  link.dataset.tikzjaxFonts = "1"
  document.head.appendChild(link)
}

export function ensureTikzJax(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (loadPromise) return loadPromise
  ensureStylesheet()
  const existing = document.querySelector(`script[data-tikzjax="1"]`) as HTMLScriptElement | null
  if (existing) {
    loadPromise = existing.dataset.loaded === "1"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve(), { once: true })
          existing.addEventListener("error", () => reject(new Error("tikzjax failed to load")), { once: true })
        })
    return loadPromise
  }
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = TIKZJAX_JS
    script.async = true
    script.dataset.tikzjax = "1"
    script.onload = () => {
      script.dataset.loaded = "1"
      resolve()
    }
    script.onerror = () => reject(new Error("tikzjax failed to load"))
    document.head.appendChild(script)
  })
  return loadPromise
}

export function wrapTikzPicture(source: string): string {
  const trimmed = source.trim()
  if (/\\begin\{tikzpicture\}/.test(trimmed)) return trimmed
  return `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`
}
