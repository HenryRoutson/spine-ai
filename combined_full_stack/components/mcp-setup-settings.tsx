"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  DEFAULT_MCP_API_URL,
  mcpApiEnvExample,
  spineMcpSetupSnippets,
  type mcp_api_url,
} from "@/lib/mcp-client-config"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { tryCreateClient } from "@/utils/supabase/client"

function CopyBlock({
  id,
  label,
  value,
}: {
  id: string
  label: string
  value: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await copyTextToClipboard(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" spineId={id} onClick={() => void copy()}>
          <Copy className="mr-1 h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {value.trimEnd()}
      </pre>
    </div>
  )
}

export function McpSetupSettings() {
  const snippets = useMemo(() => spineMcpSetupSnippets(), [])
  const [apiOrigin, setApiOrigin] = useState<mcp_api_url>(DEFAULT_MCP_API_URL)
  const [token, setToken] = useState("")
  const [tokenHint, setTokenHint] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  useEffect(() => {
    setApiOrigin(window.location.origin)
  }, [])

  async function copySessionToken() {
    const supabase = await tryCreateClient()
    if (!supabase) {
      setTokenHint("Sign in first — local session files work without a token.")
      return
    }
    const { data } = await supabase.auth.getSession()
    const access = data.session?.access_token?.trim() ?? ""
    if (!access) {
      setTokenHint("Sign in first — local session files work without a token.")
      return
    }
    setToken(access)
    setTokenHint(null)
    await copyTextToClipboard(mcpApiEnvExample(apiOrigin, access))
    setTokenCopied(true)
    window.setTimeout(() => setTokenCopied(false), COPY_FEEDBACK_MS)
  }

  const envSnippet = mcpApiEnvExample(apiOrigin, token)

  return (
    <section id="settings-mcp" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Editors (MCP)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional. In-app Vibe stays the default. Connect Claude Code or Cursor when you want that
          editor&apos;s token budget on this project.
        </p>
      </div>
      <div className="px-4 py-3 text-xs text-muted-foreground">
        Install once: <code className="text-foreground">{snippets.installCommand}</code>
        . Guide: <code className="text-foreground">docs/mcp_setup.md</code>. Then enable the{" "}
        <code className="text-foreground">{snippets.serverName}</code> server in the editor and call{" "}
        <code className="text-foreground">auth_status</code>.
      </div>
      <CopyBlock id="settings.mcp-copy-claude" label="Claude Code" value={snippets.claudeCodeAddCommand} />
      <CopyBlock id="settings.mcp-copy-cursor" label="Cursor (.cursor/mcp.json)" value={snippets.cursorProjectJson} />
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Session token (SPINE_API_TOKEN)</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[10px]"
            spineId="settings.mcp-copy-token"
            onClick={() => void copySessionToken()}
          >
            <Copy className="mr-1 h-3 w-3" />
            {tokenCopied ? "Copied" : "Copy .env"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Needed to pull/push the signed-in GUI project and to run. Put it in gitignored{" "}
          <code className="text-foreground">.env</code> with the API URL.
        </p>
        {tokenHint ? <p className="mt-1 text-xs text-muted-foreground">{tokenHint}</p> : null}
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {envSnippet.trimEnd()}
        </pre>
      </div>
    </section>
  )
}
