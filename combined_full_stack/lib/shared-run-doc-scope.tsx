"use client"

import { createContext, useContext, type ReactNode } from "react"

export type SharedRunDocScope = {
  linkId: string
  sessionId?: string
}

const SharedRunDocScopeContext = createContext<SharedRunDocScope | null>(null)

export function SharedRunDocScopeProvider({
  scope,
  children,
}: {
  scope: SharedRunDocScope | null
  children: ReactNode
}) {
  return <SharedRunDocScopeContext.Provider value={scope}>{children}</SharedRunDocScopeContext.Provider>
}

export function useSharedRunDocScope(): SharedRunDocScope | null {
  return useContext(SharedRunDocScopeContext)
}
