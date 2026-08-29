"use client"

import { Component, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react"
import { hostedSiteBrandVars } from "@/lib/hosted-site"
import { ensureHostedSiteReactCss, htmlSiteToReactFiles, type hosted_site_react_bundle } from "@/lib/hosted-site-react"
import { instantiateHostedSiteReactApp } from "@/lib/hosted-site-react-runtime"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { DEFAULT_WEBSITE_PIPELINE_ALIAS } from "@/lib/website-pipelines"
import type { hosted_site_widget_slot } from "@/lib/hosted-site-slots"

function HostRunPipeline({
  alias,
  runByAlias,
}: {
  alias: string
  runByAlias?: Record<string, ReactNode>
}) {
  const key = alias || DEFAULT_WEBSITE_PIPELINE_ALIAS
  return (
    <div data-spine-run={key}>
      {runByAlias?.[key] ?? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          Pipeline · {key}
        </div>
      )}
    </div>
  )
}

function HostSlot({
  slot,
  tableByAlias,
  slots,
}: {
  slot: string
  tableByAlias?: Record<string, ReactNode>
  slots?: Partial<Record<hosted_site_widget_slot, ReactNode>>
}) {
  if (slot.startsWith("table:")) {
    const name = slot.slice("table:".length)
    return (
      <>
        {tableByAlias?.[name] ?? (
          <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
            Table · {name || "structure"}
          </div>
        )}
      </>
    )
  }
  const named = slot as hosted_site_widget_slot
  if (slots?.[named]) return <>{slots[named]}</>
  return <div data-spine-slot={slot} />
}

class ReactPreviewErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <p className="px-3 py-4 font-mono text-[11px] text-destructive">
          {this.state.error}
        </p>
      )
    }
    return this.props.children
  }
}

export function HostedSiteReactPreview({
  options,
  runByAlias,
  tableByAlias,
  slots,
  bundle: bundleProp,
  compileError: compileErrorProp,
}: {
  options: HostedSiteOptions
  runByAlias?: Record<string, ReactNode>
  tableByAlias?: Record<string, ReactNode>
  slots?: Partial<Record<hosted_site_widget_slot, ReactNode>>
  bundle?: hosted_site_react_bundle | null
  compileError?: string | null
}) {
  const files = options.reactFiles.length > 0 ? options.reactFiles : htmlSiteToReactFiles(options)
  const filesKey = useMemo(() => files.map((f) => `${f.path}:${f.contents}`).join("\0"), [files])
  const optionsRef = useRef(options)
  optionsRef.current = options
  const [fetched, setFetched] = useState<{ bundle: hosted_site_react_bundle | null; error: string | null }>({
    bundle: bundleProp ?? null,
    error: compileErrorProp ?? null,
  })

  useEffect(() => {
    if (bundleProp || compileErrorProp) {
      setFetched({ bundle: bundleProp ?? null, error: compileErrorProp ?? null })
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        const current = optionsRef.current
        const nextFiles = current.reactFiles.length > 0 ? current.reactFiles : htmlSiteToReactFiles(current)
        try {
          const res = await fetch(API_ROUTES.hostedSiteCompile, {
            method: "POST",
            headers: JSON_HEADERS,
            credentials: "same-origin",
            body: JSON.stringify({ files: nextFiles, brand: current.brand }),
          })
          const body = (await res.json().catch(() => null)) as
            | (hosted_site_react_bundle & { error?: string })
            | { error?: string }
            | null
          if (cancelled) return
          if (!res.ok || !body || !("modules" in body) || !body.modules) {
            setFetched({ bundle: null, error: (body && "error" in body && body.error) || "React compile failed" })
            return
          }
          setFetched({ bundle: body, error: null })
        } catch (err) {
          if (!cancelled) setFetched({ bundle: null, error: (err as Error).message })
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [bundleProp, compileErrorProp, filesKey])

  const bundle = bundleProp ?? fetched.bundle
  const error = compileErrorProp ?? fetched.error
  const css = ensureHostedSiteReactCss(bundle?.css ?? "")
  const mounted = useMemo((): { App: ComponentType | null; error: string | null } => {
    if (!bundle) return { App: null, error: null }
    try {
      const Run = (props: { alias: string }) => <HostRunPipeline alias={props.alias} runByAlias={runByAlias} />
      const Slot = (props: { slot: string }) => (
        <HostSlot slot={props.slot} tableByAlias={tableByAlias} slots={slots} />
      )
      return { App: instantiateHostedSiteReactApp(bundle, Run, Slot), error: null }
    } catch (err) {
      return { App: null, error: (err as Error).message }
    }
  }, [bundle, runByAlias, tableByAlias, slots])

  const PreviewApp = mounted.App
  return (
    <div className="hs-root hs-react-preview min-h-40" style={hostedSiteBrandVars(options.brand) as CSSProperties}>
      {css ? <style>{css}</style> : null}
      {error || mounted.error ? (
        <p className="px-3 py-4 font-mono text-[11px] text-destructive">{error || mounted.error}</p>
      ) : PreviewApp ? (
        <ReactPreviewErrorBoundary resetKey={filesKey}>
          <PreviewApp />
        </ReactPreviewErrorBoundary>
      ) : (
        <p className="px-3 py-4 text-[11px] text-muted-foreground">Compiling React project…</p>
      )}
    </div>
  )
}
