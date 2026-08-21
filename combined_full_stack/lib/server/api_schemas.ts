// AI : shared Zod schemas for API route bodies — reject unknown keys and cap sizes server-side.

import { JobLogLevel } from "@/lib/run-types";
import { CustomCodeLanguage } from "@/lib/server/types";
import { z } from "zod";
import { ASSISTANT_HISTORY_LIMIT } from "@/lib/assistant-chat-types";
import { TOPUP_OPTIONS_CENTS, FEEDBACK_MIN_CHARS } from "@/lib/billing_config";
import {
  DocLabel,
  InputType,
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
  ModuleKind,
  StrategyKind,
  type MarketplaceListingId,
  type ProjectId,
  type SharedLinkId,
} from "@/lib/server/types";
import { MAX_ASSISTANT_MESSAGE_CHARS } from "./assistant-route";
import {
  MAX_UI_CONTEXT_FIELD_PATH_CHARS,
  MAX_UI_CONTEXT_ITEMS,
  MAX_UI_CONTEXT_LABEL_CHARS,
  MAX_UI_CONTEXT_SNIPPET_CHARS,
  UI_CONTEXT_KINDS,
} from "@/lib/ui-context-types";

export const MAX_FEEDBACK_MESSAGE_CHARS = 8_000;
export const MAX_CLIENT_STEP_OUTPUT_CHARS = 2_000_000;
export const MAX_CLIENT_LOGS = 500;
export const MAX_RUN_NOTES_CHARS = 8_000;
export const MAX_DOC_CONTENT_CHARS = 32_000;
export const MAX_API_BODY_CHARS = 4_000_000;

const projectIdSchema = z.string().trim().min(1).max(128);
const docIdSchema = z.string().trim().min(1).max(128);
const MAX_MODULE_STRING_CHARS = 64_000;
const MAX_MODULE_PAYLOAD_CHARS = 120_000;
const MAX_STRUCTURE_PAYLOAD_CHARS = 50_000;

// AI : pub_ = public link, emb_ = website Embed (same shared_links table + run stack).
export const sharedLinkIdSchema = z.string().regex(/^(pub|emb)_[a-z0-9]{10,32}$/i);
export const hostedApiIdSchema = z.string().regex(/^api_[a-z0-9]{10,32}$/i);
export const marketplaceListingIdSchema = z.string().regex(/^mkt_[a-z0-9]{10,32}$/i);
export const teamIdSchema = z.string().regex(/^team_[a-z0-9]{10,32}$/i);
export const teamInviteTokenSchema = z.string().regex(/^tinv_[a-z0-9]{10,32}$/i);

export const createTeamBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const teamInviteBodySchema = z
  .object({
    email: z.string().trim().email().max(320),
    role: z.enum(["admin", "member"]).default("member"),
  })
  .strict();

export const acceptTeamInviteBodySchema = z
  .object({
    token: teamInviteTokenSchema,
  })
  .strict();

export const projectTeamBodySchema = z
  .object({
    teamId: teamIdSchema.nullable(),
  })
  .strict();
export const userBillingKeyIdSchema = z.string().trim().min(1).max(128);

export function parseProjectId(raw: string): ProjectId | null {
  const parsed = projectIdSchema.safeParse(raw);
  return parsed.success ? (parsed.data as ProjectId) : null;
}

export const sharedProgressQuerySchema = z.object({
  jobId: z.string().trim().min(1).max(128),
  token: z.string().trim().min(1).max(256),
});

export const sharedDownloadQuerySchema = sharedProgressQuerySchema.extend({
  runId: z.string().trim().min(1).max(128),
  format: z.enum(["json", "markdown"]).optional(),
});

// AI : reject malformed ids early — same 404 as missing link to avoid enumeration.
export function parseSharedLinkId(raw: string): SharedLinkId | null {
  const parsed = sharedLinkIdSchema.safeParse(raw);
  return parsed.success ? (parsed.data as SharedLinkId) : null;
}

