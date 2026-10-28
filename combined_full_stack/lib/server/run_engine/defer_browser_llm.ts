import type { LlmClientStepSpec } from "@/lib/llm-client-step";
import { catalogEntry, parseRoutedModel } from "../model_catalog";
import { isServerLlmProvider } from "../llm/registry";
import { LlmClientStepPendingError } from "../run_checkpoint";
import type { RunLogger } from "./engine_types";

type BrowserLlmRoute = {
  providerId: string;
  providerModel: string;
};

// AI : server steps pause when the routed model uses a browser-only custom provider.
export function deferBrowserLlmIfNeeded(
  stepModel: string,
  buildClientSpec: (route: BrowserLlmRoute) => LlmClientStepSpec,
  log: RunLogger,
  logMessage: string,
  logContext: Record<string, unknown>,
): void {
  const routed = parseRoutedModel(stepModel);
  if (isServerLlmProvider(routed.providerId)) return;
  const entry = catalogEntry(routed.modelId);
  const route = { providerId: routed.providerId, providerModel: entry.providerModel };
  log.info(logMessage, { ...logContext, ...route });
  throw new LlmClientStepPendingError(buildClientSpec(route));
}
