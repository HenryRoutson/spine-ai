import { SharedRunViewer } from "@/components/shared-run-viewer"
import { getSharedLink } from "@/lib/server/shared_links"
import { parseSharedLinkId } from "@/lib/server/api_schemas"
import Link from "next/link"

export default async function SharedRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const linkId = parseSharedLinkId(id)
  const link = linkId ? await getSharedLink(linkId) : null
  if (!linkId || !link) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Shared link not found</p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to Spine
        </Link>
      </div>
    )
  }
  return <SharedRunViewer linkId={link.id} />
}