export function parseHostedApiId(raw: string): import("./types").HostedApiId | null {
  const parsed = hostedApiIdSchema.safeParse(raw);
  return parsed.success ? (parsed.data as import("./types").HostedApiId) : null;
}

export function parseMarketplaceListingId(raw: string): MarketplaceListingId | null {
  const parsed = marketplaceListingIdSchema.safeParse(raw);
  return parsed.success ? (parsed.data as MarketplaceListingId) : null;
}

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

// AI : SECURITY — allowlist PipelineModule keys only (.strict); size-bounded strings.
const typeExprPatchSchema = jsonSizeBounded(8_000);
const customCodeEntryPatchSchema = z
  .object({
    typescript: z.string().max(MAX_MODULE_STRING_CHARS).optional(),
    python: z.string().max(MAX_MODULE_STRING_CHARS).optional(),
  })
  .strict();

// AI : merge layer — shared by default + path rules on MergePolicy
const mergeLayerPolicyPatchSchema = z
  .object({
    list: z.nativeEnum(MergeListStrategy).optional(),
    dict: z.nativeEnum(MergeDictStrategy).optional(),
    scalar: z.nativeEnum(MergeScalarStrategy).optional(),
    itemKey: z.string().max(200).optional(),
  })
  .strict();

const mergePolicyPatchSchema = z
  .object({
    default: mergeLayerPolicyPatchSchema.optional(),
    rules: z
      .array(
        z
          .object({
            path: z.string().max(512),
            policy: mergeLayerPolicyPatchSchema,
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict();

const pipelineModulePatchSchema = z
  .object({
    id: z.string().max(128),
    kind: z.nativeEnum(ModuleKind),
    label: z.string().max(200),
    note: z.string().max(4_000).optional(),
    inStructureId: z.string().max(128).optional(),
    outStructureId: z.string().max(128).optional(),
    inType: typeExprPatchSchema.optional(),
    outType: typeExprPatchSchema.optional(),
    inputType: z.union([z.nativeEnum(InputType), z.array(z.nativeEnum(InputType)).max(20)]).optional(),
    inputNameContains: z.string().max(256).optional(),
    inputDescription: z.string().max(4_000).optional(),
    checkInputDescription: z.boolean().optional(),
    inputMinCount: z.number().int().min(0).max(100).optional(),
    inputCompatWith: z
      .object({
        moduleId: z.string().max(128),
        keys: z
          .array(
            z
              .object({
                label: z.string().max(200),
                compare: z.enum(["equal", "set-equal"]).optional(),
                upstream: z.discriminatedUnion("kind", [
                  z.object({
                    kind: z.literal("json-path"),
                    path: z.string().max(512),
                    normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                  }),
                  z.object({
                    kind: z.literal("text-regex"),
                    pattern: z.string().max(512),
                    group: z.number().int().min(0).max(20).optional(),
                    flags: z.string().max(8).optional(),
                    normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                  }),
                  z.object({ kind: z.literal("question-ids-text") }),
                ]),
                local: z.discriminatedUnion("kind", [
                  z.object({
                    kind: z.literal("json-path"),
                    path: z.string().max(512),
                    normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                  }),
                  z.object({
                    kind: z.literal("text-regex"),
                    pattern: z.string().max(512),
                    group: z.number().int().min(0).max(20).optional(),
                    flags: z.string().max(8).optional(),
                    normalize: z.enum(["lower-trim", "question-id", "question-id-set"]).optional(),
                  }),
                  z.object({ kind: z.literal("question-ids-text") }),
                ]),
              })
              .strict(),
          )
          .max(20),
      })
      .strict()
      .optional(),
    prompt: z.string().max(MAX_MODULE_STRING_CHARS).optional(),
    code: z.string().max(MAX_MODULE_STRING_CHARS).optional(),
    fallbackList: z.array(customCodeEntryPatchSchema).max(20).optional(),
    maxRunMs: z.number().int().min(1).max(3_600_000).optional(),
    model: z.string().max(128).optional(),
    costLimitCents: z.number().min(0).max(1_000_000).optional(),
    // AI : chunk — allowlisted on PUT so .strict() does not reject builder saves
    chunkSize: z.number().int().min(1).max(1_000_000).optional(),
    chunkOverlap: z.number().int().min(0).max(1_000_000).optional(),
    chunkTextField: z.string().max(512).optional(),
    // AI : merge — recursive structural policy (+ optional custom TS override)
    mergePolicy: mergePolicyPatchSchema.optional(),
    mergeCustom: z.string().max(MAX_MODULE_STRING_CHARS).optional(),
    mergeStateLabel: z.string().max(200).optional(),
    mergeWrapListField: z.string().max(200).optional(),
    // AI : assemble — field → spine | state label
    assembleBindings: z
      .record(
        z.string().max(200),
        z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("spine") }).strict(),
          z.object({ kind: z.literal("state"), label: z.string().max(200) }).strict(),
          z
            .object({
              kind: z.literal("path"),
              from: z.union([
                z.literal("spine"),
                z.object({ label: z.string().max(200) }).strict(),
              ]),
              path: z.string().max(512),
            })
            .strict(),
        ]),
      )
      .optional(),
    parallelBranches: z
      .array(
        z
          .object({
            id: z.string().max(128),
            field: z.string().max(200),
            prompt: z.string().max(MAX_MODULE_STRING_CHARS),
            outStructureId: z.string().max(128),
            model: z.string().max(128).optional(),
            note: z.string().max(4_000).optional(),
          })
          .strict(),
      )
      .max(32)
      .optional(),
    forkJoin: z.enum(["product", "assemble", "merge"]).optional(),
    forkBranches: z
      .array(
        z
          .object({
            id: z.string().max(128),
            label: z.string().max(200),
            modules: z.array(z.any()).max(200),
          })
          .strict(),
      )
      .max(4)
      .optional(),
    // AI : example-select — allowlisted on PUT so .strict() does not reject builder saves
    exampleContextLabel: z.string().max(200).optional(),
    exampleContextField: z.string().max(512).optional(),
    exampleReasonField: z.string().max(200).optional(),
    examplePreFilterMax: z.number().int().min(1).max(10_000).optional(),
    // AI : TODO (example-select-view) — examplePromptFields: z.array(z.string().max(200)).max(64).optional()
    examplePromptFields: z.array(z.string().max(200)).max(64).optional(),
    examplePromptView: z.string().max(MAX_MODULE_STRING_CHARS).optional(),
    webhookUrl: z.string().max(4_096).optional(),
    webhookMethod: z.enum(["POST", "PUT", "PATCH"]).optional(),
    webhookAuthEnv: z.string().max(256).optional(),
    webhookTimeoutMs: z.number().int().min(1_000).max(600_000).optional(),
    webhookIncludeState: z.boolean().optional(),
    webhookResponsePath: z.string().max(512).optional(),
    // AI : TODO (n8n-stage-A-api) — allowlist n8nNodeType, n8nNodeVersion, n8nParameters (record),
    // AI :   n8nCredentialEnv, n8nBaseUrlEnv, n8nApiKeyEnv, n8nTimeoutMs, n8nResponseMode, n8nResponsePath
    // AI :   (see lib/server/n8n-roadmap.ts).
    // AI : TODO (media-view-B-api) — view: ViewBinding on modules. TODO (media-view-D-job) — remoteJob fields.
    chatbotMode: z.enum(["single", "until-exit"]).optional(),
    maxTurns: z.number().int().min(1).max(200).optional(),
    useOcr: z.boolean().optional(),
    cached: z.boolean().optional(),
    auto: z.boolean().optional(),
    avgMs: z.number().min(0).optional(),
    avgCostCents: z.number().min(0).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    try {
      if (JSON.stringify(val).length > MAX_MODULE_PAYLOAD_CHARS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "module payload too large" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "module must be JSON-serializable" });
    }
  });

