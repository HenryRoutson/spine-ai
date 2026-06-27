import { SharedRunViewer } from "@/components/shared-run-viewer"

export default async function SharedRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SharedRunViewer linkId={id} />
}
