import { createAdminClient } from "./supabase_admin";

export type markup_multiple = number;

// AI : resolve platform markup from dated schedule — used to split charged vs provider LLM cost.
export async function markupMultipleAt(at: Date = new Date()): Promise<markup_multiple> {
  const admin = await createAdminClient();
  if (!admin) return 1;
  const { data, error } = await admin.rpc("markup_multiple_at", { p_at: at.toISOString() });
  if (error || data == null) return 1;
  const multiple = Number(data);
  return Number.isFinite(multiple) && multiple >= 1 ? multiple : 1;
}

export function llmCostFromChargedCents(chargedCents: number, markupMultiple: markup_multiple): number {
  const m = markupMultiple >= 1 ? markupMultiple : 1;
  return +(chargedCents / m).toFixed(4);
}

export function platformMarginFromChargedCents(chargedCents: number, markupMultiple: markup_multiple): number {
  return +(chargedCents - llmCostFromChargedCents(chargedCents, markupMultiple)).toFixed(4);
}
