// AI : Prompt-to-app / cloud-IDE alternatives vs Spine. Grep TODO (lovable-alts
// Plan: docs/lovable_replit_alts.md
// Do not vendor their trees. Clone to /tmp/lovable-alts via scripts/clone_lovable_replit_alts.py

export type oss_builder_license = "MIT" | "Apache-2.0" | "AGPL-3.0" | "source-available"

export type oss_builder_kind = "prompt-to-app" | "cloud-ide" | "coding-agent"

export type oss_builder_gap =
  | "file-tree"
  | "click-to-edit-react"
  | "clone-url"
  | "file-delete"
  | "webcontainer"
  | "github-sync"
  | "cli-agent-wrap"

export type OssBuilderAlt = {
  id: string
  name: string
  github: string
  license: oss_builder_license
  kind: oss_builder_kind
  port: boolean
  why: string
  spineAlready: string
  missing: oss_builder_gap[]
}

function alt(
  id: string,
  name: string,
  github: string,
  license: oss_builder_license,
  kind: oss_builder_kind,
  port: boolean,
  why: string,
  spineAlready: string,
  missing: oss_builder_gap[],
): OssBuilderAlt {
  return { id, name, github, license, kind, port, why, spineAlready, missing }
}

export const LOVABLE_REPLIT_ALTS: OssBuilderAlt[] = [
  alt(
    "bolt-diy",
    "bolt.diy",
    "https://github.com/stackblitz-labs/bolt.diy",
    "MIT",
    "prompt-to-app",
    true,
    "Official Bolt.new OSS. Chat + workbench file tree + inspector + file actions. WebContainer is their runtime — Spine compiles React in-process instead.",
    "Vibe chat, Monaco, HTML click-to-edit, reactFilePatches, HostedSiteReactPreview",
    ["file-tree", "click-to-edit-react", "file-delete", "webcontainer"],
  ),
  alt(
    "open-lovable",
    "Open Lovable",
    "https://github.com/mendableai/open-lovable",
    "MIT",
    "prompt-to-app",
    true,
    "Firecrawl team's scrape-then-rebuild. We port the clone-URL loop without their Firecrawl/E2B/Vercel sandbox.",
    "Hosted HTML/React studio + sanitizer",
    ["clone-url"],
  ),
  alt(
    "gpt-engineer",
    "gpt-engineer",
    "https://github.com/gpt-engineer-org/gpt-engineer",
    "MIT",
    "prompt-to-app",
    false,
    "Lovable founding team's CLI ancestor. Specify software, watch files appear. Spine Vibe + export is the product form.",
    "pipeline-assistant + hosted-site-assistant + zip export",
    [],
  ),
  alt(
    "dyad",
    "Dyad",
    "https://github.com/dyad-sh/dyad",
    "Apache-2.0",
    "prompt-to-app",
    false,
    "Local Lovable: Electron + your API key + Supabase. Do not vendor. Spine is already the hosted Supabase app-builder.",
    "ShareSiteForm, BYO Supabase placeholders, OpenRouter keys",
    ["github-sync"],
  ),
  alt(
    "claudable",
    "Claudable",
    "https://github.com/opactorai/Claudable",
    "MIT",
    "prompt-to-app",
    false,
    "Next.js chrome around Claude Code / Codex / Gemini CLI. Spine MCP is that wrap; do not nest another CLI agent in the page studio.",
    "mcp_tool + Vibe dock",
    ["cli-agent-wrap"],
  ),
  alt(
    "openhands",
    "OpenHands",
    "https://github.com/OpenHands/OpenHands",
    "MIT",
    "coding-agent",
    false,
    "Replit Agent loop (issue → patch → PR). Too large to vendor. Spine MCP ask/apply/start_run is the in-product loop.",
    "ask_agent + apply_project_changes + start_run",
    [],
  ),
]

export const LOVABLE_REPLIT_ALT_IDS = LOVABLE_REPLIT_ALTS.map((a) => a.id)

export const LOVABLE_ALTS_PORTED_GAPS: oss_builder_gap[] = ["file-tree", "click-to-edit-react", "file-delete", "clone-url"]
