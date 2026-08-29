// AI : auto-generate file upload HTML from pipeline input modules for hosted sites.
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { inputTypesForModule } from "@/lib/inference-input-core"
import { inputTypeLabel } from "@/lib/inference-input-core"
import { escapeHtml } from "@/lib/standalone-html"
import { ModuleKind, type PipelineModule } from "@/lib/types"

export type upload_field_spec = {
  label: string
  accept: string
  inputTypes: string
  multiple: boolean
}

const INPUT_TYPE_ACCEPT: Record<string, string> = {
  pdf: ".pdf,application/pdf",
  word: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  excel: ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  json: ".json,application/json",
  text: ".txt,text/plain",
  markdown: ".md,.markdown,text/markdown",
  latex: ".tex,.latex,text/x-latex",
  image: ".png,.jpg,.jpeg,.gif,.webp,image/*",
  web: ".html,.htm,text/html",
  audio: "audio/*",
  video: "video/*",
}

function acceptForTypes(types: string[]): string {
  const parts = types.flatMap((t) => INPUT_TYPE_ACCEPT[t]?.split(",") ?? [])
  return [...new Set(parts)].join(",") || "*/*"
}

export function uploadFieldsFromPipeline(modules: PipelineModule[]): upload_field_spec[] {
  return flattenPipelineModules(modules)
    .filter((m) => m.kind === ModuleKind.Input)
    .map((m) => {
      const types = inputTypesForModule(m)
      const typeLabels = types.map((t) => inputTypeLabel(t)).join(", ")
      return {
        label: m.label,
        accept: acceptForTypes(types),
        inputTypes: typeLabels || "Any file",
        multiple: (m.inputMinCount ?? 1) > 1,
      }
    })
}

export function generateUploadFormHtml(modules: PipelineModule[], alias?: string): string {
  const fields = uploadFieldsFromPipeline(modules)
  if (!fields.length) {
    return `<div class="hs-upload-form">
  <p class="hs-upload-empty">No file inputs configured for this pipeline.</p>
</div>`
  }

  const runAlias = alias ? ` data-alias="${escapeHtml(alias)}"` : ""
  const fieldHtml = fields
    .map(
      (f) => `<div class="hs-upload-field">
  <label class="hs-upload-label" for="upload-${escapeHtml(f.label)}">${escapeHtml(f.label)}</label>
  <span class="hs-upload-hint">${escapeHtml(f.inputTypes)}</span>
  <input type="file" id="upload-${escapeHtml(f.label)}" class="hs-upload-input" data-label="${escapeHtml(f.label)}" accept="${escapeHtml(f.accept)}"${f.multiple ? " multiple" : ""} />
  <span class="hs-upload-filename" data-label="${escapeHtml(f.label)}">No file selected</span>
</div>`,
    )
    .join("\n")

  return `<div class="hs-upload-form"${runAlias}>
  ${fieldHtml}
  <button type="button" class="hs-upload-run">Run pipeline</button>
  <span class="hs-upload-status"></span>
</div>
<style>
.hs-upload-form { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; border: 1px solid var(--hs-border, #e2e8f0); border-radius: 0.5rem; background: var(--hs-card, #fff); }
.hs-upload-field { display: flex; flex-direction: column; gap: 0.25rem; }
.hs-upload-label { font-size: 0.875rem; font-weight: 600; }
.hs-upload-hint { font-size: 0.75rem; color: var(--hs-muted, #64748b); }
.hs-upload-input { font-size: 0.8125rem; }
.hs-upload-filename { font-size: 0.75rem; color: var(--hs-muted, #64748b); font-family: monospace; }
.hs-upload-run { margin-top: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.375rem; border: none; background: var(--hs-accent, #2563eb); color: #fff; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
.hs-upload-run:hover { opacity: 0.9; }
.hs-upload-run:disabled { opacity: 0.5; cursor: not-allowed; }
.hs-upload-status { font-size: 0.75rem; font-family: monospace; }
.hs-upload-status.ok { color: #16a34a; }
.hs-upload-status.err { color: #dc2626; }
.hs-upload-status.run { color: #2563eb; }
.hs-upload-empty { font-size: 0.875rem; color: var(--hs-muted, #64748b); }
</style>
<script>
(function() {
  const form = document.currentScript?.previousElementSibling?.previousElementSibling;
  if (!form || !form.classList.contains('hs-upload-form')) return;
  form.querySelectorAll('.hs-upload-input').forEach(function(input) {
    input.addEventListener('change', function() {
      const label = input.dataset.label;
      const nameEl = form.querySelector('.hs-upload-filename[data-label="' + label + '"]');
      if (nameEl) nameEl.textContent = input.files?.[0]?.name ?? 'No file selected';
    });
  });
  const runBtn = form.querySelector('.hs-upload-run');
  const statusEl = form.querySelector('.hs-upload-status');
  if (runBtn) {
    runBtn.addEventListener('click', function() {
      statusEl.textContent = 'Upload form ready — connect to pipeline run endpoint';
      statusEl.className = 'hs-upload-status ok';
      window.parent.postMessage({ type: 'hs-upload-ready', alias: form.dataset.alias || 'run' }, '*');
    });
  }
})();
</script>`
}

export function injectUploadFormIntoRunSlot(html: string, modules: PipelineModule[]): string {
  const form = generateUploadFormHtml(modules)
  const slotClass = "hs-run-slot"
  if (html.includes(`class="${slotClass}"`)) {
    return html.replace(new RegExp(`(<div class="${slotClass}"[^>]*>)`), `$1\n${form}\n`)
  }
  return html + `\n<div class="${slotClass}">\n${form}\n</div>`
}
