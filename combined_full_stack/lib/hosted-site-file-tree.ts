// AI : folder-before-file tree from bolt.diy FileTree (MIT — StackBlitz / bolt.diy contributors).
// AI : Adapted to Spine reactFiles paths (no leading slash, no WebContainer FileMap).

export type hosted_site_file_kind = "file" | "folder"

export type HostedSiteFileTreeNode = {
  kind: hosted_site_file_kind
  name: string
  path: string
  depth: number
}

function compareNodes(a: HostedSiteFileTreeNode, b: HostedSiteFileTreeNode): number {
  if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
}

export function buildHostedSiteFileTree(paths: string[]): HostedSiteFileTreeNode[] {
  const folderPaths = new Set<string>()
  const nodes: HostedSiteFileTreeNode[] = []
  const seenFiles = new Set<string>()

  for (const raw of paths) {
    const filePath = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "")
    if (!filePath || filePath.includes("..") || seenFiles.has(filePath)) continue
    seenFiles.add(filePath)
    const segments = filePath.split("/").filter(Boolean)
    if (segments.length === 0) continue
    let current = ""
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]!
      current = current ? `${current}/${name}` : name
      const isFile = i === segments.length - 1
      if (isFile) {
        nodes.push({ kind: "file", name, path: current, depth: i })
        continue
      }
      if (folderPaths.has(current)) continue
      folderPaths.add(current)
      nodes.push({ kind: "folder", name, path: current, depth: i })
    }
  }

  return sortHostedSiteFileTree(nodes)
}

function sortHostedSiteFileTree(nodeList: HostedSiteFileTreeNode[]): HostedSiteFileTreeNode[] {
  const nodeMap = new Map<string, HostedSiteFileTreeNode>()
  const children = new Map<string, HostedSiteFileTreeNode[]>()
  const sorted = [...nodeList].sort(compareNodes)
  for (const node of sorted) {
    nodeMap.set(node.path, node)
    const parent = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : ""
    const list = children.get(parent) ?? []
    list.push(node)
    children.set(parent, list)
  }
  const out: HostedSiteFileTreeNode[] = []
  const walk = (path: string) => {
    const kids = children.get(path)
    if (!kids) return
    for (const child of kids) {
      out.push(child)
      if (child.kind === "folder") walk(child.path)
    }
  }
  walk("")
  return out
}

export function visibleHostedSiteFileTree(
  nodes: HostedSiteFileTreeNode[],
  collapsed: ReadonlySet<string>,
): HostedSiteFileTreeNode[] {
  const out: HostedSiteFileTreeNode[] = []
  let skipDeeperThan = Number.POSITIVE_INFINITY
  for (const node of nodes) {
    if (node.depth > skipDeeperThan) continue
    skipDeeperThan = Number.POSITIVE_INFINITY
    out.push(node)
    if (node.kind === "folder" && collapsed.has(node.path)) skipDeeperThan = node.depth
  }
  return out
}
