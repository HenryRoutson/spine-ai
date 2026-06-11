import { describe, it, expect } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config.js";
import { FileLog, jsonSpans } from "./file_log.js";

describe("FileLog (python-style streaming log)", () => {
  it("streams plain lines to .log and mirrors a highlighted .html", () => {
    const dir = join(dataDir(), "logs_test_tmp");
    const log = new FileLog(dir, "sample");
    log.section("phase one");
    log.json("payload", { ok: true, count: 3, name: "x" });

    // mid-run: .log is tail -f-able plain text (no escape codes), .html auto-refreshes
    const raw = readFileSync(log.logPath, "utf8");
    expect(raw).toContain("phase one");
    expect(raw).toContain('"ok": true');
    expect(raw).not.toContain("\u001b[");
    expect(readFileSync(log.htmlPath, "utf8")).toContain('http-equiv="refresh"');

    log.finish("done");
    const html = readFileSync(log.htmlPath, "utf8");
    expect(html).toContain("<span"); // syntax highlighting spans
    expect(html).toContain('>"ok"</span>'); // the key sits inside a colored span
    expect(html).not.toContain('http-equiv="refresh"'); // finished → stop refreshing
    rmSync(dir, { recursive: true, force: true });
  });

  it("jsonSpans colors keys, strings, numbers and literals distinctly", () => {
    const spans = jsonSpans('  "key": "value", "n": 42, "b": true');
    const colorOf = (text: string) => spans.find((s) => s.text.includes(text))?.color;
    expect(colorOf('"key"')).toBe("cyan");
    expect(colorOf('"value"')).toBe("green");
    expect(colorOf("42")).toBe("yellow");
    expect(colorOf("true")).toBe("magenta");
  });
});
