import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir, DOCUMENTS_DIR } from "./config.js";
import { fileWriteHelper } from "./file_write_helper.js";
import { runToMarkdown } from "./logging.js";
import { LIVE_HTML_PATH, runPipeline } from "./run_engine.js";
import { openStore } from "./store.js";
import type { ProjectId } from "./types.js";

// AI : end-to-end demo for the database-migration task — fully deterministic (custom-code only,
// AI : zero LLM cost) and checked against the task's canonical expected output.
async function main(): Promise<void> {
  const store = await openStore();
  const projectId = "p_db_migration" as ProjectId;
  const project = store.project(projectId)!;

  const legacyDoc = store.docs().find((d) => d.name === "database_legacy_users.json")!;
  const mappingDoc = store.docs().find((d) => d.name === "database_field_mapping.json")!;
  console.log(`Project: ${project.name} (${project.modules.length} modules)`);
  console.log(`Input docs: ${legacyDoc.name} + ${mappingDoc.name}`);
  console.log(`Live progress (open in a browser, auto-refreshes): ${LIVE_HTML_PATH}\n`);

  const run = await runPipeline(store, projectId, legacyDoc.id, {
    inputDocIds: [mappingDoc.id], // explicit doc for the second `input` module (Field Mapping)
    onStep: (p) => {
      if (p.status === "running") process.stdout.write(`  [${p.index + 1}/${p.total}] ${p.label} …`);
      else console.log(` ${p.status}`);
    },
  });

  console.log(`\nRun ${run.id}: ${run.status} · ${run.totalMs}ms · billed ${run.billedCents.toFixed(2)}c`);
  fileWriteHelper(join(dataDir(), "demo"), "db_migration_run_log", "md", runToMarkdown(run));

  // AI : the final step's output must equal documents/database_migration/database_expected_output.json.
  const migrated = JSON.parse(run.steps.at(-1)!.outputJson!) as unknown;
  const expected = JSON.parse(readFileSync(join(DOCUMENTS_DIR, "database_migration", "database_expected_output.json"), "utf8")) as unknown;
  const match = JSON.stringify(migrated) === JSON.stringify(expected);
  console.log(match ? "\nMATCH — migrated output equals database_expected_output.json" : "\nMISMATCH vs database_expected_output.json");
  if (!match) {
    console.log("got:", JSON.stringify(migrated, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
