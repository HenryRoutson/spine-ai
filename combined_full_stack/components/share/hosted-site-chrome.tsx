"use client"

import { useMemo, type CSSProperties, type ReactNode } from "react"
import {
  compileHostedSiteAuthHtml,
  compileHostedSiteHtml,
  hostedSiteBrandVars,
  type hosted_site_surface,
} from "@/lib/hosted-site"
import type { HostedSiteOptions } from "@/lib/shared-link-types"

export function HostedSiteChrome({
  options,
  surface = "app",
  children,
}: {
  options: HostedSiteOptions
  surface?: hosted_site_surface
  children: ReactNode
}) {
  const compiled = useMemo(
    () => (surface === "signin" ? compileHostedSiteAuthHtml(options) : compileHostedSiteHtml(options)),
    [options, surface],
  )
  const company = options.brand.companyName.trim() || "Your company"
  const slotClass = surface === "signin" ? "hs-auth-slot" : "hs-run-slot"

  return (
    <div className="hs-root" style={hostedSiteBrandVars(options.brand) as CSSProperties}>
      <style>{compiled.css}</style>
      {compiled.before ? (
        <div dangerouslySetInnerHTML={{ __html: compiled.before }} />
      ) : null}
      <div className={slotClass}>{children}</div>
      {compiled.after ? (
        <div dangerouslySetInnerHTML={{ __html: compiled.after }} />
      ) : null}
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
