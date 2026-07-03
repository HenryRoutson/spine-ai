// AI : bill project-assistant LLM usage like inference runs — chart + balance deduction.

import { uid } from "@/lib/id";
import {
  assertCanStartRun,
  billRunUsage,
  getBillingUserKey,
  type BillingUserKey,
} from "./billing_account";
import { logger } from "./server_logger";
import type { Store } from "./store";
import { ModuleKind, RunSource, RunStatus, RunStepStatus } from "./types";
import type {
  ModelId,
  ModuleId,
  PipelineRun,
  ProjectId,
  RunId,
  RunStep,
} from "./types";

const billLog = logger("assistant-billing");

export const ASSISTANT_BILLING_CHART_KEY = "project assistant" as const;

export type AssistantBillingInput = {
  store: Store;
  projectId: ProjectId;
  model: ModelId;
  message: string;
  responseMessage: string;
  usageCents: number;
  startedAt: number;
};

export async function gateAssistantBilling(): Promise<BillingUserKey> {
  const billingKey = await getBillingUserKey();
  await assertCanStartRun(billingKey);
  return billingKey;
}

function buildAssistantRun(input: AssistantBillingInput): PipelineRun {
  const finishedAt = Date.now();
  const ms = Math.max(1, finishedAt - input.startedAt);
  const costCents = +Math.max(0, input.usageCents).toFixed(4);
  const step: RunStep = {
    moduleId: uid<ModuleId>(),
    kind: ModuleKind.Llm,
    label: ASSISTANT_BILLING_CHART_KEY,
    model: input.model,
    status: RunStepStatus.Ok,
    ms,
    costCents,
    inputPreview: input.message.slice(0, 600),
    outputPreview: input.responseMessage.slice(0, 600),
  };
  return {
    id: uid<RunId>(),
    startedAt: input.startedAt,
    status: RunStatus.Ok,
    totalMs: ms,
    billedCents: costCents,
    savedCents: 0,
    model: input.model,
    source: RunSource.Assistant,
    notes: ASSISTANT_BILLING_CHART_KEY,
    steps: [step],
  };
}

/** AI : deduct balance, persist a synthetic run row for Billing charts + Logging. */
export async function recordAssistantBilling(
  billingKey: BillingUserKey,
  input: AssistantBillingInput,
): Promise<number> {
  const usageCents = +Math.max(0, input.usageCents).toFixed(4);
  if (usageCents <= 0) return 0;

  try {
    await billRunUsage(billingKey, usageCents);
  } catch (err) {
    billLog.warn(`assistant billRunUsage failed`, {
      projectId: input.projectId,
      usageCents,
      error: (err as Error).message,
    });
    throw err;
  }

  input.store.addRun(input.projectId, buildAssistantRun(input));
  await input.store.flush();
  billLog.info(`assistant billed`, { projectId: input.projectId, usageCents });
  return usageCents;
}

export type AssistantUsageError = Error & { usageCents?: number };

export function attachAssistantUsage(err: unknown, usageCents: number): void {
  if (err instanceof Error) (err as AssistantUsageError).usageCents = usageCents;
}