const fieldExampleListSchema = z.array(z.string().max(4_000)).max(32).optional();

const structureFieldPatchSchema = z
  .object({
    id: z.string().max(128),
    name: z.string().max(200),
    type: z.string().max(64),
    optional: z.boolean(),
    description: z.string().max(4_000),
    example: z.string().max(4_000).optional(), // AI : legacy — prefer examples[]
    examples: fieldExampleListSchema,
    negativeExamples: fieldExampleListSchema,
    ref: z.string().max(128).optional(),
    minItems: z.number().int().min(0).max(10_000).optional(),
    maxItems: z.number().int().min(0).max(10_000).optional(),
    minLength: z.number().int().min(0).max(10_000).optional(),
    maxLength: z.number().int().min(0).max(10_000).optional(),
    typeExpr: typeExprPatchSchema.optional(),
    deterministic: z.boolean().optional(),
    testTolerance: z.number().finite().optional(),
    relation: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("pk") }),
        z.object({
          kind: z.literal("fk"),
          to: z.object({ modelId: z.string().max(128), field: z.string().min(1).max(200) }),
        }),
      ])
      .optional(),
  })
  .strict();

const structureModelPatchSchema = z
  .object({
    id: z.string().max(128),
    name: z.string().max(200),
    description: z.string().max(4_000).optional(),
    params: z.array(z.string().max(64)).max(16).optional(),
    fields: z.array(structureFieldPatchSchema).max(200).optional(),
    auto: z.boolean().optional(),
    dynamic: z.boolean().optional(),
    shared: z.boolean().optional(),
    locked: z.boolean().optional(),
    sourceDocId: z.string().max(128).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    try {
      if (JSON.stringify(val).length > MAX_STRUCTURE_PAYLOAD_CHARS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "structure model payload too large" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "structure model must be JSON-serializable" });
    }
  });

