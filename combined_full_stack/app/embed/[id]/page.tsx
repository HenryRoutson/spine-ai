import { headers } from "next/headers"
import { EmbedRunViewer } from "@/components/embed-run-viewer"
import { getSharedLink } from "@/lib/server/shared_links"
import { parseSharedLinkId } from "@/lib/server/api_schemas"
import { isEmbedLinkId } from "@/lib/server/embed_origins"
import { mintEmbedSessionForRequest } from "@/lib/server/embed_session"
import { DEFAULT_EMBED_OPTIONS } from "@/lib/shared-link-types"

function appOriginFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return ""
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http")
  return `${proto}://${host}`
}

export default async function EmbedRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const linkId = parseSharedLinkId(id)
  const link = linkId ? await getSharedLink(linkId) : null
  const embedOptions = link?.embedOptions ?? DEFAULT_EMBED_OPTIONS
  const themeClass =
    embedOptions.theme === "dark"
      ? "dark"
      : embedOptions.theme === "light"
        ? "light"
        : undefined

  if (!linkId || !link || (!isEmbedLinkId(link.id) && (link.allowedOrigins?.length ?? 0) === 0)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        Embed not found
      </div>
    )
  }

  const h = await headers()
  const embedSessionToken = mintEmbedSessionForRequest(
    link.id,
    link.allowedOrigins ?? [],
    h,
    appOriginFromHeaders(h),
  )

  if (!embedSessionToken) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        This embed is not allowed on this website. Ask the publisher to add your origin.
      </div>
    )
  }

  return (
    <div className={themeClass} style={{ minHeight: embedOptions.heightPx }}>
      <EmbedRunViewer
        linkId={link.id}
        embedOptions={embedOptions}
        embedSessionToken={embedSessionToken}
      />
    </div>
  )
}
