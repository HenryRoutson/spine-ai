// AI : build diagnosis context from a failed run — pipeline at run time + error-only log.

import { runErrorLogJsonObject, runErrorLogText } from "@/lib/run-error-log"
import type { PipelineModule, PipelineRun, Project } from "@/lib/types"

export function buildDiagnosisSystemPrompt(): string {
  return `You diagnose failed linear LLM pipeline runs.

You receive:
- The pipeline configuration as it existed when the run executed
- Error-only log excerpts (failed steps, validation messages, server warnings/errors)
- Optional test assertion failures

## Platform conventions (read before diagnosing)

### Assert steps — \`assertEqual(step("Label"), "Label")\`
- The second argument is **not** a literal string to compare against.
- When the second argument is a string, it is a **golden-fixture key**: runtime resolves it via \`expected(label)\` from the run's \`expectedOutputs\` map (seed fixtures / inferencePresets keyed by input documents).
- \`step("Normalize Case")\` reads that step's output from pipeline \`state\` (prior step outputs keyed by label).
- So \`assertEqual(step("Normalize Case"), "Normalize Case")\` means: compare Normalize Case output to the golden JSON for that label — **not** to the step name string.
- If an assert step fails but the upstream custom-code step succeeded, suspect **wrong golden for this run's input docs** (missing or mismatched inferencePreset) before rewriting the assertion.
- Example Select demo: \`✓ Select Relevant Examples\` unions library ids from \`Example Library\`, \`Combine Inputs\` → \`library.examples\`, and \`Parse Examples\`. If the LLM selected ids that look valid but the assert says \`unknown example id\`, first suspect **visual line-trace turning nested map/flatMap arrows async** (Promise ids in the Set) — not a missing row in git \`documents/\`. Also consider **stale per-user bundled docs** shadowing \`public.seed_docs\` or **step-cache desync**. Recommend a fresh inference run after the tracer fix; Resync examples if the library file itself looks wrong.

### Custom-code steps — browser compilation
- User TypeScript is wrapped by \`buildCustomFnSource\` into \`(input, state) => output\` and compiled with \`new Function\` in the browser (with optional line tracing).
- Expression-form arrows like \`(doc) => ({ description: ... })\` are valid; a syntax error at compile time is usually a **wrapper/tracing bug**, not missing parens on the parameter.
- Traced runs inject \`await __forgeTrace(n)\` and async-wrap the compiled fn — failures like \`Unexpected token '}'\` or \`await is only valid in async functions\` point to the compile wrapper, not the user's transform logic.
- Distinguish **compile-time** errors (SyntaxError during custom code setup) from **runtime** errors (thrown inside the function body).

Your job:
1. Explain the most likely root cause in plain language
2. Point to the specific pipeline step(s) responsible
3. Suggest concrete fixes (prompt edits, structure changes, input checks, code fixes, inferencePreset / golden fixture alignment)
4. Note if the failure looks transient (provider/rate limit) vs structural

Do NOT propose unrelated refactors. Stay scoped to the provided error context.
Do NOT tell users to replace \`assertEqual(step("X"), "X")\` with a hard-coded object unless you have confirmed the golden map is wrong — that pattern is intentional.
Write concise markdown with sections: ## Root cause, ## Evidence, ## Recommended fix.`
}

export function buildDiagnosisUserPrompt(
  project: Project,
  run: PipelineRun,
  userMessage: string,
): string {
  const errorJson = runErrorLogJsonObject(run, project.modules, { includePipeline: true })
  const pipelineAtRun = errorJson.pipelineAtRun ?? []
  const errorText = runErrorLogText(run, { includePipeline: true })
  const modelsJson = JSON.stringify(
    project.models.map((m) => ({
      name: m.name,
      description: m.description,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        optional: f.optional,
        ref: f.ref ? project.models.find((x) => x.id === f.ref)?.name : undefined,
      })),
    })),
    null,
    2,
  )

  const defaultGoldenKeys = project.expectedOutputs ? Object.keys(project.expectedOutputs) : []
  const presetLines =
    project.inferencePresets?.map((p) => {
      const docNames = Object.values(p.inputs).flatMap((v) => (Array.isArray(v) ? v : [v]))
      const goldenKeys = p.expectedOutputs ? Object.keys(p.expectedOutputs) : []
      return `- ${p.name}: inputs [${docNames.join(", ")}] → golden keys [${goldenKeys.join(", ")}]`
    }) ?? []
  const goldenContext =
    defaultGoldenKeys.length || presetLines.length
      ? [
          "",
          "Assert golden fixtures (see system prompt — assertEqual second string arg resolves here):",
          defaultGoldenKeys.length
            ? `- Project default golden step labels: ${defaultGoldenKeys.join(", ")}`
            : "",
          presetLines.length ? `- inferencePresets (matched by sorted input doc names at run time):\n${presetLines.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : ""

  return `Project: ${project.name} (${project.id})
${goldenContext}

Structure models:
${modelsJson}

Pipeline at run time (${pipelineAtRun.length} steps):
${JSON.stringify(pipelineAtRun, null, 2)}

Error-only log (text):
${errorText}

Error-only log (JSON):
${JSON.stringify(errorJson, null, 2)}

User request:
${userMessage.trim()}`
}

export function defaultDiagnosisMessage(): string {
  return "Diagnose this failed inference run. Explain the root cause and recommend the smallest fix to get the pipeline passing."
}
