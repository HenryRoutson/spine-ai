import type { PipelineModule, PipelineRun, RunStep, StructureModel } from "@/lib/types"
import { SEED_RULES } from "@/lib/store"

function modelName(models: StructureModel[], id?: string) {
  return models.find((m) => m.id === id)?.name ?? "Any"
}

// Build a realistic-looking output payload per module kind for the demo.
function outputFor(
  m: PipelineModule,
  models: StructureModel[],
  inputDocId: string,
): { preview: string; json?: string } {
  switch (m.kind) {
    case "input":
      return { preview: `loaded ${m.inputType} → ${inputDocId}` }
    case "doc-to-text":
      return {
        preview: "purpose: Data Protection & Vendor Compliance Agreement",
        json: JSON.stringify(
          { doc_id: inputDocId, purpose: "Data Protection & Vendor Compliance Agreement", chars: 612 },
          null,
          2,
        ),
      }
    case "llm": {
      const out = modelName(models, m.outStructureId)
      if (out === "AtomicRule") {
        return {
          preview: `${SEED_RULES.length} atomic rules extracted with source quotes`,
          json: JSON.stringify(
            SEED_RULES.map((r) => ({
              rule_id: r.ruleId,
              description: r.description,
              source: { text: r.description, quote: { doc_id: "sha_doc", start: r.start, end: r.end } },
              severity: r.severity,
            })),
            null,
            2,
          ),
        }
      }
      return {
        preview: "compliance assessment generated",
        json: JSON.stringify(
          SEED_RULES.slice(0, 3).map((r) => ({
            rule_id: r.ruleId,
            compliant: r.ruleId !== "R-01" && r.ruleId !== "R-02",
            rationale:
              r.ruleId === "R-01"
                ? "Company stores EU data in us-east-1 — outside the EEA."
                : r.ruleId === "R-02"
                  ? "Breach runbook targets 96h, exceeding the 72h obligation."
                  : "Controls appear adequate.",
            liability_usd: r.ruleId === "R-01" ? 250000 : r.ruleId === "R-02" ? 80000 : 0,
          })),
          null,
          2,
        ),
      }
    }
    case "combine":
      return {
        preview: 'merged → {"company_data", "company_legal_requirements"}',
        json: JSON.stringify(
          { company_data: "acme_corp_outline.docx", company_legal_requirements: `${SEED_RULES.length} rules` },
          null,
          2,
        ),
      }
    case "custom-code":
      return { preview: "custom step executed" }
    case "output":
      return {
        preview: "LegalConsiderations.md emitted",
        json: JSON.stringify({ document: "legal_considerations.md", findings: 3, total_liability_usd: 330000 }, null, 2),
      }
    default:
      return { preview: "done" }
  }
}

export function buildRun(
  modules: PipelineModule[],
  models: StructureModel[],
  globalModel: string,
  inputDocId: string,
): PipelineRun {
  const steps: RunStep[] = modules.map((m, i) => {
    const cached = m.cached
    const ms = cached ? 0 : m.avgMs + Math.round((Math.random() - 0.5) * m.avgMs * 0.2)
    const costCents = cached ? 0 : m.avgCostCents
    const { preview, json } = outputFor(m, models, inputDocId)
    return {
      moduleId: m.id,
      kind: m.kind,
      label: m.label,
      model: m.kind === "llm" ? m.model ?? globalModel : undefined,
      status: cached ? "cached" : "ok",
      ms,
      costCents,
      inputPreview:
        i === 0 ? `${m.inputType} document` : modelName(models, m.inStructureId),
      outputPreview: preview,
      outputJson: json,
    }
  })

  const totalMs = steps.reduce((a, s) => a + s.ms, 0)
  const billedCents = steps.reduce((a, s) => a + s.costCents, 0)
  const savedCents = modules
    .filter((m) => m.cached)
    .reduce((a, m) => a + m.avgCostCents, 0)

  return {
    id: "run_" + Math.random().toString(36).slice(2, 9),
    startedAt: Date.now(),
    status: "ok",
    totalMs,
    billedCents,
    savedCents,
    model: globalModel,
    steps,
    inputDocId,
  }
}
