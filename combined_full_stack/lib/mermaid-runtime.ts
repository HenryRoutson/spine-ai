// AI : load mermaid from CDN — avoids Turbopack chunk failures on dynamic npm imports.
type MermaidRuntime = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

const MERMAID_SCRIPT = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"

let loadPromise: Promise<MermaidRuntime> | null = null

export function loadMermaidRuntime(): Promise<MermaidRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mermaid is client-only"))
  }

  const w = window as Window & { mermaid?: MermaidRuntime }
  if (w.mermaid) return Promise.resolve(w.mermaid)

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${MERMAID_SCRIPT}"]`)
      if (existing) {
        existing.addEventListener("load", () => {
          if (w.mermaid) resolve(w.mermaid)
          else reject(new Error("Mermaid missing after load"))
        })
        existing.addEventListener("error", () => reject(new Error("Mermaid script failed")))
        return
      }

      const script = document.createElement("script")
      script.src = MERMAID_SCRIPT
      script.async = true
      script.onload = () => {
        if (w.mermaid) resolve(w.mermaid)
        else reject(new Error("Mermaid missing after load"))
      }
      script.onerror = () => reject(new Error("Mermaid script failed"))
      document.head.appendChild(script)
    })
  }

  return loadPromise
}
