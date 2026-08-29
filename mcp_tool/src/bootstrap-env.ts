import { isAbsolute, resolve } from "node:path"
import { chdir } from "node:process"
import { loadMcpEnvFiles } from "./mcp-env-files.js"

// AI : MCP JSON-RPC is stdout. dotenv 17 and other imports log there — keep only JSON-RPC on stdout.
export function isMcpStdoutChunk(text: string): boolean {
  const t = text.trimStart()
  if (/^content-length:/i.test(t)) return true
  return t.startsWith("{") && t.includes('"jsonrpc"')
}

const stdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = ((chunk: unknown, encoding?: BufferEncoding | ((err?: Error | null) => void), cb?: (err?: Error | null) => void) => {
  const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
  if (typeof encoding === "function") {
    if (isMcpStdoutChunk(text)) return stdoutWrite(chunk as string, encoding)
    return process.stderr.write(chunk as string, encoding)
  }
  if (isMcpStdoutChunk(text)) return stdoutWrite(chunk as string, encoding, cb)
  return process.stderr.write(chunk as string, encoding, cb)
}) as typeof process.stdout.write
console.log = (...args: unknown[]) => {
  console.error(...args)
}

const APP_ROOT = resolve(process.env.SPINE_APP_ROOT ?? resolve(import.meta.dirname, "../../combined_full_stack"))
const REPO_ROOT = resolve(process.env.SPINE_REPO_ROOT ?? resolve(APP_ROOT, ".."))
process.env.SPINE_APP_ROOT = APP_ROOT
process.env.SPINE_REPO_ROOT = REPO_ROOT
const sessionRaw = process.env.SPINE_SESSION_PATH
process.env.SPINE_SESSION_PATH = sessionRaw
  ? isAbsolute(sessionRaw)
    ? sessionRaw
    : resolve(process.cwd(), sessionRaw)
  : resolve(APP_ROOT, ".spine-session.json")

loadMcpEnvFiles(REPO_ROOT, APP_ROOT)

// AI : seed.ts resolves paths from combined_full_stack cwd — set after env is absolute.
chdir(APP_ROOT)
