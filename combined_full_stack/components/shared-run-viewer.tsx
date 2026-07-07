"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, Loader2, LogIn, LogOut, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SharedRunPanel } from "@/components/share/shared-run-panel"
import { LazyDocViewer } from "@/components/lazy-doc-viewer"
import { ErrorBanner } from "@/components/inference/inference-run-chrome"
import { DocViewerProvider } from "@/lib/doc-viewer"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
import { fetchSharedLink } from "@/lib/shared-run-client"
import { useSupabaseSession } from "@/lib/use-supabase-session"
import { openSharedLinkInWorkspace } from "@/lib/open-shared-in-workspace"
import { addSharedWithMe } from "@/lib/shared-with-me"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"

export function SharedRunViewer({ linkId }: { linkId: string }) {
  const [link, setLink] = useState<SharedLinkPublicView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchSharedLink(linkId)
      .then((loaded) => {
        setLink(loaded)
        addSharedWithMe(linkId, loaded.name)
      })
      .catch((e) => setLoadError((e as Error).message))
  }, [linkId])

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <ErrorBanner text={loadError} />
      </div>
    )
  }

  if (!link) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <SharedRunContent link={link} linkId={linkId} />
}

function SharedRunContent({ link, linkId }: { link: SharedLinkPublicView; linkId: string }) {
  const { email, isAuthenticated, ready, signOut } = useSupabaseSession()

  return (
    <DocViewerProvider>
    <SharedRunDocScopeProvider scope={{ linkId }}>
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{link.name}</h1>
            {link.description && (
              <p className="truncate text-xs text-muted-foreground">{link.description}</p>
            )}
          </div>
          <Badge variant="outline" className="font-mono text-[9px]">
            shared pipeline
          </Badge>
          <div className="flex items-center gap-2">
            {ready && isAuthenticated ? (
              <>
                <span className="hidden max-w-[160px] truncate font-mono text-[10px] text-muted-foreground sm:inline">
                  {email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void signOut().then(() => (window.location.href = "/login"))}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </>
            ) : ready ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  window.location.href = `/login?next=${encodeURIComponent(`/run/${linkId}`)}`
                }}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </Button>
            ) : null}
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => openSharedLinkInWorkspace(linkId, link.name)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Open in workspace
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-5">
        {isAuthenticated && viewerFundsSharedRun(link.fundingMode) ? (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <p className="font-medium">Run this in your workspace for Billing access</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Viewer-paid links need credit in your account. Use Open in workspace, then go to the Billing tab to top up.
            </p>
            <Button
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => openSharedLinkInWorkspace(linkId, link.name)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Open in workspace
            </Button>
          </div>
        ) : null}

        <SharedRunPanel
          link={link}
          linkId={linkId}
          isAuthenticated={isAuthenticated}
          onAuthRequired={() => {
            window.location.href = `/login?next=${encodeURIComponent(`/run/${linkId}`)}`
          }}
        />
      </main>
    </div>
    <LazyDocViewer />
    </SharedRunDocScopeProvider>
    </DocViewerProvider>
  )
}
