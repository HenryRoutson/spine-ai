import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseEnvFileText } from "@/lib/parse-env-file"

export function applyParsedEnv(
  entries: Array<{ name: string; value: string }>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const { name, value } of entries) {
    if ((env[name] ?? "") !== "") continue
    env[name] = value
  }
}

// AI : fill SPINE_API_TOKEN / URL from gitignored env files when the editor did not pass them.
export function loadMcpEnvFiles(repoRoot: string, appRoot: string, env: NodeJS.ProcessEnv = process.env): void {
  for (const file of [resolve(appRoot, ".env.local"), resolve(repoRoot, ".env")]) {
    if (!existsSync(file)) continue
    applyParsedEnv(parseEnvFileText(readFileSync(file, "utf8")).entries, env)
  }
}
