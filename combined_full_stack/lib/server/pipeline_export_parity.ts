// AI : Headless UI↔export parity — calls run_engine + generated TS export only (never Next.js / browser).
// AI : Live path: OpenRouter flash + OPENROUTER_SEED via .env. Re-enable HARD_PARITY_SEEDS once live traces stay green.
// AI : Run with `npm run test:parity` only — excluded from default `npm test` so it won't brick the terminal.
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { testValuesEqual } from "@/lib/deep_equal";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import {
  formatCustomCodeFailureLog,
  runAssertWithFallbacks,
  runCustomCodeWithFallbacks,
} from "@/lib/custom_code";
import { orderedInputModules } from "@/lib/inference-input";
import { inputDocsByModuleFromAssignment } from "@/lib/inference-input-assignment";
import type { InputDocsAssignment } from "@/lib/inference-input-core";
import { labelAsStateKey } from "@/lib/server/pipeline_state";
import { flattenPipelineModules } from "@/lib/fork-pipeline";
import { runPipeline, resumeRunPipeline } from "@/lib/server/run_engine";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { clearLlmProviderCache } from "@/lib/server/llm/registry";
import { SEED_LLM_PROVIDER_ID } from "@/lib/server/llm/providers/seed";
import { seedOpenAiChatCompletion } from "@/lib/server/llm/seed_response";
import { DEEPSEEK_FLASH_SLUG, DEEPSEEK_SLUG } from "@/lib/server/openrouter_slugs";
import { generatePipelineSourceTs } from "@/lib/server/pipeline_ts_export";
import { exportRuntimeTsPath } from "@/lib/server/pipeline_export_runtime_files";
import { loadProjectSeed, resolveSeedDocPath, type ProjectSeed } from "@/lib/server/seed";
import { hashContent, type Store } from "@/lib/server/store";
import { computeInvalid } from "@/lib/server/validity";
import {
  CustomCodeLanguage,
  DocLabel,
  ModuleKind,
  RunStatus,
  type DocId,
  type DocRef,
  type ModelId,
  type PipelineRun,
  type Project,
  type ProjectId,
  type RunFingerprint,
  type RunId,
  type RunTestReport,
} from "@/lib/server/types";
import type {
  FileContentHash,
  ParserCacheRow,
  ParserKind,
  VisionCacheKey,
  VisionCacheRow,
} from "@/lib/server/doc_text_cache";
import type { JobLogEntry } from "@/lib/run-types";
import { JobLogLevel } from "@/lib/run-types";

export type ParityTrace = { label: string; output: unknown };
export type ParityCase = { name: string; inputs: Record<string, string | string[]> };

type ExampleDoc = { ref: DocRef; content: string };

const RESUME_MAX = 32;

// AI : cheap deterministic OpenRouter parity — flash preferred; OPENROUTER_MODEL overrides slug.
export const PARITY_MODEL_ID = "openrouter:deepseek-v4-flash" as ModelId;
export const PARITY_DEFAULT_SEED = 42;

export function parityOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEEPSEEK_FLASH_SLUG;
}

export function parityOpenRouterSeed(): number {
  const raw = process.env.OPENROUTER_SEED?.trim();
  if (raw && Number.isFinite(Number(raw))) return Math.trunc(Number(raw));
  return PARITY_DEFAULT_SEED;
}

export function parityHasOpenRouterKey(): boolean {
  return !!process.env.OPENROUTER_API_KEY?.trim();
}

/** Catalog model id for UI runs — flash unless OPENROUTER_MODEL points at the default deepseek chat slug. */
export function parityUiModelId(): ModelId {
  const slug = parityOpenRouterModel();
  if (slug === DEEPSEEK_SLUG || slug.includes("deepseek-chat")) return "openrouter:deepseek-v4" as ModelId;
  return PARITY_MODEL_ID;
}

function projectSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pipeline"
  );
}

/** Offline mock provider — kept for unit tests of seed_response / local HTTP mock. */
export function withSeedLlmEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = SEED_LLM_PROVIDER_ID;
  clearLlmProviderCache();
  return fn().finally(() => {
    if (prev === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prev;
    clearLlmProviderCache();
  });
}

