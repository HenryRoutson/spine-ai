import ts from "typescript"
import { applyHostedSiteTokens } from "@/lib/hosted-site"
import { ensureHostedSiteReactCss, htmlSiteToReactFiles, type hosted_site_react_bundle } from "@/lib/hosted-site-react"
import type { HostedSiteOptions, HostedSiteReactFile } from "@/lib/shared-link-types"

export type hosted_site_react_compile_result =
  | { ok: true; bundle: hosted_site_react_bundle }
  | { ok: false; error: string }

const REACT_SPECS = new Set(["react", "react-dom", "react-dom/client", "react/jsx-runtime"])

function posixJoin(fromPath: string, spec: string): string {
  const fromDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : ""
  const joined = fromDir ? `${fromDir}/${spec}` : spec
  const parts: string[] = []
  for (const part of joined.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") parts.pop()
    else parts.push(part)
  }
  return parts.join("/")
}

function resolveLocal(fromPath: string, spec: string, files: Set<string>): string | null {
  const base = posixJoin(fromPath, spec)
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ]
  return candidates.find((path) => files.has(path)) ?? null
}

function shouldCompile(path: string): boolean {
  if (path.endsWith(".d.ts")) return false
  if (path === "src/main.tsx" || path === "src/main.ts") return false
  if (/RunPipeline\.(t|j)sx?$/.test(path)) return false
  if (!path.startsWith("src/")) return false
  return /\.(tsx|ts|jsx|js)$/.test(path)
}

function rewriteRequires(code: string, fromPath: string, files: Set<string>): string {
  return code.replace(/require\((['"])([^'"]+)\1\)/g, (_m, _q, spec: string) => {
    if (REACT_SPECS.has(spec)) return `require(${JSON.stringify(spec)})`
    if (spec.endsWith(".css") || spec === "./index.css") return `require("__hs_css")`
    if (!spec.startsWith(".")) {
      throw new Error(`Unsupported import "${spec}" in ${fromPath} — use local src/ files or react`)
    }
    const resolved = resolveLocal(fromPath, spec, files)
    if (resolved && /RunPipeline\.(t|j)sx?$/.test(resolved)) return `require("__hs_run")`
    if (spec.includes("RunPipeline")) return `require("__hs_run")`
    if (!resolved) throw new Error(`Cannot find module "${spec}" from ${fromPath}`)
    if (resolved.endsWith(".css")) return `require("__hs_css")`
    return `require(${JSON.stringify(resolved)})`
  })
}

function transpileFile(source: string, fileName: string): string {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      importHelpers: false,
      isolatedModules: true,
      skipLibCheck: true,
      strict: false,
    },
    fileName,
    reportDiagnostics: true,
  })
  const diagnostic = result.diagnostics?.[0]
  if (diagnostic) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    throw new Error(`${fileName}: ${message}`)
  }
  return result.outputText
}

export function compileHostedSiteReactProject(
  files: HostedSiteReactFile[],
  options?: HostedSiteOptions,
): hosted_site_react_compile_result {
  const tree = files.length > 0 ? files : options ? htmlSiteToReactFiles(options) : []
  const branded = options
    ? tree.map((file) => ({ ...file, contents: applyHostedSiteTokens(file.contents, options.brand) }))
    : tree
  const byPath = new Map(branded.map((file) => [file.path, file.contents]))
  const fileSet = new Set(byPath.keys())
  const entry = fileSet.has("src/App.tsx") ? "src/App.tsx" : fileSet.has("App.tsx") ? "App.tsx" : null
  if (!entry) return { ok: false, error: "React project needs src/App.tsx" }

  const css = ensureHostedSiteReactCss(
    [...byPath.entries()]
      .filter(([path]) => path.endsWith(".css"))
      .map(([, contents]) => contents)
      .join("\n"),
  )

  try {
    const modules: Record<string, string> = {}
    for (const [path, source] of byPath) {
      if (!shouldCompile(path)) continue
      const rewritten = rewriteRequires(transpileFile(source, path), path, fileSet)
      modules[path] = rewritten
    }
    if (!modules[entry]) return { ok: false, error: "src/App.tsx did not compile" }
    return { ok: true, bundle: { modules, entry, css } }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
