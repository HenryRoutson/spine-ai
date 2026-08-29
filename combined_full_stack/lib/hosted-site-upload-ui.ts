// AI : auto-generate file upload HTML from pipeline input modules for hosted sites.
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { inputTypesForModule } from "@/lib/inference-input-core"
import { inputTypeLabel } from "@/lib/inference-input-core"
import { escapeHtml } from "@/lib/standalone-html"
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"

export type upload_field_spec = {
  label: string
  moduleId: ModuleId
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
        moduleId: m.id,
        accept: acceptForTypes(types),
        inputTypes: typeLabels || "Any file",
        multiple: (m.inputMinCount ?? 1) > 1,
      }
    })
}

export function hostedSiteLinkIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/(?:site|run|embed)\/([^/]+)/)
  return m?.[1] ?? null
}

export function generateUploadFormHtml(modules: PipelineModule[], alias?: string, linkId?: string): string {
  const fields = uploadFieldsFromPipeline(modules)
  if (!fields.length) {
    return `<div class="hs-upload-form">
  <p class="hs-upload-empty">No file inputs configured for this pipeline.</p>
</div>`
  }

  const runAlias = alias ? ` data-alias="${escapeHtml(alias)}"` : ""
  const linkAttr = linkId ? ` data-link-id="${escapeHtml(linkId)}"` : ""
  const fieldHtml = fields
    .map(
      (f) => `<div class="hs-upload-field">
  <label class="hs-upload-label" for="upload-${escapeHtml(f.moduleId)}">${escapeHtml(f.label)}</label>
  <span class="hs-upload-hint">${escapeHtml(f.inputTypes)}</span>
  <input type="file" id="upload-${escapeHtml(f.moduleId)}" class="hs-upload-input" data-label="${escapeHtml(f.label)}" data-module-id="${escapeHtml(f.moduleId)}" accept="${escapeHtml(f.accept)}"${f.multiple ? " multiple" : ""} />
  <span class="hs-upload-filename" data-label="${escapeHtml(f.label)}">No file selected</span>
</div>`,
    )
    .join("\n")

  return `<div class="hs-upload-form"${runAlias}${linkAttr}>
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
  const form = document.currentScript && document.currentScript.previousElementSibling && document.currentScript.previousElementSibling.previousElementSibling;
  if (!form || !form.classList.contains('hs-upload-form')) return;
  form.querySelectorAll('.hs-upload-input').forEach(function(input) {
    input.addEventListener('change', function() {
      const label = input.dataset.label;
      const nameEl = form.querySelector('.hs-upload-filename[data-label="' + label + '"]');
      if (!nameEl) return;
      const files = input.files;
      if (!files || !files.length) { nameEl.textContent = 'No file selected'; return; }
      nameEl.textContent = files.length === 1 ? files[0].name : (files.length + ' files');
    });
  });
  const runBtn = form.querySelector('.hs-upload-run');
  const statusEl = form.querySelector('.hs-upload-status');
  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'hs-upload-status ' + cls;
  }
  if (runBtn) {
    runBtn.addEventListener('click', function() {
      const linkId = form.dataset.linkId || (location.pathname.match(/\\/(?:site|run|embed)\\/([^/]+)/) || [])[1];
      if (!linkId) { setStatus('missing site id', 'err'); return; }
      runBtn.disabled = true;
      setStatus('Uploading…', 'run');
      const byModule = {};
      const inputs = Array.from(form.querySelectorAll('.hs-upload-input'));
      Promise.resolve().then(async function() {
        for (const input of inputs) {
          const moduleId = input.dataset.moduleId;
          if (!moduleId || !input.files || !input.files.length) continue;
          const ids = [];
          for (const file of input.files) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('moduleId', moduleId);
            const res = await fetch('/api/shared-links/' + encodeURIComponent(linkId) + '/docs', { method: 'POST', body: fd, credentials: 'same-origin' });
            const data = await res.json().catch(function() { return {}; });
            if (!res.ok) throw new Error(data.error || data.message || ('upload failed (' + res.status + ')'));
            ids.push(data.id);
          }
          byModule[moduleId] = ids;
        }
        if (!Object.keys(byModule).length) throw new Error('choose a file first');
        setStatus('Running…', 'run');
        const alias = form.dataset.alias;
        const body = { inputDocsByModule: byModule };
        if (alias) body.pipelineAlias = alias;
        const runRes = await fetch('/api/shared-links/' + encodeURIComponent(linkId) + '/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        });
        const runData = await runRes.json().catch(function() { return {}; });
        if (!runRes.ok) throw new Error(runData.error || runData.message || ('run failed (' + runRes.status + ')'));
        setStatus('Run started', 'ok');
        window.parent.postMessage({ type: 'hs-upload-run', alias: alias || 'run', runId: runData.id || runData.runId }, '*');
      }).catch(function(err) {
        setStatus(String(err && err.message ? err.message : err), 'err');
      }).finally(function() {
        runBtn.disabled = false;
      });
    });
  }
})();
</script>`
}

export function injectHtmlIntoHostedSlot(html: string, slotClass: string, inner: string): string {
  if (html.includes(`class="${slotClass}"`)) {
    return html.replace(new RegExp(`(<div class="${slotClass}"[^>]*>)`), `$1\n${inner}\n`)
  }
  return `${html}\n<div class="${slotClass}">\n${inner}\n</div>`
}

export function injectUploadFormIntoRunSlot(html: string, modules: PipelineModule[], linkId?: string): string {
  const form = generateUploadFormHtml(modules, undefined, linkId)
  return injectHtmlIntoHostedSlot(html, "hs-run-slot", form)
}
