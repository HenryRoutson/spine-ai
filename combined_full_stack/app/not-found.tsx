import Link from "next/link"
import { LEGAL } from "@shared/legal/site"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{LEGAL.productName}</p>
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">This URL doesn’t match an app route.</p>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Back to Spine
      </Link>
    </div>
  )
}
