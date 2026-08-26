import type { Metadata } from "next"
import Link from "next/link"
import { HostedSiteViewer } from "@/components/share/hosted-site-viewer"
import { parseSharedLinkId } from "@/lib/server/api_schemas"
import { getSharedLink } from "@/lib/server/shared_links"
import { isSiteLinkId } from "@/lib/hosted-site"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const linkId = parseSharedLinkId(id)
  const link = linkId ? await getSharedLink(linkId) : null
  const title = link?.siteOptions?.brand.companyName?.trim() || link?.name || "Hosted page"
  return { title }
}

export default async function HostedSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const linkId = parseSharedLinkId(id)
  const link = linkId ? await getSharedLink(linkId) : null
  if (!linkId || !link || !isSiteLinkId(link.id)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Hosted page not found</p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to Spine
        </Link>
      </div>
    )
  }
  return <HostedSiteViewer linkId={link.id} siteOptions={link.siteOptions} viewerMarkdown={link.viewerMarkdown ?? ""} />
}
