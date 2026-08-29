import { DEFAULT_HOSTED_SITE_HTML, defaultHostedSiteCss } from "@/lib/hosted-site-defaults"
import { splitHostedSiteSlots } from "@/lib/hosted-site-slots"
import type { HostedSiteOptions, HostedSiteReactFile } from "@/lib/shared-link-types"
import { DEFAULT_WEBSITE_PIPELINE_ALIAS } from "@/lib/website-pipelines"

const MAX_REACT_FILES = 32
const MAX_REACT_FILE_BYTES = 50_000

export function normalizeHostedSiteReactFiles(raw: unknown): HostedSiteReactFile[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: HostedSiteReactFile[] = []
  for (const row of raw.slice(0, MAX_REACT_FILES)) {
    if (!row || typeof row !== "object") continue
    const rec = row as { path?: unknown; contents?: unknown }
    const path = typeof rec.path === "string" ? rec.path.trim().replace(/^\/+/, "") : ""
    if (!path || path.includes("..") || used.has(path)) continue
    if (!/^[a-zA-Z0-9._/-]+$/.test(path) || path.length > 200) continue
    const contents = typeof rec.contents === "string" ? rec.contents.slice(0, MAX_REACT_FILE_BYTES) : ""
    used.add(path)
    out.push({ path, contents })
  }
  return out
}

function jsString(value: string): string {
  return JSON.stringify(value)
}

// AI : HTML preview always prepends defaultHostedSiteCss(); React must too or Tailwind preflight flattens the page.
export function ensureHostedSiteReactCss(css: string): string {
  if (css.includes(".hs-nav") && css.includes(".hs-hero")) return css
  return `${defaultHostedSiteCss()}\n${css}`.trim()
}

export function htmlSiteToReactFiles(options: HostedSiteOptions): HostedSiteReactFile[] {
  const html = options.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML
  const css = options.customCss.trim()
  const parts = splitHostedSiteSlots(html).map((seg) => {
    if (seg.kind === "html") return `{ kind: "html", html: ${jsString(seg.html)} }`
    const alias = seg.alias ?? DEFAULT_WEBSITE_PIPELINE_ALIAS
    if (seg.slot === "run") return `{ kind: "run", alias: ${jsString(alias)} }`
    if (seg.slot === "sql") return `{ kind: "sql", table: ${jsString(seg.alias ?? "")} }`
    if (seg.slot === "action") return `{ kind: "action", alias: ${jsString(alias)} }`
    if (seg.slot === "table") {
      return `{ kind: "slot", slot: ${jsString(seg.alias ? `table:${seg.alias}` : "table")} }`
    }
    return `{ kind: "slot", slot: ${jsString(seg.slot)} }`
  })
  return [
    {
      path: "src/App.tsx",
      contents: `import { RunPipeline } from "./components/RunPipeline"
import { HostedSlot } from "./components/HostedSlot"

const parts = [
  ${parts.join(",\n  ")}
] as const

export default function App() {
  return (
    <div className="hs-root app">
      {parts.map((part, i) => {
        if (part.kind === "html") {
          return <div key={i} dangerouslySetInnerHTML={{ __html: part.html }} />
        }
        if (part.kind === "run") return <RunPipeline key={i} alias={part.alias} />
        if (part.kind === "sql") return <div key={i} data-spine-sql={part.table} />
        if (part.kind === "action") return <div key={i} data-spine-action={part.alias} />
        return <HostedSlot key={i} slot={part.slot} />
      })}
    </div>
  )
}
`,
    },
    {
      path: "src/main.tsx",
      contents: `import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
    },
    {
      path: "src/index.css",
      contents: ensureHostedSiteReactCss(css),
    },
    {
      path: "src/components/RunPipeline.tsx",
      contents: `export function RunPipeline({ alias }: { alias: string }) {
  return (
    <div data-spine-run={alias}>
      Pipeline: {alias}
    </div>
  )
}
`,
    },
    {
      path: "src/components/HostedSlot.tsx",
      contents: `export function HostedSlot({ slot }: { slot: string }) {
  return <div data-spine-slot={slot} />
}
`,
    },
    {
      path: "index.html",
      contents: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "package.json",
      contents: `{
  "name": "hosted-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.7.2",
    "vite": "^6.0.0"
  }
}
`,
    },
    {
      path: "vite.config.ts",
      contents: `import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
})
`,
    },
    {
      path: "tsconfig.json",
      contents: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
    },
  ]
}

export function reactFilesLookOk(files: HostedSiteReactFile[]): boolean {
  return files.some((f) => f.path === "src/App.tsx" && f.contents.includes("RunPipeline"))
}

export type hosted_site_react_bundle = {
  modules: Record<string, string>
  entry: string
  css: string
}

export type react_preview_node =
  | { kind: "html"; html: string }
  | { kind: "run"; alias: string }
  | { kind: "sql"; table: string }
  | { kind: "action"; alias: string }
  | { kind: "slot"; slot: string }

const PART_ITEM_RE =
  /\{\s*kind:\s*"(html|run|slot|sql|action)"\s*,\s*(?:html|alias|slot|table):\s*("(?:\\.|[^"\\])*")\s*\}/g
const RUN_TAG_RE = /<RunPipeline\s+alias=["']([^"']+)["']\s*\/>/g

export function parseReactPreviewTree(files: HostedSiteReactFile[]): {
  css: string
  nodes: react_preview_node[]
} {
  const css = ensureHostedSiteReactCss(files.find((f) => f.path.endsWith("index.css"))?.contents ?? "")
  const app = files.find((f) => f.path === "src/App.tsx")?.contents ?? ""
  return { css, nodes: parseAppPreviewNodes(app) }
}

function parseAppPreviewNodes(app: string): react_preview_node[] {
  const block = app.match(/const parts = \[([\s\S]*?)\] as const/)
  if (block?.[1]) {
    const nodes: react_preview_node[] = []
    PART_ITEM_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = PART_ITEM_RE.exec(block[1]))) {
      const kind = match[1]
      let value = ""
      try {
        value = JSON.parse(match[2]) as string
      } catch {
        continue
      }
      if (kind === "html") nodes.push({ kind: "html", html: value })
      else if (kind === "run") nodes.push({ kind: "run", alias: value || DEFAULT_WEBSITE_PIPELINE_ALIAS })
      else if (kind === "sql") nodes.push({ kind: "sql", table: value })
      else if (kind === "action") nodes.push({ kind: "action", alias: value || DEFAULT_WEBSITE_PIPELINE_ALIAS })
      else nodes.push({ kind: "slot", slot: value })
    }
    if (nodes.length) return nodes
  }
  const nodes: react_preview_node[] = []
  RUN_TAG_RE.lastIndex = 0
  let tag: RegExpExecArray | null
  let cursor = 0
  while ((tag = RUN_TAG_RE.exec(app))) {
    const before = app.slice(cursor, tag.index).trim()
    if (before) nodes.push({ kind: "html", html: `<pre class="hs-react-src">${escapePreview(before)}</pre>` })
    nodes.push({ kind: "run", alias: tag[1] || DEFAULT_WEBSITE_PIPELINE_ALIAS })
    cursor = tag.index + tag[0].length
  }
  return nodes.length ? nodes : [{ kind: "run", alias: DEFAULT_WEBSITE_PIPELINE_ALIAS }]
}

function escapePreview(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
