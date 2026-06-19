import { describe, it, expect } from "vitest";
import { openStore, hashContent } from "./store.js";
import type { ProjectId } from "./types.js";

describe("JsonStore", () => {
  it("seeds the default project and the real source docs", async () => {
    const store = await openStore();
    const project = store.project("p_legal" as ProjectId);
    expect(project?.name).toBe("Company Legal Evaluation");
    expect(project?.modules.length).toBeGreaterThan(0);
    // both seed PDFs parsed and stored with content
    expect(store.docs().length).toBeGreaterThanOrEqual(2);
    const legal = store.docs().find((d) => d.name.includes("health_data"))!;
    expect(store.docContent(legal.id)?.length ?? 0).toBeGreaterThan(500);
  });

  it("dedupes identical uploads by content hash", async () => {
    const store = await openStore();
    const before = store.docs().length;
    // AI : bug fix — unique content per run; static content made a 2nd `npm test` fail (already stored)
    const content = `identical content ${Date.now()}`;
    const a = store.addDoc("dup.txt", "text", content, "training");
    const b = store.addDoc("dup-renamed.txt", "text", content, "training");
    expect(a.id).toBe(b.id);
    expect(a.id).toBe(hashContent(content));
    expect(store.docs().length).toBe(before + 1);
  });
});
