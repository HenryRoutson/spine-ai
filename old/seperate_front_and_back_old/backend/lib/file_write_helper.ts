import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type FileBaseName = string; // name without extension, e.g. "document_input"
type FileExt = string; // extension without dot, e.g. "txt"

// AI : DDMonYYYY_HHMMSS, e.g. 11Jun2026_122145 (matches demo_outline "11Jun2026_12pm45").
function timestamp(d: Date = new Date()): string {
  const mon = d.toLocaleString("en-US", { month: "short" });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}${mon}${d.getFullYear()}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export interface WrittenFiles {
  latest: string;
  stamped: string;
}

// AI : pitch `file_write_helper` — always write `<name>_latest.<ext>` AND a timestamped copy,
// AI : so the Documents tab's "previous runs" can list the history.
export function fileWriteHelper(
  dir: string,
  base: FileBaseName,
  ext: FileExt,
  contents: string,
): WrittenFiles {
  mkdirSync(dir, { recursive: true });
  const latest = join(dir, `${base}_latest.${ext}`);
  const stamped = join(dir, `${base}_${timestamp()}.${ext}`);
  writeFileSync(latest, contents, "utf8");
  writeFileSync(stamped, contents, "utf8");
  return { latest, stamped };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}