/** Live OpenRouter parity — clears mock provider, forces seed for deterministic sampling. */
export function withParityOpenRouterEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevProvider = process.env.LLM_PROVIDER;
  const prevSeed = process.env.OPENROUTER_SEED;
  const prevQuiet = process.env.PARITY_QUIET;
  if (prevProvider === SEED_LLM_PROVIDER_ID) delete process.env.LLM_PROVIDER;
  process.env.OPENROUTER_SEED = String(parityOpenRouterSeed());
  process.env.PARITY_QUIET = "1";
  clearLlmProviderCache();
  return fn().finally(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prevProvider;
    if (prevSeed === undefined) delete process.env.OPENROUTER_SEED;
    else process.env.OPENROUTER_SEED = prevSeed;
    if (prevQuiet === undefined) delete process.env.PARITY_QUIET;
    else process.env.PARITY_QUIET = prevQuiet;
    clearLlmProviderCache();
  });
}

function parityProjectOverride(project: Project): Project {
  const model = parityUiModelId();
  return {
    ...project,
    modules: project.modules.map((m) => ({
      ...m,
      cached: false,
      // AI : force cheap flash on every LLM-bearing step; drop input-desc checks to save calls.
      model: m.model ? model : m.model,
      inputDescription: undefined,
    })),
  };
}

export function startSeedLlmServer(port = 0): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const path = req.url?.split("?")[0] ?? "";
      if (req.method === "POST" && path.endsWith("/chat/completions")) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: { messages?: { role?: string; content?: unknown }[]; response_format?: { type?: string } } = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as typeof body;
        } catch {
          res.writeHead(400);
          res.end("bad json");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(seedOpenAiChatCompletion(body)));
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("seed llm server failed to bind"));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

export function parityCasesForSeed(seed: ProjectSeed): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const p of seed.project.inferencePresets ?? []) {
    if (p.inputs && Object.keys(p.inputs).length) {
      cases.push({ name: `inference:${p.name}`, inputs: { ...p.inputs } });
    }
  }
  for (const spec of seed.docSpecs) {
    if (!/_testing\.json$/i.test(spec.name)) continue;
    try {
      const raw = JSON.parse(readFileSync(spec.path, "utf8")) as {
        inputs?: Record<string, string | string[]>;
      };
      if (raw.inputs && Object.keys(raw.inputs).length) {
        cases.push({ name: `test:${spec.name}`, inputs: { ...raw.inputs } });
      }
    } catch {
      /* skip */
    }
  }
  if (!cases.length) {
    const inputMods = orderedInputModules(seed.project.modules);
    const inferenceDocs = seed.docSpecs.filter((d) => d.label === DocLabel.Inference);
    const inputs: Record<string, string> = {};
    for (const m of inputMods) {
      const key = labelAsStateKey(m.label);
      const hit =
        inferenceDocs.find((d) => (m.inputNameContains ? d.name.includes(m.inputNameContains) : true)) ??
        inferenceDocs[0];
      if (hit) inputs[key] = hit.name;
    }
    if (Object.keys(inputs).length) cases.push({ name: "default", inputs });
  }
  return cases;
}

function flatInputFiles(inputs: Record<string, string | string[]>): string[] {
  const out: string[] = [];
  for (const v of Object.values(inputs)) {
    if (Array.isArray(v)) out.push(...v);
    else if (v) out.push(v);
  }
  return out;
}

function docsForInputs(seed: ProjectSeed, inputs: Record<string, string | string[]>): ExampleDoc[] {
  const out: ExampleDoc[] = [];
  const seen = new Set<string>();
  for (const fileName of flatInputFiles(inputs)) {
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const spec = seed.docSpecs.find((d) => d.name === fileName);
    const path = spec?.path ?? resolveSeedDocPath(fileName);
    const content = readFileSync(path, "utf8");
    const id = hashContent(content);
    out.push({
      ref: {
        id,
        name: fileName,
        type: spec?.type ?? ("text" as DocRef["type"]),
        label: spec?.label ?? DocLabel.Inference,
        sizeKb: Math.max(1, Math.round(content.length / 1024)),
        uploadedAt: Date.now(),
        preview: content.slice(0, 180),
      },
      content,
    });
  }
  return out;
}

