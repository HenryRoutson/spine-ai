import { join } from "node:path";
import { dataDir } from "./config.js";
import { openStore } from "./store.js";
import { runBenchmark } from "./strategies.js";
import type { ProjectId } from "./types.js";

// AI : A/B benchmark harness (demo_outline §3) — all LLL environments live on the cheap model.
async function main(): Promise<void> {
  const store = await openStore();
  const project = store.project("p_legal" as ProjectId)!;
  const doc = store.docs().find((d) => d.name.includes("health_data"))!;
  console.log(`Benchmarking ${project.strategies.filter((s) => s.enabled).length} environments on ${doc.name}…\n`);

  const { results, verdict, usedFallback } = await runBenchmark(project, store, doc.id);
  for (const r of results) {
    console.log(
      `  ${r.kind.padEnd(12)} ${r.model.padEnd(12)} accuracy ${String(r.accuracy).padStart(3)}% · pass ${String(r.passRate).padStart(3)}% · ${String(r.latencyMs).padStart(6)}ms · ${r.costCents.toFixed(2)}c · worked ${r.worked}`,
    );
  }
  console.log(`\nFallback used: ${usedFallback}`);
  console.log(`Winner (LLM judge): ${verdict.winnerKind}\n${verdict.rationale}`);
  console.log(`\nLogs: ${join(dataDir(), "ab_tests")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
