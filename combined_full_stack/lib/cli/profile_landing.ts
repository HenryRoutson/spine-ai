// AI : landing page LLM spend profile — reads Supabase call log + budget (local fallback).

import { backfillLocalLandingUsageToSupabase, fetchLandingUsageProfile, type LandingUsageProfile } from "@/lib/server/landing_page_demo";
import type { CliCommandResult } from "@/lib/cli/types";

export type ProfileLandingOpts = {
  days: number;
  limit: number;
  backfillLocal: boolean;
};

function cents(n: number): string {
  return `$${(n / 100).toFixed(4)}`;
}

export function formatLandingProfileHuman(profile: LandingUsageProfile, opts: ProfileLandingOpts): string {
  const lines: string[] = [
    `landing page LLM usage (last ${opts.days} days, source: ${profile.source})`,
    "",
    `budget:     ${cents(profile.budgetCents)}`,
    `spent:      ${cents(profile.spentCents)} (ledger)`,
    `remaining:  ${cents(profile.remainingCents)}`,
    `calls:      ${profile.callCount} in window · avg ${cents(profile.avgCostPerCallCents)}/call`,
  ];
  if (profile.avgLatencyMs != null) {
    lines.push(`latency:    avg ${Math.round(profile.avgLatencyMs)} ms`);
  }
  lines.push(
    `tokens:     ${profile.totalPromptTokens.toLocaleString()} prompt · ${profile.totalCompletionTokens.toLocaleString()} completion`,
    `call cost:  ${cents(profile.totalCostCents)} summed in window`,
    "",
  );

  const models = Object.entries(profile.byModel).sort((a, b) => b[1].costCents - a[1].costCents);
  if (models.length) {
    lines.push("by model:");
    for (const [model, stats] of models) {
      lines.push(
        `  ${model}: ${stats.calls} calls · ${cents(stats.costCents)} · ${stats.promptTokens}/${stats.completionTokens} tok`,
      );
    }
    lines.push("");
  }

  if (profile.byDay.length) {
    lines.push("by day:");
    for (const row of profile.byDay) {
      lines.push(`  ${row.day}: ${row.calls} calls · ${cents(row.costCents)}`);
    }
    lines.push("");
  }

  if (profile.recentCalls.length) {
    lines.push(`recent calls (up to ${opts.limit}):`);
    for (const call of profile.recentCalls) {
      const when = call.createdAt.replace("T", " ").slice(0, 19);
      const ask = call.promptText || call.promptPreview;
      lines.push(
        `  ${when} · [${call.tag}] · ${call.model} · ${cents(call.costCents)} · ${call.latencyMs ?? "?"}ms`,
      );
      lines.push(`    ask: ${ask.slice(0, 200)}${ask.length > 200 ? "…" : ""}`);
      if (call.projectName) lines.push(`    built: ${call.projectName}${call.buildId ? ` (${call.buildId})` : ""}`);
    }
  } else {
    lines.push("no calls in window");
  }

  return lines.join("\n");
}

export async function profileLandingCommand(opts: ProfileLandingOpts): Promise<CliCommandResult> {
  try {
    let backfill: { inserted: number; skipped: number; spentCents: number } | undefined;
    if (opts.backfillLocal) {
      backfill = await backfillLocalLandingUsageToSupabase();
    }
    const profile = await fetchLandingUsageProfile({ days: opts.days, limit: opts.limit });
    const summary = `${profile.callCount} calls · ${cents(profile.totalCostCents)} in window · ${cents(profile.remainingCents)} budget left`;
    return {
      ok: true,
      command: "profile landing",
      issues: [],
      data: { summary, profile, backfill, human: formatLandingProfileHuman(profile, opts) },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      command: "profile landing",
      issues: [{ level: "error", where: "supabase", message }],
    };
  }
}