// AI : config fields are what PUT may change; benchmark metrics are accepted but ignored (see mergeStrategyConfigPatch).
const strategyPatchSchema = z
  .object({
    id: z.string().max(128),
    kind: z.nativeEnum(StrategyKind),
    name: z.string().max(200),
    enabled: z.boolean(),
    model: z.string().max(128),
    accuracy: z.number().min(0).max(100).optional(),
    passRate: z.number().min(0).max(100).optional(),
    latencyMs: z.number().min(0).optional(),
    costCents: z.number().min(0).optional(),
  })
  .strict();

export const jobLogEntrySchema = z.object({
  at: z.number(),
  level: z.nativeEnum(JobLogLevel),
  tag: z.string().max(256),
  line: z.string().max(8_000),
  moduleId: z.string().max(128).optional(),
});

const codeLineProfileSchema = z
  .record(z.string().max(16), z.number().min(0).max(600_000))
  .refine((m) => Object.keys(m).length <= 500, { message: "code line profile too large" });

export const stepCodeProfileSchema = z
  .object({
    code: z.string().max(MAX_MODULE_STRING_CHARS),
    language: z.nativeEnum(CustomCodeLanguage),
    lineMs: codeLineProfileSchema,
  })
  .strict();

export const feedbackBodySchema = z.object({
  message: z.string().trim().min(FEEDBACK_MIN_CHARS).max(MAX_FEEDBACK_MESSAGE_CHARS),
});

// AI : confirmEmail must match the signed-in address — typed confirm for irreversible wipe.
export const deleteAccountBodySchema = z
  .object({
    confirmEmail: z.string().trim().email().max(320),
  })
  .strict();

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
    models: z.array(structureModelPatchSchema).max(200).optional(),
    typeAliases: z.array(jsonSizeBounded(10_000)).max(100).optional(),
    modules: z.array(pipelineModulePatchSchema).max(200).optional(),
    strategies: z.array(strategyPatchSchema).max(50).optional(),
    seedDocNames: z.array(z.string().max(256)).max(200).optional(),
    expectedOutputs: z.record(z.string().max(256), jsonSizeBounded(100_000)).optional(),
    inferencePresets: z.array(jsonSizeBounded(50_000)).max(50).optional(),
    llmProviders: z.array(jsonSizeBounded(100_000)).max(20).optional(),
    documentation: z.string().max(MAX_ASSISTANT_MESSAGE_CHARS).optional(),
    langfuseExport: z.boolean().optional(),
    // AI : TODO (media-view-C-store) — visualizers[] on project patch (html + inType); not a document upload.
  })
  .strict();

