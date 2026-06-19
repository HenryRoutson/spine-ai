import { fileWriteHelper } from "./file_write_helper.js";
import { dataDir } from "./config.js";
import { join } from "node:path";
import { openStore } from "./store.js";
import { LIVE_HTML_PATH, runPipeline } from "./run_engine.js";
import { runToMarkdown } from "./logging.js";
import { billingSeries, spendSplit, totalSaved } from "./billing.js";
import { allModelsToPydantic } from "./pydantic.js";
import type { ProjectId } from "./types.js";

// AI : end-to-end demo harness — seeds the store, runs the legal pipeline live, writes artifacts.
async function main(): Promise<void> {
  const store = await openStore();
  const projectId = "p_legal" as ProjectId;
  const project = store.project(projectId)!;

  console.log(`Project: ${project.name} (${project.modules.length} modules)`);
  const legalDoc = store.docs().find((d) => d.name.includes("health_data"))!;
  const companyDoc = store.docs().find((d) => d.name.includes("mediflow"))!;
  console.log(`Input doc: ${legalDoc.name} (${legalDoc.id})`);
  console.log(`Live progress (open in a browser, auto-refreshes): ${LIVE_HTML_PATH}\n`);

  const run = await runPipeline(store, projectId, legalDoc.id, {
    inputDocIds: [companyDoc.id], // explicit doc for the second `input` module
    onStep: (p) => {
      if (p.status === "running") process.stdout.write(`  [${p.index + 1}/${p.total}] ${p.label} …`);
      else console.log(` ${p.status}`);
    },
  });

  console.log(`\nRun ${run.id}: ${run.status} · ${run.totalMs}ms · billed ${run.billedCents.toFixed(2)}c · saved ${run.savedCents.toFixed(2)}c`);
  for (const s of run.steps) console.log(`    · ${s.label}: ${s.ms}ms ${s.costCents.toFixed(2)}c ${s.status}`);

  // AI : run_high_level.html is archived under data/runs/<id>/ by runPipeline itself now.
  const dir = join(dataDir(), "demo");
  fileWriteHelper(dir, "run_log", "md", runToMarkdown(run));
  fileWriteHelper(dir, "models", "py", allModelsToPydantic(project.models));

  const runs = store.runs(projectId);
  console.log("\nBilling (per day):", JSON.stringify(billingSeries(runs)));
  console.log("Spend split:", spendSplit(runs), "saved:", totalSaved(runs));
  console.log(`\nArtifacts written to ${dir} and ${join(dataDir(), "runs", run.id)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
