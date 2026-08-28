"use client"

import { createContext, useContext, type CSSProperties, type ReactNode } from "react"
import { hostedFunctionResolvedColors, hostedFunctionTokenVars } from "@/lib/hosted-site"
import type { HostedSiteBrand } from "@/lib/shared-link-types"
import { cn } from "@/lib/utils"

export type HostedFunctionChromeValue = {
  theme: "light" | "dark"
  bg: string
  fg: string
  accent: string
}

const HostedFunctionChromeContext = createContext<HostedFunctionChromeValue | null>(null)

export function useHostedFunctionChrome(): HostedFunctionChromeValue | null {
  return useContext(HostedFunctionChromeContext)
}

export function HostedFunctionChrome({
  brand,
  children,
  className,
}: {
  brand: HostedSiteBrand
  children: ReactNode
  className?: string
}) {
  const theme = brand.functionTheme === "dark" ? "dark" : "light"
  const colors = hostedFunctionResolvedColors(brand)
  // AI : iframe JSON viewer reads this so table/JSON chrome matches the panel
  const value: HostedFunctionChromeValue = {
    theme,
    bg: colors.bg,
    fg: colors.fg,
    accent: colors.accent,
  }
  return (
    <HostedFunctionChromeContext.Provider value={value}>
      <div
        className={cn("hs-fn", theme, className)}
        data-spine-id="site.function-chrome"
        style={hostedFunctionTokenVars(brand) as CSSProperties}
      >
        {children}
      </div>
    </HostedFunctionChromeContext.Provider>
  )
}
