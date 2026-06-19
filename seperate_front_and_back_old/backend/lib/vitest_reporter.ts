import { join, relative } from "node:path";
import { dataDir } from "./config.js";
import { FileLog } from "./file_log.js";

// AI : custom vitest reporter — streams results to data/logs/testing.log (plain text, tail -f friendly)
// AI : and a highlighted testing.html that auto-refreshes in the browser until the run ends.
// AI : duck-typed against the vitest v4 reporter API to avoid coupling to internal types.

interface TestCaseLike {
  name: string;
  fullName?: string;
  result: () => { state: string; errors?: { message: string }[] } | undefined;
  diagnostic: () => { duration?: number } | undefined;
}

interface TestModuleLike {
  moduleId: string;
}

export default class TestingLogReporter {
  private log!: FileLog;
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private t0 = 0;

  onTestRunStart(): void {
    this.log = new FileLog(join(dataDir(), "logs"), "testing");
    this.t0 = Date.now();
    this.log.line(`vitest run — ${new Date().toLocaleString()}`, "bold");
    this.log.line(`tail -f ${this.log.logPath}`, "dim");
    this.log.line("");
  }

  // AI : one section per test file so the log reads as the full pipeline, module by module.
  onTestModuleStart(mod: TestModuleLike): void {
    this.log.section(relative(process.cwd(), mod.moduleId));
  }

  onTestCaseResult(tc: TestCaseLike): void {
    const r = tc.result();
    const ms = Math.round(tc.diagnostic()?.duration ?? 0);
    const name = tc.fullName ?? tc.name;
    if (r?.state === "passed") {
      this.passed++;
      this.log.line(`✓ ${name} (${ms}ms)`, "green");
    } else if (r?.state === "failed") {
      this.failed++;
      this.log.line(`✗ ${name} (${ms}ms)`, "red");
      for (const e of r.errors ?? []) this.log.line(`    ${e.message.split("\n")[0]}`, "red");
    } else {
      this.skipped++;
      this.log.line(`- ${name} (skipped)`, "dim");
    }
  }

  onTestRunEnd(): void {
    const secs = Math.round((Date.now() - this.t0) / 1000);
    this.log.finish(`${this.passed} passed · ${this.failed} failed · ${this.skipped} skipped · ${secs}s`);
  }
}