export const docProjectsPatchSchema = z
  .object({
    projectIds: z.array(projectIdSchema).max(200),
  })
  .strict();

export const docContentBodySchema = z
  .object({
    name: z.string().trim().min(1).max(256),
    type: z.nativeEnum(InputType).optional(),
    content: z.string().min(1).max(MAX_DOC_CONTENT_CHARS),
    label: z.nativeEnum(DocLabel).optional(),
    projectId: projectIdSchema.optional(),
    replaceDocId: docIdSchema.optional(),
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

const deterministicDiffFieldSchema = z.object({
  path: z.string().max(500),
  expected: z.unknown(),
  actual: z.unknown(),
});

const deterministicDiffStepSchema = z.object({
  label: z.string().max(200),
  fields: z.array(deterministicDiffFieldSchema).max(50),
  tolerantPaths: z
    .array(
      z.object({
        path: z.string().max(500),
        tolerance: z.number().min(0),
      }),
    )
    .max(100)
    .optional(),
});

export const testingEvaluateBodySchema = z
  .object({
    steps: z.array(probabilisticEvalStepSchema).max(20).optional(),
    diffSteps: z.array(deterministicDiffStepSchema).max(20).optional(),
    model: z.string().max(128).optional(),
    projectId: projectIdSchema.optional(),
  })
  .refine((body) => (body.steps?.length ?? 0) + (body.diffSteps?.length ?? 0) > 0, {
    message: "Provide steps and/or diffSteps",
  });

export const pipelineSummaryBodySchema = z.object({
  projectId: projectIdSchema,
  model: z.string().max(128).optional(),
});

export const diagnosisAssistantBodySchema = z.object({
  projectId: projectIdSchema,
  runId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(MAX_ASSISTANT_MESSAGE_CHARS),
  model: z.string().max(128).optional(),
});

export const testingAssistantBodySchema = z.object({
  projectId: projectIdSchema,
  instruction: z.string().trim().min(1).max(MAX_ASSISTANT_MESSAGE_CHARS),
  model: z.string().max(128).optional(),
});

const inputDocsByModuleSchema = z.record(z.string().max(128), z.array(docIdSchema).max(50)).optional();

export const runBodySchema = z
  .object({
    projectId: projectIdSchema,
    inputDocId: docIdSchema,
    inputDocIds: z.array(docIdSchema).max(50).optional(),
    inputDocsByModule: inputDocsByModuleSchema,
    model: z.string().max(128).optional(),
    allowDuplicateRuns: z.boolean().optional(),
    source: z.enum(["app", "shared_link", "assistant", "testing"]).optional(),
  })
  .strict();

const runTestStepResultSchema = z.object({
  label: z.string().max(256),
  status: z.enum(["pass", "fail", "skipped", "not-reached"]),
  diffPath: z.string().max(500).optional(),
  skipReason: z.string().max(2_000).optional(),
  ignoredPaths: z.array(z.string().max(500)).max(100).optional(),
  tolerantPaths: z
    .array(
      z.object({
        path: z.string().max(500),
        tolerance: z.number().min(0),
      }),
    )
    .max(100)
    .optional(),
  probabilisticResults: z
    .array(
      z.object({
        path: z.string().max(500),
        pass: z.boolean(),
        reason: z.string().max(4_000),
        expected: z.unknown().optional(),
        actual: z.unknown().optional(),
      }),
    )
    .max(50)
    .optional(),
  llmEvaluated: z.boolean().optional(),
  deterministicDiff: z.string().max(32_000).optional(),
  deterministicDiffExplanations: z
    .array(
      z.object({
        path: z.string().max(500),
        reason: z.string().max(4_000),
        expected: z.unknown().optional(),
        actual: z.unknown().optional(),
      }),
    )
    .max(50)
    .optional(),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
});

export const patchRunBodySchema = z
  .object({
    notes: z.string().max(MAX_RUN_NOTES_CHARS).nullable().optional(),
    test: z
      .object({
        testDocName: z.string().max(256),
        results: z.array(runTestStepResultSchema).max(100),
        testContentSig: z.string().max(128).optional(),
        pipelineSig: z.string().max(128).optional(),
        contextSig: z.string().max(128).optional(),
      })
      .nullable()
      .optional(),
  })
  .strict();

export const clientStepBodySchema = z
  .object({
    output: jsonSizeBounded(MAX_CLIENT_STEP_OUTPUT_CHARS).optional(),
    error: z.string().max(4_000).optional(),
    clientLogs: z.array(jobLogEntrySchema).max(MAX_CLIENT_LOGS).optional(),
    codeProfile: stepCodeProfileSchema.optional(),
  })
  .strict()
  .refine((d) => d.output !== undefined || !!d.error, { message: "output or error required" });

export const chatbotTurnBodySchema = z
  .object({
    transcript: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string().max(32_000),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();

export const abtestBodySchema = z
  .object({
    projectId: projectIdSchema,
    inputDocId: docIdSchema.optional(),
  })
  .strict();

const embedOptionsSchema = z
  .object({
    delivery: z.enum(["iframe", "script", "both"]).optional(),
    heightPx: z.number().int().min(240).max(2400).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    hideBranding: z.boolean().optional(),
    postMessageEvents: z.boolean().optional(),
  })
  .strict();

export const createSharedLinkBodySchema = z
  .object({
    projectId: projectIdSchema,
    defaultModel: z.string().max(128).optional(),
    fundingMode: z.enum(["sharer_pays", "viewer_pays", "viewer_signs_in"]).optional(),
    viewerNameRequired: z.boolean().optional(),
    spendLimitCents: z.number().min(0).optional(),
    billingMultiple: z.number().min(1).max(100).optional(),
    flatFeeCents: z.number().min(0).max(100_000).optional(),
    defaultDocsByModule: inputDocsByModuleSchema,
    // AI : kind embed ⇒ emb_ id + required allowedOrigins (anti-theft allowlist).
    kind: z.enum(["link", "embed"]).optional(),
    allowedOrigins: z.array(z.string().trim().min(1).max(256)).max(32).optional(),
    embedOptions: embedOptionsSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind !== "embed") return;
    if (!data.allowedOrigins?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Embed requires at least one allowed origin",
        path: ["allowedOrigins"],
      });
    }
  });

export const createMarketplaceListingBodySchema = z
  .object({
    projectId: projectIdSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2_000).optional(),
    priceCents: z.number().int().min(0).max(10_000_000).optional(),
  })
  .strict();

