import { join } from "node:path";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { dataDir } from "../config";
import { fileWriteHelper } from "../file_write_helper";
import { collectQuotes } from "../quotation";
import type { DocId, ModuleId, PipelineModule, RunId, StructureModel } from "../types";
import type { Store } from "../store";

function renderReport(report: unknown, title: string): string {
  if (!Array.isArray(report)) return `# ${title}\n\n${JSON.stringify(report, null, 2)}\n`;
  const rows = report as Array<Record<string, unknown>>;
  const lines = [`# ${title}`, ""];
  for (const r of rows) {
    if (r.rule_id === undefined) {
      lines.push("```json", JSON.stringify(r, null, 2), "```", "");
      continue;
    }
    lines.push(`## ${r.rule_id} — ${r.compliant ? "Compliant" : "Non-compliant"}`);
    if (r.summary) lines.push(`${r.summary}`);
    if (r.rationale) lines.push(`\n${r.rationale}`);
    if (r.liability_usd) lines.push(`\n**Estimated exposure:** $${r.liability_usd}`);
    lines.push("");
  }
  return lines.join("\n");
}

function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export function persistCustomCodeArtifacts(runId: string, m: PipelineModule): void {
  if (m.kind !== "custom-code" && m.kind !== "assert" && !(m.kind === "transform" && m.code?.trim())) return;
  const entries = customCodeEntriesForModule(m);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const ext = e.language === "python" ? "py" : "ts";
    const suffix = i === 0 ? "code" : `fallback_${i}`;
    fileWriteHelper(join(dataDir(), "runs", runId), `${m.id}_${suffix}`, ext, e.code);
  }
}

export function persistArtifacts(
  runId: RunId,
  inputDocId: DocId,
  store: Store,
  artifacts: { moduleId: ModuleId; structure?: StructureModel; value: unknown }[],
  modules: PipelineModule[],
  models: StructureModel[],
): void {
  const dir = join(dataDir(), "runs", runId);
  const inputText = store.docContent(inputDocId) ?? "";
  fileWriteHelper(dir, "document_input", "txt", inputText);
  const modById = new Map(modules.map((m) => [m.id, m]));
  for (const a of artifacts) {
    fileWriteHelper(
      dir,
      a.moduleId,
      "json",
      JSON.stringify({ structure: a.structure, value: a.value }, null, 2),
    );
  }
  const quotes = [
    ...new Map(
      artifacts
        .flatMap((a) => {
          const mod = modById.get(a.moduleId);
          const isList = !!mod?.outIsList || mod?.kind === "llm-batch";
          return collectQuotes(a.value, [], a.structure, models, isList);
        })
        .map((q) => [q.href, q]),
    ).values(),
  ];
  if (quotes.length) fileWriteHelper(dir, "quotes", "json", JSON.stringify(quotes, null, 2));
  const outputIds = new Set(modules.filter((m) => m.kind === "output").map((m) => m.id));
  for (const a of artifacts.filter((x) => outputIds.has(x.moduleId))) {
    const name = a.structure?.name ?? "Output";
    fileWriteHelper(
      dir,
      `${a.moduleId}_${snakeCase(name)}`,
      "md",
      renderReport(a.value, name.replace(/([a-z0-9])([A-Z])/g, "$1 $2")),
    );
  }
}
