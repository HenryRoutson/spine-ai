"use client"

import { useMemo, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode } from "react"
import {
  compileHostedSiteAuthHtml,
  compileHostedSiteHtml,
  compileHostedSitePageHtml,
  hostedSiteBrandVars,
  type hosted_site_surface,
} from "@/lib/hosted-site"
import {
  HOSTED_SITE_IGNORED_SLOT_SELECTOR,
  HOSTED_SITE_SLOT_CLASS,
  groupHostedActionSlots,
  hostedSiteHasPrimarySlot,
  hostedSitePrimarySlot,
  type hosted_site_widget_slot,
} from "@/lib/hosted-site-slots"
import {
  HS_PREVIEW_MESSAGE_SOURCE,
  cssPathFromElement,
  postHsPreviewMessage,
  previewHtmlRoot,
  snippetFromElement,
  type hs_preview_css_path,
  type hs_preview_hs_id,
} from "@/lib/hosted-site-select"
import type { HostedSiteOptions } from "@/lib/shared-link-types"

export function HostedSiteChrome({
  options,
  surface = "app",
  pageHtml,
  children,
  slots,
  runByAlias,
  sqlByTable,
  actionByAlias,
  tableByAlias,
  editable = false,
}: {
  options: HostedSiteOptions
  surface?: hosted_site_surface
  // AI : extra pages[] preview — compiles this HTML instead of customHtml / authHtml.
  pageHtml?: string
  children?: ReactNode
  slots?: Partial<Record<hosted_site_widget_slot, ReactNode>>
  runByAlias?: Record<string, ReactNode>
  sqlByTable?: Record<string, ReactNode>
  actionByAlias?: Record<string, ReactNode>
  tableByAlias?: Record<string, ReactNode>
  editable?: boolean
}) {
  const compiled = useMemo(() => {
    const opts = { preview: editable }
    if (pageHtml != null) return compileHostedSitePageHtml(options, pageHtml, opts)
    return surface === "signin" ? compileHostedSiteAuthHtml(options, opts) : compileHostedSiteHtml(options, opts)
  }, [options, surface, pageHtml, editable])
  const renderSegments = useMemo(() => groupHostedActionSlots(compiled.segments), [compiled.segments])
  const company = options.brand.companyName.trim() || "Your company"
  const primary = hostedSitePrimarySlot(surface)
  const hasPrimary = hostedSiteHasPrimarySlot(compiled.segments, surface)

  function slotNode(slot: hosted_site_widget_slot, alias?: string): ReactNode {
    if (slot === "run") {
      const key = alias || "run"
      if (runByAlias?.[key]) return runByAlias[key]
      if (key !== "run") {
        return (
          <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
            Pipeline · {key}
          </div>
        )
      }
    }
    if (slot === "sql") {
      const table = alias || ""
      if (table && sqlByTable?.[table]) return sqlByTable[table]
      return slots?.sql ?? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          SQL · {table || "table"}
        </div>
      )
    }
    if (slot === "action") {
      const key = alias || "run"
      if (actionByAlias?.[key]) return actionByAlias[key]
      return slots?.action ?? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          Action · {key}
        </div>
      )
    }
    if (slot === "table") {
      const key = alias || ""
      if (key && tableByAlias?.[key]) return tableByAlias[key]
      return (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          Table · {key || "structure"}
        </div>
      )
    }
    return slots?.[slot] ?? (slot === primary ? children : null)
  }

  function onPreviewClick(e: MouseEvent<HTMLDivElement>) {
    if (!editable) return
    const target = e.target
    if (!(target instanceof Element)) return
    if (target.closest(HOSTED_SITE_IGNORED_SLOT_SELECTOR)) return
    const tagged = target.closest("[data-hs-id]")
    if (!tagged || !e.currentTarget.contains(tagged)) return
    e.preventDefault()
    const hsId = tagged.getAttribute("data-hs-id")
    if (!hsId) return
    const htmlRoot = previewHtmlRoot(tagged)
    const cssPath = (htmlRoot ? cssPathFromElement(tagged, htmlRoot) : tagged.tagName.toLowerCase()) as hs_preview_css_path
    e.currentTarget.querySelectorAll("[data-hs-selected]").forEach((n) => n.removeAttribute("data-hs-selected"))
    tagged.setAttribute("data-hs-selected", "")
    tagged.setAttribute("contenteditable", "true")
    if (tagged instanceof HTMLElement) tagged.focus()
    postHsPreviewMessage({
      source: HS_PREVIEW_MESSAGE_SOURCE,
      kind: "select",
      cssPath,
      hsId: hsId as hs_preview_hs_id,
      snippet: snippetFromElement(tagged),
      text: tagged.textContent?.trim() ?? "",
    })
  }

  function onPreviewBlur(e: FocusEvent<HTMLDivElement>) {
    if (!editable) return
    const tagged = e.target
    if (!(tagged instanceof HTMLElement) || !tagged.hasAttribute("data-hs-id")) return
    if (tagged.getAttribute("contenteditable") !== "true") return
    const hsId = tagged.getAttribute("data-hs-id")
    if (!hsId) return
    tagged.removeAttribute("contenteditable")
    const htmlRoot = previewHtmlRoot(tagged)
    const cssPath = (htmlRoot ? cssPathFromElement(tagged, htmlRoot) : tagged.tagName.toLowerCase()) as hs_preview_css_path
    postHsPreviewMessage({
      source: HS_PREVIEW_MESSAGE_SOURCE,
      kind: "inline",
      cssPath,
      hsId: hsId as hs_preview_hs_id,
      text: tagged.textContent?.trim() ?? "",
    })
  }

  return (
    <div
      className="hs-root"
      style={hostedSiteBrandVars(options.brand) as CSSProperties}
      onClick={editable ? onPreviewClick : undefined}
      onBlur={editable ? onPreviewBlur : undefined}
    >
      {editable ? (
        <style>{`${compiled.css}
[data-hs-selected] { outline: 2px solid var(--hs-accent); outline-offset: 2px; cursor: text; }`}</style>
      ) : (
        <style>{compiled.css}</style>
      )}
      {renderSegments.map((seg, i) => {
        if (seg.kind === "html") {
          return <div key={`html-${i}`} dangerouslySetInnerHTML={{ __html: seg.html }} />
        }
        if (seg.kind === "action-row") {
          return (
            <div key={`action-row-${i}`} className="hs-action-row">
              {seg.slots.map((slot, j) => (
                <div key={`slot-${slot.slot}-${slot.alias ?? "run"}-${j}`} className={HOSTED_SITE_SLOT_CLASS.action}>
                  {slotNode(slot.slot, slot.alias)}
                </div>
              ))}
            </div>
          )
        }
        if (seg.kind === "run-row") {
          return (
            <div key={`run-row-${i}`} className="hs-split">
              {seg.slots.map((slot, j) => (
                <div key={`slot-${slot.slot}-${slot.alias ?? "run"}-${j}`} className={HOSTED_SITE_SLOT_CLASS.run}>
                  {slotNode(slot.slot, slot.alias)}
                </div>
              ))}
            </div>
          )
        }
        return (
          <div key={`slot-${seg.slot}-${i}`} className={HOSTED_SITE_SLOT_CLASS[seg.slot]}>
            {slotNode(seg.slot, seg.alias)}
          </div>
        )
      })}
      {hasPrimary ? null : <div className={HOSTED_SITE_SLOT_CLASS[primary]}>{slotNode(primary)}</div>}
      {options.hideSpineFooter ? null : (
        <p className="hs-foot">
          {company} · pipeline hosted by{" "}
          <a href="/" rel="noreferrer">
            Spine
          </a>
        </p>
      )}
    </div>
  )
}
