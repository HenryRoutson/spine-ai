import { resolve } from "node:path"
import { chdir } from "node:process"

// AI : seed.ts resolves paths from combined_full_stack cwd — set before any @/ imports load.
const APP_ROOT = resolve(
  process.env.SPINE_APP_ROOT ?? resolve(import.meta.dirname, "../../combined_full_stack"),
)
chdir(APP_ROOT)
process.env.SPINE_REPO_ROOT ??= resolve(APP_ROOT, "..")
