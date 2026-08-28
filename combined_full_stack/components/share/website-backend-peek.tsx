"use client"

import { Inference } from "@/components/inference"

// AI : website Building → run a bound function (not a duplicate schema studio).
export function WebsiteBackendPeek() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Inference simple />
    </div>
  )
}