export const marketplaceSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  mine: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const updateDeploymentSpendLimitBodySchema = z
  .object({
    spendLimitCents: z.number().min(0).nullable(),
  })
  .strict();

export const updateDeploymentBodySchema = z
  .object({
    spendLimitCents: z.number().min(0).nullable().optional(),
    enabled: z.boolean().optional(),
    allowedOrigins: z.array(z.string().trim().min(1).max(256)).max(32).optional(),
    embedOptions: embedOptionsSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.spendLimitCents !== undefined ||
      data.enabled !== undefined ||
      data.allowedOrigins !== undefined ||
      data.embedOptions !== undefined,
    {
      message: "Provide spendLimitCents, enabled, allowedOrigins, and/or embedOptions",
    },
  );

export const sharedLinkRunBodySchema = z
  .object({
    inputDocsByModule: inputDocsByModuleSchema,
    viewerName: z.string().max(200).optional(),
    sessionId: z.string().max(128).optional(),
    // AI : HMAC from /embed/[id] — never trust client-asserted parentOrigin for allowlist auth.
    embedSessionToken: z.string().min(16).max(512).optional(),
  })
  .strict();

const hostedApiInlineFileSchema = z
  .object({
    filename: z.string().trim().min(1).max(256),
    content: z.string().max(MAX_DOC_CONTENT_CHARS),
    type: z.nativeEnum(InputType).optional(),
  })
  .strict();

export const createHostedApiBodySchema = z
  .object({
    projectId: projectIdSchema,
    defaultModel: z.string().max(128).optional(),
    fundingMode: z.enum(["owner_pays", "caller_pays"]).optional(),
    billingMultiple: z.number().min(1).max(100).optional(),
    flatFeeCents: z.number().min(0).max(100_000).optional(),
    spendLimitCents: z.number().min(0).optional(),
    defaultDocsByModule: inputDocsByModuleSchema,
  })
  .strict();

export const hostedApiInvokeBodySchema = z
  .object({
    inputsByModule: z
      .record(z.string().max(128), z.array(hostedApiInlineFileSchema).max(20))
      .optional(),
  })
  .strict();

export const sharedLinkClientStepBodySchema = z
  .object({
    jobId: z.string().trim().min(1).max(128),
    token: z.string().trim().min(1).max(256),
    output: jsonSizeBounded(MAX_CLIENT_STEP_OUTPUT_CHARS).optional(),
    error: z.string().max(4_000).optional(),
    clientLogs: z.array(jobLogEntrySchema).max(MAX_CLIENT_LOGS).optional(),
    codeProfile: stepCodeProfileSchema.optional(),
  })
  .strict()
  .refine((d) => d.output !== undefined || !!d.error, { message: "output or error required" });

const uiContextRefSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(UI_CONTEXT_KINDS),
  label: z.string().trim().min(1).max(MAX_UI_CONTEXT_LABEL_CHARS),
  moduleId: z.string().trim().min(1).max(120).optional(),
  fieldPath: z.string().trim().min(1).max(MAX_UI_CONTEXT_FIELD_PATH_CHARS).optional(),
  snippet: z.string().max(MAX_UI_CONTEXT_SNIPPET_CHARS).optional(),
});

