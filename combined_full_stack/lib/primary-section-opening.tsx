"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AppPrimarySection } from "@/components/app-primary-nav"

type PrimarySectionOpeningContextValue = {
  openingSection: AppPrimarySection | null
  beginOpening: (section: AppPrimarySection) => void
  markSectionReady: (section: AppPrimarySection) => void
}

const PrimarySectionOpeningContext = createContext<PrimarySectionOpeningContextValue | null>(null)

export function PrimarySectionOpeningProvider({ children }: { children: ReactNode }) {
  const [openingSection, setOpeningSection] = useState<AppPrimarySection | null>(null)

  const beginOpening = useCallback((section: AppPrimarySection) => {
    setOpeningSection(section)
  }, [])

  const markSectionReady = useCallback((section: AppPrimarySection) => {
    setOpeningSection((current) => (current === section ? null : current))
  }, [])

  useEffect(() => {
    if (!openingSection) return
    const timeout = window.setTimeout(() => setOpeningSection(null), 15_000)
    return () => window.clearTimeout(timeout)
  }, [openingSection])

  const value = useMemo(
    () => ({ openingSection, beginOpening, markSectionReady }),
    [openingSection, beginOpening, markSectionReady],
  )

  return (
    <PrimarySectionOpeningContext.Provider value={value}>
      {children}
    </PrimarySectionOpeningContext.Provider>
  )
}

export function usePrimarySectionOpening() {
  const ctx = useContext(PrimarySectionOpeningContext)
  if (!ctx) throw new Error("usePrimarySectionOpening requires PrimarySectionOpeningProvider")
  return ctx
}

export function useOptionalPrimarySectionOpening() {
  return useContext(PrimarySectionOpeningContext)
}

// AI : panels call this on mount so the matching primary-nav tab stops spinning.
export function useMarkPrimarySectionReady(section: AppPrimarySection) {
  const ctx = useOptionalPrimarySectionOpening()
  useLayoutEffect(() => {
    ctx?.markSectionReady(section)
  }, [ctx, section])
}

export function wrapPrimarySectionChange(
  section: AppPrimarySection,
  activeSection: AppPrimarySection,
  beginOpening: (section: AppPrimarySection) => void,
  navigate: () => void,
) {
  if (section !== activeSection) beginOpening(section)
  navigate()
}