// AI : TODO (arch-ephemeral-store) — copy of landingEphemeralStore; one ephemeralStore(project, docs).
function ephemeralStore(project: Project, docs: ExampleDoc[]): Store {
  const docMap = new Map(docs.map((d) => [d.ref.id, d]));
  const runs: PipelineRun[] = [];
  const runProjects: Record<string, ProjectId> = {};
  return {
    projects: () => [project],
    project: (id) => (id === project.id ? project : undefined),
    saveProject: () => {},
    deleteProject: () => false,
    docs: () => docs.map((d) => d.ref),
    docContent: (id) => docMap.get(id)?.content,
    parserCacheGetByFileHash: (_h: FileContentHash, _p: ParserKind) => undefined,
    parserCacheGetByDoc: (_id: DocId) => undefined,
    parserCacheSet: (_row: Omit<ParserCacheRow, "createdAt"> & { createdAt?: number }) => {},
    visionCacheGet: (_key: VisionCacheKey) => undefined,
    visionCacheSet: (_row: Omit<VisionCacheRow, "createdAt"> & { createdAt?: number }) => {},
    visionCachesForDoc: (_id: DocId) => [],
    addDoc: (name, type, content, label) => {
      const id = hashContent(content);
      const ref: DocRef = {
        id,
        name,
        type,
        label,
        sizeKb: Math.max(1, Math.round(content.length / 1024)),
        uploadedAt: Date.now(),
        preview: content.slice(0, 180),
      };
      docMap.set(id, { ref, content });
      return ref;
    },
    repointDocName: () => false,
    removeDoc: () => false,
    runs: (pid) => (pid ? runs.filter((r) => runProjects[r.id] === pid) : runs),
    findRunByFingerprint: (_pid: ProjectId, _fp: RunFingerprint) => undefined,
    addRun: (pid, run) => {
      runProjects[run.id] = pid;
      runs.unshift(run);
    },
    updateRunNotes: () => false,
    updateRunTest: (_rid: RunId, _test: RunTestReport | undefined) => false,
    flush: async () => {},
  };
}

function assignmentFromInputs(
  project: Project,
  docs: ExampleDoc[],
  inputs: Record<string, string | string[]>,
): InputDocsAssignment {
  const byName = new Map(docs.map((d) => [d.ref.name, d.ref]));
  const assignment: InputDocsAssignment = {};
  for (const m of orderedInputModules(project.modules)) {
    const key = labelAsStateKey(m.label);
    const raw = inputs[key] ?? inputs[m.label];
    if (raw == null) throw new Error(`parity case missing input for "${m.label}"`);
    const names = Array.isArray(raw) ? raw : [raw];
    const refs = names.map((fileName) => {
      const ref = byName.get(fileName);
      if (!ref) throw new Error(`parity case doc not loaded: ${fileName}`);
      return ref;
    });
    assignment[m.id] = refs.length === 1 ? refs[0]! : refs;
  }
  return assignment;
}

async function resolveClientStep(
  checkpoint: import("@/lib/server/run_checkpoint").RunCheckpoint,
): Promise<{ output?: unknown; error?: string; clientLogs?: JobLogEntry[] }> {
  const step = checkpoint.clientStep;
  if (step.kind === "human-review") return { output: step.input };
  const entries = step.entries ?? [];
  if (!entries.length) return { error: `${step.kind} step "${step.label}" has no code` };
  if (entries.some((e) => e.language === CustomCodeLanguage.Python)) {
    return { error: `parity harness runs TypeScript custom-code only (step "${step.label}")` };
  }
  const clientLogs: JobLogEntry[] = [];
  const tag = step.kind === "assert" ? "assert" : "custom-code";
  try {
    const { output, failures } =
      step.kind === "assert"
        ? await runAssertWithFallbacks(entries, step.input, step.pipelineState, step.expectedOutputs, {
            maxRunMs: step.maxRunMs,
          })
        : await runCustomCodeWithFallbacks(entries, step.input, step.pipelineState, { maxRunMs: step.maxRunMs });
    for (const f of failures) {
      clientLogs.push({
        at: Date.now(),
        level: JobLogLevel.Warn,
        tag,
        line: formatCustomCodeFailureLog(f, tag),
        moduleId: step.moduleId,
      });
    }
    return { output, clientLogs };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), clientLogs };
  }
}

