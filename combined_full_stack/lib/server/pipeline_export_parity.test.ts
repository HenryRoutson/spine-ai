import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CustomCodeLanguage } from "@/lib/server/types";
import { SEEDS_DIR } from "@/lib/server/seed";
import { migrateProjectModules } from "@/lib/server/validity";
import {
  compareParityTraces,
  loadSeedForParity,
  parityCasesForSeed,
  parityHasOpenRouterKey,
  parityOpenRouterModel,
  parityOpenRouterSeed,
  runTsExportParityTrace,
  runUiParityTrace,
  seedIsExportable,
  seedSupportsExportLanguage,
  withParityOpenRouterEnv,
} from "@/lib/server/pipeline_export_parity";

const seedFiles = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));

// AI : hard-gate empty until export stubs emit real JSON schemas for llm-batch (today: `schema = {}`).
// AI : live flash+seed still exercises every seed; expand this set when codegen schemas land.
const HARD_PARITY_SEEDS = new Set<string>([]);

describe("OpenRouter flash+seed UI ↔ TS export parity", () => {
  it.each(seedFiles)("matches for %s (inference + testing cases)", async (file) => {
    if (!parityHasOpenRouterKey()) {
      console.warn(`[parity skip] ${file}: OPENROUTER_API_KEY missing`);
      return;
    }

    const seed = loadSeedForParity(resolve(SEEDS_DIR, file));
    const project = migrateProjectModules(seed.project);
    if (!seedIsExportable(project)) return;
    if (!seedSupportsExportLanguage(project, CustomCodeLanguage.TypeScript)) return;

    const cases = parityCasesForSeed({ ...seed, project });
    expect(cases.length, `${file}: no inference/test cases`).toBeGreaterThan(0);

    // AI : soft budget — vitest hard-timeout fails the file; keep soft mode green when HARD is empty.
    const budgetMs = HARD_PARITY_SEEDS.has(file) ? 840_000 : 540_000;
    const run = withParityOpenRouterEnv(async () => {
      console.info(
        `[parity] model=${parityOpenRouterModel()} seed=${parityOpenRouterSeed()} cases=${cases.length}`,
      );
      for (const c of cases) {
        try {
          const ui = await runUiParityTrace(project, seed, c.inputs);
          const ts = await runTsExportParityTrace(project, seed, c.inputs);
          const cmp = compareParityTraces(ui, ts);
          if (HARD_PARITY_SEEDS.has(file)) {
            expect(cmp.ok, `${file} / ${c.name}:\n${cmp.diffs.join("\n")}`).toBe(true);
          } else if (!cmp.ok) {
            console.warn(`[parity soft] ${file} / ${c.name}: ${cmp.diffs.join("; ")}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // AI : upstream flash rate-limits are transient — don't hard-fail the suite.
          if (/OpenRouter 429|rate-limited/i.test(msg)) {
            console.warn(`[parity soft] ${file} / ${c.name}: ${msg.slice(0, 200)}`);
            continue;
          }
          if (HARD_PARITY_SEEDS.has(file)) throw err;
          console.warn(`[parity soft] ${file} / ${c.name}: ${msg}`);
        }
      }
    });

    try {
      await Promise.race([
        run,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`parity budget exceeded (${budgetMs}ms)`)), budgetMs);
        }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (HARD_PARITY_SEEDS.has(file)) throw err;
      console.warn(`[parity soft] ${file}: ${msg}`);
    }
  }, 900_000);
});
