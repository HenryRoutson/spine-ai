// AI : client-safe helpers for input-description guard errors and display.
import type { InputDescriptionCheckResult } from "./types";

export const INPUT_REJECTED_PREFIX = /^step "[^"]+" input rejected:\s*/i;

export function inputRejectedReasonFromMessage(message: string): string | undefined {
  const match = message.match(/^step "[^"]+" input rejected:\s*(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function inputRejectedReasonFromPreview(outputPreview?: string): string | undefined {
  if (!outputPreview?.trim()) return undefined;
  return inputRejectedReasonFromMessage(outputPreview.trim());
}

export function describeInputDescriptionFailure(check: InputDescriptionCheckResult): string {
  const reason = check.reason.trim();
  if (check.items?.some((i) => !i.matches)) {
    const failed = check.items.filter((i) => !i.matches);
    const first = failed[0];
    const label = first?.label ? `"${first.label}"` : "One item";
    return `${label} did not match what this step expects.${first?.reason.trim() ? ` ${first.reason.trim()}` : ""}`;
  }
  return reason || "The data entering this step did not match its required description.";
}

// AI : inference progress may only have outputPreview — rebuild check for StepInputDescription.
export function resolveInputDescriptionCheck(
  check?: InputDescriptionCheckResult,
  outputPreview?: string,
): InputDescriptionCheckResult | undefined {
  if (check?.matches === false) {
    const reason = check.reason.trim() || inputRejectedReasonFromPreview(outputPreview);
    return reason && !check.reason.trim() ? { ...check, reason } : check;
  }
  if (check) return check;
  const reason = inputRejectedReasonFromPreview(outputPreview);
  return reason ? { matches: false, reason } : undefined;
}