function tracesFromRun(run: PipelineRun): ParityTrace[] {
  return run.steps
    .filter((s) => s.outputJson != null && s.outputJson !== "")
    .map((s) => {
      let output: unknown = s.outputJson;
      try {
        output = JSON.parse(s.outputJson!);
      } catch {
        /* keep */
      }
      return { label: s.label, output };
    });
}

// AI : headless — same server run_engine path the UI uses; no Next.js / browser.
export async function runUiParityTrace(
  project: Project,
  seed: ProjectSeed,
  inputs: Record<string, string | string[]>,
): Promise<ParityTrace[]> {
  const docs = docsForInputs(seed, inputs);
  const store = ephemeralStore(project, docs);
  const assignment = assignmentFromInputs(project, docs, inputs);
  const byModule = inputDocsByModuleFromAssignment(orderedInputModules(project.modules), assignment);
  const primary = (Object.values(byModule).flat()[0] as DocId | undefined) ?? docs[0]!.ref.id;

  let run: PipelineRun | undefined;
  let resumes = 0;
  const override = parityProjectOverride(project);
  const model = parityUiModelId();
  try {
    run = await runPipeline(store, project.id, primary, {
      model,
      inputDocsByModule: byModule,
      persist: false,
      liveHtml: false,
      projectOverride: override,
      cacheOwnerId: `parity:${project.id}:${Date.now()}`,
      runMeta: { notes: "parity-ui" },
    });
  } catch (firstErr) {
    let err: unknown = firstErr;
    while (err instanceof PipelinePausedError) {
      if (resumes >= RESUME_MAX) throw new Error(`too many client-code pauses (${RESUME_MAX})`);
      resumes += 1;
      const clientStep = await resolveClientStep(err.checkpoint);
      if (clientStep.error) throw new Error(clientStep.error);
      try {
        run = await resumeRunPipeline(store, err.checkpoint, clientStep, {
          model,
          persist: false,
          liveHtml: false,
          projectOverride: override,
          cacheOwnerId: `parity:${project.id}`,
          clientLogs: clientStep.clientLogs,
          runMeta: { notes: "parity-ui" },
        });
        err = null;
      } catch (resumeErr) {
        err = resumeErr;
      }
    }
    if (err) throw err;
  }
  if (!run) throw new Error("UI parity run produced no result");
  if (run.status === RunStatus.Error) {
    const last = [...run.steps].reverse().find((s) => s.status === "error");
    throw new Error(last?.outputPreview ?? "UI parity run finished with errors");
  }
  return tracesFromRun(run);
}

type TsExportModule = {
  configurePipelineRuntime: (cfg: Record<string, unknown>) => void;
  registerCustomLlmProvider: (provider: {
    id: string;
    capabilities: { batch: boolean; streaming: boolean; vision: boolean };
    chat: (prompt: string, providerModel: string, jsonMode: boolean) => Promise<string>;
    chatBatch?: (prompts: string[], providerModel: string, jsonMode: boolean) => Promise<string[]>;
  }) => void;
  runPipeline: (input: unknown) => Promise<unknown>;
  getLastRunTrace: () => { label: string; output: unknown }[];
};

