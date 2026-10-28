import { createHash } from "node:crypto";
import { stableJson } from "../run-fingerprint";
import type { DocId, ModelId } from "./types";

export type FileContentHash = string & { __brand: "FileContentHash" };
export type ParserCacheKey = string & { __brand: "ParserCacheKey" };
export type VisionCacheKey = string & { __brand: "VisionCacheKey" };
export type ParserKind = "pdfjs" | "plain";

export type ParserCacheRow = {
  key: ParserCacheKey;
  fileHash: FileContentHash;
  docId: DocId;
  parser: ParserKind;
  content: string;
  createdAt: number;
};

export type VisionCacheRow = {
  key: VisionCacheKey;
  docId: DocId;
  model: ModelId;
  prompt: string;
  purpose: string;
  content: string;
  createdAt: number;
};

export function hashFileBytes(bytes: Uint8Array): FileContentHash {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 32) as FileContentHash;
}

export function parserCacheKey(fileHash: FileContentHash, parser: ParserKind): ParserCacheKey {
  return (`pc_${parser}_${fileHash}`) as ParserCacheKey;
}

// AI : vision OCR cache — keyed by doc + model + prompt (separate from parser cache).
export function visionCacheKey(args: {
  docId: DocId;
  model: ModelId;
  prompt: string;
  purpose: string;
}): VisionCacheKey {
  const hex = createHash("sha256")
    .update(
      stableJson({
        docId: args.docId,
        model: args.model,
        prompt: args.prompt.trim(),
        purpose: args.purpose.trim(),
      }),
    )
    .digest("hex")
    .slice(0, 24);
  return (`vc_${hex}`) as VisionCacheKey;
}