const storedPastedAttachmentSchema = z.object({
  id: z.string().max(128),
  name: z.string().max(256),
  text: z.string().max(MAX_ASSISTANT_MESSAGE_CHARS),
});

const assistantChatMessageSchema = z.object({
  id: z.string().max(128),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_ASSISTANT_MESSAGE_CHARS),
  proposal: z.unknown().optional(),
  status: z.string().max(64).optional(),
  invalidCount: z.number().int().min(0).max(100).optional(),
  retryCount: z.number().int().min(0).max(100).optional(),
  validationErrors: z.string().max(4_000).nullable().optional(),
  debugTrace: z.array(z.unknown()).max(200).optional(),
  // AI : restore paste / Select UI chips after reload (content already has <pasted> for the LLM).
  pastes: z.array(storedPastedAttachmentSchema).max(MAX_UI_CONTEXT_ITEMS).optional(),
  uiContext: z.array(uiContextRefSchema).max(MAX_UI_CONTEXT_ITEMS).optional(),
});

export const assistantChatCreateBodySchema = z
  .object({
    projectId: projectIdSchema,
    messages: z.array(assistantChatMessageSchema).max(200).optional(),
  })
  .strict();

export const assistantChatSaveBodySchema = z
  .object({
    messages: z.array(assistantChatMessageSchema).max(200),
  })
  .strict();

export const billingConfirmBodySchema = z
  .object({
    sessionId: z.string().trim().regex(/^cs_[a-zA-Z0-9_]{8,200}$/, "invalid Stripe session id"),
  })
  .strict();

const topupAmountSchema = z.union([
  z.literal(TOPUP_OPTIONS_CENTS[0]),
  z.literal(TOPUP_OPTIONS_CENTS[1]),
  z.literal(TOPUP_OPTIONS_CENTS[2]),
]);

export const billingCheckoutBodySchema = z
  .object({
    mode: z.enum(["payment", "subscription"]),
    amountCents: topupAmountSchema.optional(),
  })
  .strict()
  .refine((d) => d.mode !== "payment" || d.amountCents != null, {
    message: "amountCents must be a valid top-up amount",
  });

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_ASSISTANT_MESSAGE_CHARS),
});

