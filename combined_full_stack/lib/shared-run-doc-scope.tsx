"use client"

import { createContext, useContext, type ReactNode } from "react"

const SharedRunDocScopeContext = createContext<string | null>(null)

export function SharedRunDocScopeProvider({
  linkId,
  children,
}: {
  linkId: string | null
  children: ReactNode
}) {
  return <SharedRunDocScopeContext.Provider value={linkId}>{children}</SharedRunDocScopeContext.Provider>
}

export function useSharedRunDocScope(): string | null {
  return useContext(SharedRunDocScopeContext)
}
