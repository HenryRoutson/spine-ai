"use client"

import { loader } from "@monaco-editor/react"
import type { Monaco } from "@monaco-editor/react"

// AI : CSP blocks cdn.jsdelivr.net — serve Monaco from public/monaco/vs (see ensure_monaco_public.mjs).
loader.config({ paths: { vs: "/monaco/vs" } })

let monacoTsConfigured = false

// AI : provider templates reference process.env — give Monaco TS a minimal Node-ish lib in-browser.
export function ensureMonacoTypeScriptEnv(monaco: Monaco): void {
  if (monacoTsConfigured) return
  monacoTsConfigured = true

  const ts = monaco.languages.typescript
  const defaults = ts.typescriptDefaults

  defaults.setCompilerOptions({
    ...defaults.getCompilerOptions(),
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    noEmit: true,
    strict: false,
  })

  defaults.addExtraLib(
    [
      "declare const process: { env: Record<string, string | undefined> };",
      "declare function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;",
    ].join("\n"),
    "file:///forge-monaco-env.d.ts",
  )
}
