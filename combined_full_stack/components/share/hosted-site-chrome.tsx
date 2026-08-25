"use client"

import type { CSSProperties, ReactNode } from "react"
import { compileHostedSiteHtml, hostedSiteBrandVars } from "@/lib/hosted-site"
import type { HostedSiteOptions } from "@/lib/shared-link-types"

export function HostedSiteChrome({
  options,
  children,
}: {
  options: HostedSiteOptions
  children: ReactNode
}) {
  const compiled = compileHostedSiteHtml(options)
  const company = options.brand.companyName.trim() || "Your company"

  return (
    <div className="hs-root" style={hostedSiteBrandVars(options.brand) as CSSProperties}>
      <style>{compiled.css}</style>
      {compiled.before ? (
        <div dangerouslySetInnerHTML={{ __html: compiled.before }} />
      ) : null}
      <div className="hs-run-slot">{children}</div>
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
