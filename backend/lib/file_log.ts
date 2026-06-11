import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileWriteHelper } from "./file_write_helper.js";

// AI : python-style streaming log file (tail -f friendly) with syntax highlighting.
// AI : ONE token stream renders twice: plain text → <base>.log (editor friendly, no escape codes),
// AI : HTML spans → <base>.html (auto-refreshes in the browser until finish()).
// AI : Timestamped + _latest copies written on finish().

type LogColor = "cyan" | "green" | "yellow" | "magenta" | "red" | "dim" | "bold";

const HTML_COLOR: Record<LogColor, string> = {
  cyan: "#22d3ee",
  green: "#4ade80",
  yellow: "#facc15",
  magenta: "#e879f9",
  red: "#f87171",
  dim: "#64748b",
  bold: "#f1f5f9",
};

export interface LogSpan {
  text: string;
  color?: LogColor;
}

// AI : minimal JSON tokenizer — keys cyan, strings green, numbers yellow, literals magenta.
const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function jsonSpans(line: string): LogSpan[] {
  const spans: LogSpan[] = [];
  let last = 0;
  for (const m of line.matchAll(JSON_TOKEN)) {
    if (m.index > last) spans.push({ text: line.slice(last, m.index) });
    if (m[1] !== undefined) {
      spans.push({ text: m[1], color: m[2] ? "cyan" : "green" });
      if (m[2]) spans.push({ text: m[2] });
    } else if (/^[tfn]/.test(m[0])) {
      spans.push({ text: m[0], color: "magenta" });
    } else {
      spans.push({ text: m[0], color: "yellow" });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) spans.push({ text: line.slice(last) });
  return spans;
}

function toPlain(spans: LogSpan[]): string {
  return spans.map((s) => s.text).join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

function toHtmlLine(spans: LogSpan[]): string {
  return spans
    .map((s) => (s.color ? `<span style="color:${HTML_COLOR[s.color]}">${escapeHtml(s.text)}</span>` : escapeHtml(s.text)))
    .join("");
}

export class FileLog {
  readonly logPath: string;
  readonly htmlPath: string;
  private lines: LogSpan[][] = [];
  private finished = false;

  constructor(
    private dir: string,
    private base: string,
  ) {
    mkdirSync(dir, { recursive: true });
    this.logPath = join(dir, `${base}.log`);
    this.htmlPath = join(dir, `${base}.html`);
    writeFileSync(this.logPath, "");
    this.renderHtml();
  }

  private append(spans: LogSpan[]): void {
    this.lines.push(spans);
    // AI : .log streams line-by-line so `tail -f` works mid-run, like python's output.log.
    appendFileSync(this.logPath, toPlain(spans) + "\n");
    this.renderHtml();
  }

  line(text: string, color?: LogColor): void {
    this.append(color ? [{ text, color }] : [{ text }]);
  }

  section(title: string): void {
    this.line("");
    this.line(`══ ${title} ══`, "bold");
  }

  json(label: string, value: unknown): void {
    this.line(label, "dim");
    for (const l of JSON.stringify(value, null, 2).split("\n")) this.append(jsonSpans(l));
  }

  // AI : stamps the summary, stops the html auto-refresh, writes _latest + timestamped copies.
  finish(summary?: string): void {
    if (summary) {
      this.line("");
      this.line(summary, "bold");
    }
    this.finished = true;
    this.renderHtml();
    fileWriteHelper(this.dir, this.base, "log", this.lines.map(toPlain).join("\n") + "\n");
    fileWriteHelper(this.dir, this.base, "html", this.htmlContents());
  }

  private htmlContents(): string {
    const refresh = this.finished ? "" : `<meta http-equiv="refresh" content="2">`;
    return `<!doctype html><html><head><meta charset="utf-8">${refresh}<title>${this.base}</title><style>
body{background:#0b0f14;color:#e2e8f0;font:13px ui-monospace,SFMono-Regular,monospace;padding:20px}
pre{white-space:pre-wrap;word-break:break-word;margin:0}
</style></head><body><pre>${this.lines.map(toHtmlLine).join("\n")}</pre></body></html>`;
  }

  private renderHtml(): void {
    writeFileSync(this.htmlPath, this.htmlContents());
  }
}
