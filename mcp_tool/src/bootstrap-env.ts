import { resolve } from "node:path"
import { chdir } from "node:process"

// AI : MCP JSON-RPC is stdout. dotenv 17 and other imports log there — keep only JSON-RPC on stdout.
const stdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = ((chunk: unknown, encoding?: BufferEncoding, cb?: (err?: Error) => void) => {
  const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
  const jsonrpc = text.trimStart().startsWith("{") || text.startsWith("Content-Length")
  if (jsonrpc) return stdoutWrite(chunk as string, encoding, cb)
  return process.stderr.write(chunk as string, encoding, cb)
}) as typeof process.stdout.write
console.log = (...args: unknown[]) => {
  console.error(...args)
}

// AI : seed.ts resolves paths from combined_full_stack cwd — set before any @/ imports load.
// AI : TODO (mcp-cwd) — chdir is a footgun for relative session paths; prefer resolving SPINE_SESSION_PATH absolutely.
const APP_ROOT = resolve(
  process.env.SPINE_APP_ROOT ?? resolve(import.meta.dirname, "../../combined_full_stack"),
)
chdir(APP_ROOT)
process.env.SPINE_REPO_ROOT ??= resolve(APP_ROOT, "..")