// AI : Paste chips serialize client-side into message as <pasted>…</pasted> (no schema field).
export const assistantRequestBodySchema = z
  .object({
    projectId: projectIdSchema,
    message: z.string().max(MAX_ASSISTANT_MESSAGE_CHARS),
    history: z.array(chatTurnSchema).max(ASSISTANT_HISTORY_LIMIT * 2).optional(),
    model: z.string().max(128).optional(),
    stream: z.boolean().optional(),
    uiContext: z.array(uiContextRefSchema).max(MAX_UI_CONTEXT_ITEMS).optional(),
    // AI : Vibe vs Build — prompt awareness only; never gates agent write power.
    humanSurface: z.enum(["vibe", "build"]).optional(),
    pendingProposal: z
      .object({
        modules: z.array(z.unknown()).optional(),
        models: z.array(z.unknown()).optional(),
        typeAliases: z.array(z.unknown()).optional(),
        docs: z.array(z.unknown()).optional(),
        documentation: z.string().optional(),
        projectName: z.string().optional(),
        proposedActions: z.array(z.unknown()).optional(),
        changed: z.object({
          modules: z.boolean(),
          models: z.boolean(),
          typeAliases: z.boolean(),
          docs: z.boolean(),
          documentation: z.boolean(),
          name: z.boolean().optional(),
          actions: z.boolean().optional(),
        }),
      })
      .optional(),
  })
  .strict()
  .refine(
    (d) => d.message.trim().length > 0 || (d.uiContext?.length ?? 0) > 0,
    { message: "message or uiContext required" },
  );

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid request body";
}

export type ParsedRequestJson<T> = T | { validationError: string };

export async function parseRequestJson<T>(
  req: Request,
  schema: z.ZodType<T>,
  emptyDefault?: T,
): Promise<ParsedRequestJson<T>> {
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_API_BODY_CHARS) {
      return { validationError: `request body too large (max ${MAX_API_BODY_CHARS} chars)` };
    }
    body = raw.trim() ? JSON.parse(raw) : (emptyDefault ?? undefined);
    if (body === undefined) return { validationError: "Invalid JSON body" };
  } catch {
    return { validationError: "Invalid JSON body" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { validationError: formatZodError(parsed.error) };
  return parsed.data;
}

export const landingSignupBodySchema = z.object({
  email: z.string().trim().email().max(320),
});

// AI : SECURITY — privacyAccepted required server-side; client banner alone is bypassable.
export const landingBuildPipelineBodySchema = z.object({
  email: z.string().trim().email().max(320),
  task: z.string().trim().min(1).max(2000),
  privacyAccepted: z.literal(true),
});

const activityCategorySchema = z.enum([
  "ui_click",
  "ui_input",
  "ui_navigate",
  "error",
  "llm_call",
  "step_create",
  "step_delete",
  "step_modify",
  "log_view",
  "run_start",
  "run_complete",
]);

export const activityBatchBodySchema = z.object({
  events: z
    .array(
      z
        .object({
          category: activityCategorySchema,
          action: z.string().trim().min(1).max(500),
          detail: z.record(z.string(), z.unknown()).optional(),
          projectId: z.string().trim().max(128).optional(),
          // AI : SECURITY — costCents is server-derived only; strip any client-supplied value.
        })
        .strict(),
    )
    .min(1)
    .max(50),
});

const replayMetaArraysSchema = {
  pages: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
  clickedComponents: z.array(z.string().trim().min(1).max(200)).max(80).optional(),
};

export const sessionReplayChunkBodySchema = z.object({
  sessionId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative().max(10_000),
  events: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  projectId: z.string().trim().max(128).optional(),
  isFinal: z.boolean().optional(),
  ...replayMetaArraysSchema,
});

// AI : anonymous landing rrweb ingest — email must already be in landing_page_signups.
export const landingSessionReplayChunkBodySchema = z.object({
  sessionId: z.string().uuid(),
  email: z.string().trim().email().max(320),
  privacyAccepted: z.literal(true),
  chunkIndex: z.number().int().nonnegative().max(10_000),
  events: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  projectId: z.string().trim().max(128).optional(),
  isFinal: z.boolean().optional(),
  ...replayMetaArraysSchema,
});
