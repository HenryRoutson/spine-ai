import type {
  FileContentHash,
  ParserCacheKey,
  ParserCacheRow,
  ParserKind,
  VisionCacheKey,
  VisionCacheRow,
} from "./doc_text_cache";
import type { DocId } from "./types";

export type ParserVisionCacheIndex = {
  parserCache: Map<ParserCacheKey, ParserCacheRow>;
  parserCacheByDoc: Map<DocId, ParserCacheRow>;
  parserCacheByFile: Map<string, ParserCacheRow>;
  visionCache: Map<VisionCacheKey, VisionCacheRow>;
};

export function createParserVisionCacheIndex(): ParserVisionCacheIndex {
  return {
    parserCache: new Map(),
    parserCacheByDoc: new Map(),
    parserCacheByFile: new Map(),
    visionCache: new Map(),
  };
}

export function indexVisionRow(index: ParserVisionCacheIndex, row: VisionCacheRow): void {
  index.visionCache.set(row.key, row);
}

export function indexParserRow(index: ParserVisionCacheIndex, row: ParserCacheRow): void {
  index.parserCache.set(row.key, row);
  index.parserCacheByDoc.set(row.docId, row);
  index.parserCacheByFile.set(`${row.parser}:${row.fileHash}`, row);
}

export function parserCacheGetByFileHash(
  index: ParserVisionCacheIndex,
  fileHash: FileContentHash,
  parser: ParserKind,
): ParserCacheRow | undefined {
  return index.parserCacheByFile.get(`${parser}:${fileHash}`);
}

export function parserCacheGetByDoc(
  index: ParserVisionCacheIndex,
  docId: DocId,
): ParserCacheRow | undefined {
  return index.parserCacheByDoc.get(docId);
}

export function visionCacheGet(
  index: ParserVisionCacheIndex,
  key: VisionCacheKey,
): VisionCacheRow | undefined {
  return index.visionCache.get(key);
}

export function visionCachesForDoc(index: ParserVisionCacheIndex, docId: DocId): VisionCacheRow[] {
  return [...index.visionCache.values()]
    .filter((row) => row.docId === docId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function purgeParserVisionCacheForDoc(index: ParserVisionCacheIndex, docId: DocId): void {
  for (const [key, row] of index.parserCache) {
    if (row.docId !== docId) continue;
    index.parserCache.delete(key);
    index.parserCacheByFile.delete(`${row.parser}:${row.fileHash}`);
  }
  index.parserCacheByDoc.delete(docId);
  for (const [key, row] of index.visionCache) {
    if (row.docId === docId) index.visionCache.delete(key);
  }
}
