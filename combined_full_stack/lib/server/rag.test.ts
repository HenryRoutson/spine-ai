import { describe, expect, it } from "vitest";
import {
  autoChunkOverlap,
  autoChunkSize,
  chunkDocument,
  isolateRetrievalMisses,
  runTraditionalRetrieval,
} from "./rag";

describe("autoChunkSize", () => {
  it("scales with document length", () => {
    expect(autoChunkSize(500)).toBe(500);
    expect(autoChunkSize(5_000)).toBe(800);
    expect(autoChunkSize(50_000)).toBe(1_200);
  });
});

describe("chunkDocument", () => {
  it("splits long text into overlapping chunks", () => {
    const text = "Alpha beta gamma. ".repeat(80);
    const chunks = chunkDocument(text, 400, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.chunk_id).toBe("c1");
    expect(chunks.every((c) => c.text.length > 0)).toBe(true);
  });
});

describe("runTraditionalRetrieval", () => {
  const source = [
    "Section A covers employee termination notice periods and severance eligibility.",
    "Section B describes refund policy for annual subscriptions within thirty days.",
    "Section C lists parking assignments for the downtown office building.",
  ].join("\n\n");

  it("retrieves top chunks with explanations", () => {
    const longSource = Array.from({ length: 12 }, (_, i) =>
      i === 0
        ? "Section A covers employee termination notice periods and severance eligibility."
        : i === 1
          ? "Section B describes refund policy for annual subscriptions within thirty days."
          : `Section ${String.fromCharCode(67 + i)} discusses miscellaneous topic number ${i} with filler text about operations.`,
    ).join("\n\n");
    const result = runTraditionalRetrieval(longSource, {
      query: "termination notice period severance",
      topK: 2,
      chunkSize: 400,
      chunkOverlap: 80,
    });
    expect(result.chunks.length).toBeGreaterThan(1);
    const retrieved = result.chunks.filter((c) => c.retrieved);
    expect(retrieved.length).toBe(2);
    expect(retrieved[0]!.explanation).toMatch(/Retrieved at rank/);
    const missed = result.chunks.find((c) => !c.retrieved);
    expect(missed?.explanation).toMatch(/Not retrieved/);
  });

  it("auto chunk size when unset", () => {
    const result = runTraditionalRetrieval(source, { query: "refund subscription" });
    expect(result.chunk_size).toBe(autoChunkSize(source.length));
    expect(result.overlap).toBe(autoChunkOverlap(result.chunk_size));
  });
});

describe("isolateRetrievalMisses", () => {
  it("finds chunks expected retrieved but actually missed", () => {
    const expected = [
      { chunk_id: "c1", retrieved: true, explanation: "", text: "a", start: 0, end: 1, score: 1, rank: 1 },
      { chunk_id: "c2", retrieved: true, explanation: "", text: "b", start: 0, end: 1, score: 0.5, rank: 2 },
    ];
    const actual = [
      { chunk_id: "c1", retrieved: true, explanation: "ok", text: "a", start: 0, end: 1, score: 1, rank: 1 },
      {
        chunk_id: "c2",
        retrieved: false,
        explanation: "Missing query terms: foo",
        text: "b",
        start: 0,
        end: 1,
        score: 0.1,
        rank: 5,
      },
    ];
    const misses = isolateRetrievalMisses(expected, actual);
    expect(misses).toHaveLength(1);
    expect(misses[0]!.chunk_id).toBe("c2");
    expect(misses[0]!.explanation).toContain("Missing query terms");
  });
});