export async function runTsExportParityTrace(
  project: Project,
  seed: ProjectSeed,
  inputs: Record<string, string | string[]>,
): Promise<ParityTrace[]> {
  // AI : keep under project root — vitest/vite cannot import absolute tmp paths outside the app.
  const cacheRoot = join(process.cwd(), ".parity-cache");
  mkdirSync(cacheRoot, { recursive: true });
  const dir = mkdtempSync(join(cacheRoot, "ts-"));
  try {
    const source = generatePipelineSourceTs(project);
    const file = join(dir, `${projectSlug(project.name)}_pipeline.ts`);
    writeFileSync(file, source, "utf8");
    copyFileSync(exportRuntimeTsPath(), join(dir, "pipeline_runtime.ts"));
    const mod = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as TsExportModule;
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const needsLlm = flattenPipelineModules(project.modules).some(
      (m) =>
        m.kind === ModuleKind.Llm ||
        m.kind === ModuleKind.LlmBatch ||
        m.kind === ModuleKind.ExampleSelect ||
        m.kind === ModuleKind.Parallel,
    );
    if (needsLlm && !apiKey) throw new Error("OPENROUTER_API_KEY missing — set it in the repo root .env");
    const firstDoc = flatInputFiles(inputs)[0];
    const firstContent = firstDoc
      ? readFileSync(
          seed.docSpecs.find((d) => d.name === firstDoc)?.path ?? resolveSeedDocPath(firstDoc),
          "utf8",
        )
      : undefined;
    mod.configurePipelineRuntime({
      ...(apiKey
        ? {
            openRouterApiKey: apiKey,
            openRouterModel: parityOpenRouterModel(),
            openRouterSeed: parityOpenRouterSeed(),
          }
        : {}),
      // AI : quote steps in exports need source text — use first input doc (same as UI sourceText).
      ...(firstContent
        ? { sourceText: firstContent, sourceDocId: firstDoc }
        : {}),
    });

    const inputMods = orderedInputModules(project.modules);
    const readDoc = (name: string) => {
      const spec = seed.docSpecs.find((d) => d.name === name);
      const path = spec?.path ?? resolveSeedDocPath(name);
      return { content: readFileSync(path, "utf8"), filename: name };
    };

    if (inputMods.length > 1) {
      const payload: Record<string, unknown> = {};
      for (const m of inputMods) {
        const key = labelAsStateKey(m.label);
        const raw = inputs[key] ?? inputs[m.label];
        if (raw == null) throw new Error(`missing input for ${m.label}`);
        if (Array.isArray(raw)) payload[key] = raw.map(readDoc);
        else payload[key] = readDoc(raw);
      }
      await mod.runPipeline(payload);
    } else {
      const m = inputMods[0]!;
      const key = labelAsStateKey(m.label);
      const raw = inputs[key] ?? inputs[m.label] ?? flatInputFiles(inputs)[0];
      if (raw == null) throw new Error("missing input document");
      await mod.runPipeline(Array.isArray(raw) ? raw.map(readDoc) : readDoc(raw));
    }
    return mod.getLastRunTrace().map((s) => ({ label: s.label, output: s.output }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function seedSupportsExportLanguage(
  project: Project,
  language: CustomCodeLanguage | "rust" | "go",
): boolean {
  for (const m of project.modules) {
    if (
      m.kind !== ModuleKind.CustomCode &&
      m.kind !== ModuleKind.Assert &&
      !(m.kind === ModuleKind.Transform && m.code?.trim())
    ) {
      continue;
    }
    const entries = customCodeEntriesForModule(m);
    if (!entries.length) continue;
    if (language === "rust" || language === "go") return false;
    if (!entries.some((e) => e.language === language)) return false;
  }
  return true;
}

export function compareParityTraces(ui: ParityTrace[], other: ParityTrace[]): { ok: boolean; diffs: string[] } {
  const diffs: string[] = [];
  const byLabel = new Map(other.map((s) => [s.label, s.output]));
  for (const step of ui) {
    if (!byLabel.has(step.label)) {
      diffs.push(`missing step in export: ${step.label}`);
      continue;
    }
    // AI : UI Document materialization adds doc_id; exports use {content,filename} — strip for compare.
    if (!testValuesEqual(step.output, byLabel.get(step.label), undefined) &&
        !testValuesEqual(stripDocNoise(step.output), stripDocNoise(byLabel.get(step.label)))) {
      diffs.push(`mismatch at "${step.label}"`);
    }
  }
  for (const step of other) {
    if (!ui.some((s) => s.label === step.label)) diffs.push(`extra export step: ${step.label}`);
  }
  return { ok: diffs.length === 0, diffs };
}

function stripDocNoise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDocNoise);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === "doc_id" || k === "docId") continue;
      out[k] = stripDocNoise(v);
    }
    return out;
  }
  return value;
}

export function seedIsExportable(project: Project): boolean {
  if (flattenPipelineModules(project.modules).some((m) => m.kind === ModuleKind.Sql)) return false;
  return (
    computeInvalid(project.modules, project.models, { typeAliases: project.typeAliases ?? [] }).size === 0
  );
}

export function loadSeedForParity(seedFile: string): ProjectSeed {
  return loadProjectSeed(seedFile);
}
