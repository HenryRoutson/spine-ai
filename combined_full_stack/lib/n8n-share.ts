import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import {
  getN8nNode,
  listN8nNodes,
  registerSharedPiece,
  toShareablePiece,
  type ShareablePiece,
} from "@/lib/n8n-catalog"

function piecesDir(appRoot: string): string {
  return resolve(appRoot, "pieces")
}

export function loadSharedPiecesFromDisk(appRoot: string): ShareablePiece[] {
  const dir = piecesDir(appRoot)
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"))
    const loaded: ShareablePiece[] = []
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as ShareablePiece
        if (!raw?.n8nNodeType && !raw?.id) continue
        loaded.push(registerSharedPiece(raw))
      } catch {
        // AI : skip malformed shared pieces — catalog still boots.
      }
    }
    return loaded
  } catch {
    return []
  }
}

export function listPiecesForMcp(appRoot: string) {
  loadSharedPiecesFromDisk(appRoot)
  return listN8nNodes().map((p) => ({
    id: p.id,
    n8nNodeType: p.n8nNodeType,
    pieceAlias: p.n8nNodeType.startsWith("n8n-nodes-base.")
      ? `piece.${p.n8nNodeType.slice("n8n-nodes-base.".length)}`
      : undefined,
    displayName: p.displayName,
    description: p.description,
    category: p.category,
    props: p.props.map((prop) => ({
      name: prop.name,
      displayName: prop.displayName,
      type: prop.type,
      required: prop.required ?? false,
    })),
    shareable: true,
  }))
}

export function exportAllPiecesToDisk(appRoot: string): { path: string; piece: ShareablePiece }[] {
  loadSharedPiecesFromDisk(appRoot)
  return listN8nNodes().map((p) => exportPieceToDisk(appRoot, p.n8nNodeType))
}

export function exportPieceToDisk(appRoot: string, n8nNodeType: string): { path: string; piece: ShareablePiece } {
  loadSharedPiecesFromDisk(appRoot)
  const entry = getN8nNode(n8nNodeType)
  if (!entry) throw new Error(`unknown piece: ${n8nNodeType}`)
  const piece = toShareablePiece(entry)
  const dir = piecesDir(appRoot)
  mkdirSync(dir, { recursive: true })
  const slug = piece.id.replace(/[^A-Za-z0-9._-]+/g, "_")
  const path = join(dir, `${slug}.json`)
  writeFileSync(path, `${JSON.stringify(piece, null, 2)}\n`)
  return { path, piece }
}

export function importPieceJson(appRoot: string, json: string): ShareablePiece {
  const parsed = JSON.parse(json) as ShareablePiece
  if (!parsed?.n8nCode || !(parsed.n8nNodeType || parsed.id)) {
    throw new Error("piece JSON needs n8nNodeType (or id) and n8nCode")
  }
  const entry = registerSharedPiece(parsed)
  return exportPieceToDisk(appRoot, entry.n8nNodeType).piece
}
