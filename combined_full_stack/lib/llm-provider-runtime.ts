"use client";

// AI : browser-only — compile user LLM provider TS and call chat/chatBatch during inference.
import { invariant } from "@/lib/assert";
import { getCustomLlmProvider, listCustomLlmProviders, type CustomLlmProviderDef } from "@/lib/custom-llm-providers";
import { stripTypeScriptForParseCheck } from "@/lib/llm-provider-validate";

export type BrowserLlmProvider = {
  readonly id: string;
  readonly capabilities: { batch: boolean; streaming: boolean; vision: boolean };
  chat(prompt: string, providerModel: string, jsonMode: boolean): Promise<string>;
  chatBatch?(prompts: string[], providerModel: string, jsonMode: boolean): Promise<string[]>;
};

const LLM_PROVIDER_TIMEOUT_MS = 120_000;

function stripProviderExports(code: string): { body: string; exportName: string } {
  const exportMatch = code.match(/export\s+const\s+(\w+)\s*[:=]/);
  const exportName = exportMatch?.[1];
  if (!exportName) {
    throw new Error("Export a provider object: export const myProvider = { id, capabilities, chat }");
  }
  let body = code.replace(/^export\s+(type|interface)\s+[\s\S]*?(?=\nexport|\nconst|\nasync|\nfunction|$)/gm, "");
  body = body.replace(/^export\s+/gm, "");
  return { body, exportName };
}

// AI : SECURITY — browser inference only; never call on the server (user fetch logic + keys stay client-side).
export function compileLlmProvider(code: string): BrowserLlmProvider {
  const trimmed = code.trim();
  const { body, exportName } = stripProviderExports(trimmed);
  try {
    // eslint-disable-next-line no-new-func -- parse-only syntax check on TS-stripped source
    new Function(stripTypeScriptForParseCheck(trimmed));
  } catch (e) {
    throw new Error(`Syntax error: ${(e as Error).message}`);
  }
  const fn = new Function(
    "process",
    `${body}; return ${exportName};`,
  ) as (processShim: { env: Record<string, string | undefined> }) => unknown;
  const provider = fn({ env: {} });
  invariant(provider && typeof provider === "object", "provider export must be an object");
  const p = provider as BrowserLlmProvider;
  invariant(typeof p.id === "string" && p.id.length > 0, "provider.id is required");
  invariant(typeof p.chat === "function", "provider.chat(prompt, providerModel, jsonMode) is required");
  invariant(p.capabilities && typeof p.capabilities === "object", "provider.capabilities is required");
  return p;
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export function resolveBrowserLlmProvider(
  providerId: string,
  projectProviders?: CustomLlmProviderDef[],
): BrowserLlmProvider {
  const fromProject = projectProviders?.find((p) => p.id === providerId);
  const def = fromProject ?? getCustomLlmProvider(providerId);
  if (!def) {
    const known = [...(projectProviders ?? []), ...listCustomLlmProviders()].map((p) => p.id);
    throw new Error(
      `Unknown LLM provider "${providerId}" — add it in Settings → LLM providers` +
        (known.length ? ` (known: ${known.join(", ")})` : ""),
    );
  }
  return compileLlmProvider(def.code);
}

export async function runBrowserLlmPrompts(
  spec: import("@/lib/llm-client-step").LlmClientStepSpec,
  projectProviders?: CustomLlmProviderDef[],
): Promise<unknown> {
  const provider = resolveBrowserLlmProvider(spec.providerId, projectProviders);
  const runOne = (prompt: string) =>
    withTimeout(
      provider.chat(prompt, spec.providerModel, spec.jsonMode),
      LLM_PROVIDER_TIMEOUT_MS,
      `LLM provider ${spec.providerId}`,
    );

  let rawReplies: string[];
  if (spec.prompts.length === 0) throw new Error("LLM client step has no prompts");
  if (spec.useBatch && spec.prompts.length > 1 && provider.chatBatch) {
    rawReplies = await withTimeout(
      provider.chatBatch(spec.prompts, spec.providerModel, spec.jsonMode),
      LLM_PROVIDER_TIMEOUT_MS,
      `LLM provider ${spec.providerId} batch`,
    );
  } else if (spec.useBatch && spec.prompts.length > 1 && provider.capabilities.batch) {
    rawReplies = await Promise.all(spec.prompts.map((p) => runOne(p)));
  } else if (spec.prompts.length === 1) {
    rawReplies = [await runOne(spec.prompts[0]!)];
  } else {
    rawReplies = await Promise.all(spec.prompts.map((p) => runOne(p)));
  }

  if (rawReplies.length !== spec.prompts.length) {
    throw new Error(
      `LLM provider returned ${rawReplies.length} reply(s) for ${spec.prompts.length} prompt(s)`,
    );
  }

  const parsed = rawReplies.map((raw) => {
    const json = extractJson(raw);
    try {
      return JSON.parse(json) as unknown;
    } catch (e) {
      throw new Error(`LLM provider returned invalid JSON: ${(e as Error).message}`);
    }
  });

  return spec.useBatch && spec.prompts.length > 1 ? parsed : parsed[0];
}
