// AI : bolt.diy inspector → source file. Click preview text, patch the unique string in reactFiles.
import type { HostedSiteReactFile } from "@/lib/shared-link-types"
import { isProtectedHostedSiteReactPath } from "@/lib/hosted-site-react"

export type hosted_site_react_text_hit = {
  path: string
  count: number
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let from = 0
  while (from <= haystack.length) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return n
    n += 1
    from = at + needle.length
  }
  return n
}

export function reactFilesHitsForText(files: HostedSiteReactFile[], raw: string): hosted_site_react_text_hit[] {
  const needle = raw.trim()
  if (needle.length < 2) return []
  const hits: hosted_site_react_text_hit[] = []
  for (const file of files) {
    if (isProtectedHostedSiteReactPath(file.path) && file.path !== "src/App.tsx") continue
    const count = countOccurrences(file.contents, needle)
    if (count > 0) hits.push({ path: file.path, count })
  }
  return hits
}

export function findReactFileForText(files: HostedSiteReactFile[], raw: string): string | null {
  const hits = reactFilesHitsForText(files, raw)
  if (hits.length !== 1 || hits[0]!.count !== 1) return null
  return hits[0]!.path
}

export function patchReactFilesText(
  files: HostedSiteReactFile[],
  oldText: string,
  newText: string,
): HostedSiteReactFile[] | null {
  const needle = oldText.trim()
  const next = newText.trim()
  if (!needle || needle === next) return null
  const path = findReactFileForText(files, needle)
  if (!path) return null
  return files.map((file) =>
    file.path === path ? { ...file, contents: file.contents.replace(needle, next) } : file,
  )
}
