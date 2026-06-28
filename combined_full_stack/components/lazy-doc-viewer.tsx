"use client"

import dynamic from "next/dynamic"
import { useDocViewer } from "@/lib/doc-viewer"

const DocViewer = dynamic(
  () => import("@/components/doc-viewer").then((m) => ({ default: m.DocViewer })),
  { ssr: false },
)

// AI : defer xlsx / markdown / json viewer until a quote is opened.
export function LazyDocViewer() {
  const { target } = useDocViewer()
  if (!target) return null
  return <DocViewer />
}
