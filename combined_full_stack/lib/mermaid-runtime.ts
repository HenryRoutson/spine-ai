// AI : npm ESM — CDN mermaid.min.js hits Monaco's AMD define and never sets window.mermaid.
type MermaidRuntime = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

let loadPromise: Promise<MermaidRuntime> | null = null

export function loadMermaidRuntime(): Promise<MermaidRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mermaid is client-only"))
  }

  const w = window as Window & { mermaid?: MermaidRuntime }
  if (w.mermaid) return Promise.resolve(w.mermaid)

  if (!loadPromise) {
    loadPromise = import("mermaid")
      .then((mod) => {
        const mermaid = mod.default
        w.mermaid = mermaid
        return mermaid
      })
      .catch((err) => {
        loadPromise = null
        throw err
      })
  }

  return loadPromise
}
