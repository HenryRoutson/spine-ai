import { downloadBlob } from "@/lib/download-blob"
import { collectPageCss, copyFormState, cssVarsFrom, exportableIframes } from "@/lib/html-export-dom"
import { RUN_HTML_EXPORT_ROOT_ATTR, RUN_HTML_EXPORT_SKIP_ATTR } from "@/lib/html-export-mark"
import { htmlPagerBootScript } from "@/lib/html-pager"
import { htmlPopupExpandBootScript } from "@/lib/html-popup"
import {
  standaloneDocument,
  standaloneFontCss,
  standaloneFontVarsCss,
  standalonePageShellCss,
  withStandaloneFonts,
} from "@/lib/standalone-html"
import {
  injectJsonViewerSnapshot,
  jsonViewerExportReady,
  jsonViewerSnapshotFromExport,
  type JsonViewerExportState,
} from "@shared/json-viewer/snapshot"
import type { PipelineRun } from "@/lib/types"

// AI : shareable HTML is a clone of the on-screen run pane (styles + code + JSON viewers).
// AI : TODO (media-view-C-export) — snapshot spine-view iframes (/viewers/*.html + /visualizers/:id.html) like json-viewer.

function isJsonViewerIframe(iframe: HTMLIFrameElement): boolean {
  const src = iframe.getAttribute("src") ?? iframe.src ?? ""
  return src.includes("json-viewer.html")
  // AI : TODO (media-view-C-export) — also match /viewers/ and /visualizers/ embed iframes.
}

function readJsonViewerExport(iframe: HTMLIFrameElement): JsonViewerExportState | null {
  try {
    const w = iframe.contentWindow as (Window & { __JSON_VIEWER_EXPORT__?: () => JsonViewerExportState }) | null
    const fn = w?.__JSON_VIEWER_EXPORT__
    if (typeof fn !== "function") return null
    return fn()
  } catch {
    return null
  }
}

async function waitForJsonViewerExport(iframe: HTMLIFrameElement): Promise<JsonViewerExportState | null> {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    const data = readJsonViewerExport(iframe)
    if (jsonViewerExportReady(data)) return data
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  const last = readJsonViewerExport(iframe)
  return jsonViewerExportReady(last) ? last : null
}

async function hydrateOneIframe(
  src: HTMLIFrameElement,
  dst: HTMLIFrameElement,
  jvTemplate: string,
): Promise<void> {
  const height = Math.max(Math.round(src.getBoundingClientRect().height), 160)
  dst.style.width = "100%"
  dst.style.height = `${height}px`
  dst.removeAttribute("src")
  dst.removeAttribute("srcdoc")
  if (!isJsonViewerIframe(src)) {
    try {
      const doc = src.contentDocument
      if (doc?.documentElement) dst.srcdoc = `<!doctype html>${doc.documentElement.outerHTML}`
    } catch {
      /* cross-origin */
    }
    return
  }
  const exported = await waitForJsonViewerExport(src)
  if (!exported) {
    const fallback = document.createElement("div")
    fallback.className =
      "rounded-md border border-border bg-muted/20 p-3 font-mono text-[11px] text-muted-foreground"
    fallback.textContent = "JSON viewer could not be copied"
    dst.replaceWith(fallback)
    return
  }
  dst.srcdoc = injectJsonViewerSnapshot(
    jvTemplate,
    jsonViewerSnapshotFromExport(exported, { title: src.title || "JSON" }),
  )
}

async function hydrateCloneIframes(
  sourceRoot: Element,
  cloneRoot: Element,
  jvTemplate: string,
): Promise<void> {
  const srcIframes = exportableIframes(sourceRoot)
  const dstIframes = exportableIframes(cloneRoot)
  const n = Math.min(srcIframes.length, dstIframes.length)
  const templated = withStandaloneFonts(jvTemplate)
  await Promise.all(
    Array.from({ length: n }, (_, i) => hydrateOneIframe(srcIframes[i]!, dstIframes[i]!, templated)),
  )
}

async function serializeRunPane(
  root: HTMLElement,
  jvTemplate: string,
  title: string,
  runId: string,
): Promise<string> {
  const clone = root.cloneNode(true) as HTMLElement
  copyFormState(root, clone)
  clone.querySelectorAll(`[${RUN_HTML_EXPORT_SKIP_ATTR}]`).forEach((el) => el.remove())
  clone.removeAttribute(RUN_HTML_EXPORT_ROOT_ATTR)
  await hydrateCloneIframes(root, clone, jvTemplate)

  const htmlEl = document.documentElement
  const width = Math.max(Math.round(root.getBoundingClientRect().width), 320)
  return standaloneDocument({
    title: `${title} · Run ${runId}`,
    htmlClass: htmlEl.getAttribute("class") ?? "",
    colorScheme: htmlEl.dataset.colorScheme,
    bodyClass: document.body.getAttribute("class") ?? "font-sans antialiased",
    styles: [
      standaloneFontCss(),
      collectPageCss(),
      `html {\n${cssVarsFrom(htmlEl)}\n}\n${standaloneFontVarsCss(true)}\n${standalonePageShellCss(width)}`,
    ],
    bodyHtml: `<div id="run-html-export">${clone.outerHTML}</div>`,
    scripts: [htmlPagerBootScript(), htmlPopupExpandBootScript()],
  })
}

let templatePromise: Promise<string> | null = null

async function loadJsonViewerTemplate(): Promise<string> {
  if (!templatePromise) {
    templatePromise = fetch("/json-viewer.html", { cache: "no-cache" }).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load JSON viewer (${res.status})`)
      return res.text()
    })
  }
  try {
    return await templatePromise
  } catch (err) {
    templatePromise = null
    throw err
  }
}

export function canExportRunHtml(run: PipelineRun): boolean {
  return run.steps.length > 0
}

export function findRunHtmlExportRoot(from?: Element | null): HTMLElement | null {
  if (from) {
    const closest = from.closest(`[${RUN_HTML_EXPORT_ROOT_ATTR}]`)
    if (closest instanceof HTMLElement) return closest
  }
  const nodes = document.querySelectorAll(`[${RUN_HTML_EXPORT_ROOT_ATTR}]`)
  for (const el of nodes) {
    if (el instanceof HTMLElement && el.getClientRects().length > 0) return el
  }
  return null
}

export async function downloadInferenceHtml(
  run: PipelineRun,
  filename: string,
  opts?: { title?: string; from?: Element | null },
): Promise<void> {
  const root = findRunHtmlExportRoot(opts?.from)
  if (!root) throw new Error("Run view is not on screen")
  const template = await loadJsonViewerTemplate()
  const html = await serializeRunPane(root, template, opts?.title ?? "Inference", run.id)
  downloadBlob(filename, html, "text/html;charset=utf-8")
}
