// AI : static step-progress chrome for exported hosted pages (live sites use InferenceStepTracePanel).
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { escapeHtml } from "@/lib/standalone-html"
import { isManagedLockedStep } from "@/lib/structure-parse-steps"
import { ModuleKind, type PipelineModule } from "@/lib/types"

export function generateStepProgressHtml(modules: PipelineModule[]): string {
  const steps = flattenPipelineModules(modules).filter((m) => !isManagedLockedStep(m) && m.kind !== ModuleKind.Output)
  if (!steps.length) return ""
  const items = steps
    .map(
      (m, i) => `<li class="hs-progress-step" data-step="${escapeHtml(m.id)}">
  <span class="hs-progress-index">${i + 1}</span>
  <span class="hs-progress-label">${escapeHtml(m.label)}</span>
  <span class="hs-progress-kind">${escapeHtml(m.kind)}</span>
</li>`,
    )
    .join("\n")
  return `<ol class="hs-progress" aria-label="Pipeline steps">
${items}
</ol>
<style>
.hs-progress { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.hs-progress-step { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; padding: 0.35rem 0.5rem; border: 1px solid var(--hs-border, #e2e8f0); border-radius: 0.375rem; background: var(--hs-card, #fff); }
.hs-progress-index { width: 1.25rem; height: 1.25rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 600; background: var(--hs-accent, #2563eb); color: #fff; }
.hs-progress-label { font-weight: 600; }
.hs-progress-kind { margin-left: auto; font-family: ui-monospace, monospace; font-size: 0.65rem; color: var(--hs-muted, #64748b); }
</style>`
}
