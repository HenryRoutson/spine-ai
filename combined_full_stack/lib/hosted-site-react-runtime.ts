import * as React from "react"
import type { ComponentType } from "react"
import type { hosted_site_react_bundle } from "@/lib/hosted-site-react"

export type hosted_site_run_pipeline = ComponentType<{ alias: string }>

// AI : SECURITY — owner-authored React, same trust as custom-code steps. Do not run untrusted third-party sites here.
export function instantiateHostedSiteReactApp(
  bundle: hosted_site_react_bundle,
  RunPipeline: hosted_site_run_pipeline,
): ComponentType {
  const cache: Record<string, unknown> = Object.create(null) as Record<string, unknown>
  const req = (id: string): unknown => {
    if (id === "react") return React
    if (id === "react/jsx-runtime") {
      return { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment }
    }
    if (id === "react-dom" || id === "react-dom/client") return {}
    if (id === "__hs_css") return {}
    if (id === "__hs_run") return { RunPipeline }
    const source = bundle.modules[id]
    if (typeof source !== "string") throw new Error(`Cannot find module ${id}`)
    if (cache[id] === undefined) {
      const module = { exports: {} as Record<string, unknown> }
      const fn = new Function("require", "module", "exports", "React", source)
      fn(req, module, module.exports, React)
      cache[id] = module.exports
    }
    return cache[id]
  }
  const mod = req(bundle.entry) as { default?: unknown; App?: unknown }
  const App = (mod?.default ?? mod?.App ?? mod) as unknown
  if (typeof App !== "function") throw new Error("src/App.tsx must default-export a component")
  return App as ComponentType
}
