// AI : shared Zod schemas for API route bodies — reject unknown keys and cap sizes server-side.

import { z } from "zod";
import { ASSISTANT_HISTORY_LIMIT } from "@/lib/assistant-chat-types";
import { TOPUP_OPTIONS_CENTS } from "@/lib/billing_config";
import { MAX_ASSISTANT_MESSAGE_CHARS } from "./assistant-route";

export const MAX_FEEDBACK_MESSAGE_CHARS = 8_000;
export const MAX_CLIENT_STEP_OUTPUT_CHARS = 2_000_000;
export const MAX_CLIENT_LOGS = 500;
export const MAX_RUN_NOTES_CHARS = 8_000;

const projectIdSchema = z.string().trim().min(1).max(128);
const docIdSchema = z.string().trim().min(1).max(128);

// AI : bound arbitrary JSON payloads without losing structure — prevents multi-MB POST bodies.
function jsonSizeBounded(maxChars: number) {
  return z.unknown().superRefine((val, ctx) => {
    try {
      if (JSON.stringify(val).length > maxChars) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `payload too large (max ${maxChars} chars)` });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "payload must be JSON-serializable" });
    }
  });
}

export const jobLogEntrySchema = z.object({
  at: z.number(),
  level: z.enum(["debug", "info", "warn", "error"]),
  tag: z.string().max(256),
  line: z.string().max(8_000),
  moduleId: z.string().max(128).optional(),
});

export const feedbackBodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_CHARS),
});

export const createProjectBodySchema = z
  .object({
    templateId: projectIdSchema.optional(),
    cloneFrom: projectIdSchema.optional(),
  })
  .strict();

export const projectPatchSchema = z
  .object({
    name: z.string().max(200).optional(),
    kind: z.string().max(64).optional(),
    models: z.array(z.unknown()).max(200).optional(),
    typeAliases: z.array(z.unknown()).max(100).optional(),
    modules: z.array(z.unknown()).max(200).optional(),
    strategies: z.array(z.unknown()).max(50).optional(),
    seedDocNames: z.array(z.string().max(256)).max(200).optional(),
    expectedOutputs: z.record(z.string(), z.unknown()).optional(),
    inferencePresets: z.array(z.unknown()).max(50).optional(),
    createdAt: z.number().optional(),
    lastOpenedAt: z.number().optional(),
    documentation: z.string().max(MAX_ASSISTANT_MESSAGE_CHARS).optional(),
  })
  .strict();

const probabilisticFieldSchema = z.object({
  path: z.string().max(500),
  expected: z.unknown(),
  actual: z.unknown(),
});

const probabilisticEvalStepSchema = z.object({
  label: z.string().max(200),
  fields: z.array(probabilisticFieldSchema).max(50),
});

export const testingEvaluateBodySchema = z.object({
  steps: z.array(probabilisticEvalStepSchema).min(1).max(20),
  model: z.string().max(128).optional(),
});

export const pipelineSummaryBodySchema = z.object({
  projectId: projectIdSchema,
  model: z.string().max(128).optional(),
});

export const testingAssistantBodySchema = z.object({
  projectId: projectIdSchema,
  instruction: z.string().trim().min(1).max(MAX_ASSISTANT_MESSAGE_CHARS),
  model: z.string().max(128).optional(),
});

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid request body";
}

export async function parseRequestJson<T>(
  req: Request,
  schema: z.ZodType<T>,
  emptyDefault?: T,
): Promise<T | { error: string }> {
  let body: unknown;
  try {
    const raw = await req.text();
    body = raw.trim() ? JSON.parse(raw) : (emptyDefault ?? undefined);
    if (body === undefined) return { error: "Invalid JSON body" };
  } catch {
    return { error: "Invalid JSON body" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  return parsed.data;
}
