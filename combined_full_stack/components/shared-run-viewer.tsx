"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LayoutGrid, Loader2, LogIn, LogOut, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SharedRunPanel } from "@/components/share/shared-run-panel"
import { LazyDocViewer } from "@/components/lazy-doc-viewer"
import { DocViewerProvider } from "@/lib/doc-viewer"
import { SharedRunDocScopeProvider } from "@/lib/shared-run-doc-scope"
import { fetchSharedLink } from "@/lib/shared-run-client"
import { useSupabaseSession } from "@/lib/use-supabase-session"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import { openSharedLinkInWorkspace } from "@/lib/open-shared-in-workspace"
import { addSharedWithMe } from "@/lib/shared-with-me"
import { viewerFundsSharedRun } from "@/lib/shared-link-funding"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"
import { cn } from "@/lib/utils"

export function SharedRunViewer({
  linkId,
  variant = "page",
  embedSessionToken,
}: {
  linkId: string
  variant?: "page" | "embed"
  embedSessionToken?: string
}) {
  const [link, setLink] = useState<SharedLinkPublicView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchSharedLink(linkId)
      .then((loaded) => {
        setLink(loaded)
        if (variant === "page") addSharedWithMe(linkId, loaded.name)
      })
      .catch((e) => setLoadError((e as Error).message))
  }, [linkId, variant])

  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {variant === "embed" ? "Embed not found" : "Shared link not found"}
        </p>
        {variant === "page" ? (
          <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to Spine
          </Link>
        ) : null}
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

  return (
    <SharedRunContent
      link={link}
      linkId={linkId}
      variant={variant}
      embedSessionToken={embedSessionToken}
    />
  )
}

function SharedRunContent({
  link,
  linkId,
  variant,
  embedSessionToken,
}: {
  link: SharedLinkPublicView
  linkId: string
  variant: "page" | "embed"
  embedSessionToken?: string
}) {
  const { email, isAuthenticated, ready, signOut } = useSupabaseSession()
  const isEmbed = variant === "embed"
  const hideBranding = isEmbed && link.embedOptions?.hideBranding
  const loginNext = isEmbed ? `/embed/${linkId}` : `/run/${linkId}`

  return (
    <DocViewerProvider>
    <SharedRunDocScopeProvider scope={{ linkId }}>
    <div className={cn("flex flex-col bg-background text-foreground", isEmbed ? "min-h-full" : "min-h-dvh")}>
      {!hideBranding && (
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
            {isEmbed ? "embedded pipeline" : "shared pipeline"}
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
                  onClick={() => void signOut().then(() => {
                    clearWorkspaceClientSession()
                    window.location.href = "/login"
                  })}
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
                  window.location.href = `/login?next=${encodeURIComponent(loginNext)}`
                }}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </Button>
            ) : null}
            {!isEmbed && (
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => openSharedLinkInWorkspace(linkId, link.name)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Open in workspace
            </Button>
            )}
          </div>
        </div>
      </header>
      )}

      <main className={cn("mx-auto w-full max-w-4xl flex-1 overflow-y-auto", isEmbed ? "p-3" : "p-5")}>
        {isAuthenticated && viewerFundsSharedRun(link.fundingMode) ? (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <p className="font-medium">Run this in your workspace for Billing access</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Viewer-paid links need credit in your account. Use Open in workspace, then go to the Billing tab to top up.
            </p>
            {!isEmbed && (
            <Button
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => openSharedLinkInWorkspace(linkId, link.name)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Open in workspace
            </Button>
            )}
          </div>
        ) : null}

        <SharedRunPanel
          link={link}
          linkId={linkId}
          isAuthenticated={isAuthenticated}
          embedSessionToken={embedSessionToken}
          onAuthRequired={() => {
            window.location.href = `/login?next=${encodeURIComponent(loginNext)}`
          }}
        />
      </main>
    </div>
    <LazyDocViewer />
    </SharedRunDocScopeProvider>
    </DocViewerProvider>
  )
}
