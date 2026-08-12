"use client"

import type { ReactNode } from "react"
import { AppPrimaryNav } from "@/components/app-primary-nav"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"
import { SpineLogoBox } from "@/components/spine-mark"
import { LANDING_PAGE_URL } from "@/lib/app-nav-config"
import { AppMode } from "@/lib/app-mode-nav"
import { LEGAL } from "@shared/legal/site"

type AppChromeHeaderProps = {
  mode: AppMode
  primarySection: AppPrimarySection
  onPrimarySectionChange: (section: AppPrimarySection) => void
  openingSection?: AppPrimarySection | null
  projectSlot?: ReactNode
  trailing?: ReactNode
  embed?: boolean
}

export function AppChromeHeader({
  mode,
  primarySection,
  onPrimarySectionChange,
  openingSection = null,
  projectSlot,
  trailing,
  embed = false,
}: AppChromeHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      {embed ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <SpineLogoBox />
          <div className="hidden leading-tight sm:block">
            <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
          </div>
        </div>
      ) : (
        <a
          href={LANDING_PAGE_URL}
          title="Back to landing page"
          className="flex shrink-0 items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
        >
          <SpineLogoBox />
          <div className="hidden leading-tight sm:block">
            <h1 className="text-sm font-semibold tracking-tight">{LEGAL.productName}</h1>
          </div>
        </a>
      )}

      <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:block" />

      <AppPrimaryNav value={primarySection} onChange={onPrimarySectionChange} openingSection={openingSection} />

      {primarySection === AppPrimarySection.Build && projectSlot ? (
        <>
          <div className="h-6 w-px shrink-0 bg-border" />
          {projectSlot}
        </>
      ) : null}

      {trailing ? <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </header>
  )
}
