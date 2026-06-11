import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { pdfToText } from "./pdf_to_text.js";
import { DOCUMENTS_DIR } from "./config.js";

describe("pdfToText", () => {
  it("extracts readable text from the seed legal PDF", async () => {
    const text = await pdfToText(join(DOCUMENTS_DIR, "legal_doc_text.pdf"));
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain("Health Data Protection");
    expect(text.toLowerCase()).toContain("breach");
  });
});
