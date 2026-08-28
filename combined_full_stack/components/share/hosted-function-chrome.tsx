"use client"

import type { CSSProperties, ReactNode } from "react"
import { hostedFunctionTokenVars } from "@/lib/hosted-site"
import type { HostedSiteBrand } from "@/lib/shared-link-types"
import { cn } from "@/lib/utils"

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
  return (
    <div
      className={cn("hs-fn", theme, className)}
      data-spine-id="site.function-chrome"
      style={hostedFunctionTokenVars(brand) as CSSProperties}
    >
      {children}
    </div>
  )
}
