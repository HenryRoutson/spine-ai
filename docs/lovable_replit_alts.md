# Lovable / Replit OSS alternatives vs Spine

None of Replit, Base44, or Lovable open-sourced their product. The rows below are independent builders in the same category. **Do not vendor their trees into this repo** (same rule as Spine-in-Spine dogfood D3). Shallow-clone to `/tmp/lovable-alts` for comparison:

```bash
python3 scripts/clone_lovable_replit_alts.py
```

Code catalog: `combined_full_stack/lib/server/lovable-replit-alts.ts`.

## What we compared

| Alt | License | Kind | Port into Spine? |
|---|---|---|---|
| [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) | MIT | Prompt-to-app (official Bolt.new OSS) | Yes — workbench |
| [Open Lovable](https://github.com/mendableai/open-lovable) | MIT | Scrape a site → React app | Yes — clone URL, no Firecrawl |
| [gpt-engineer](https://github.com/gpt-engineer-org/gpt-engineer) | MIT | CLI ancestor of Lovable | No — Vibe + export already |
| [Dyad](https://github.com/dyad-sh/dyad) | Apache-2.0 | Local Lovable + your API key | No — don't vendor Electron |
| [Claudable](https://github.com/opactorai/Claudable) | MIT | Chat UI around Claude Code / Codex | No — Spine MCP is that wrap |
| [OpenHands](https://github.com/OpenHands/OpenHands) | MIT | Replit Agent loop | No — too large; MCP ask/apply |

AGPL / cloud-IDE platforms (Coder, Ona, Eclipse Che, Libra, Reflex, Appsmith, ToolJet) stay out of the hosted-page studio. They are a different product.

## Spine already had (F0–F2)

Chat + preview, HTML click-to-edit, extra pages, `{{run}}` / `{{auth}}` / `{{output}}` / `{{chatbot}}` / `{{docs}}` / `{{pay}}` / `{{table}}`, React runtime with in-process compile, `reactFilePatches`, zip export.

## Gaps this change fills (F3)

Ported from MIT sources, reimplemented against Spine types (attribution in the file headers):

1. **bolt.diy file tree** — `lib/hosted-site-file-tree.ts` (folder-before-file + collapse, from their `FileTree.tsx` `buildFileList` / `sortFileList`).
2. **bolt.diy inspector** — React preview click-to-select / inline text patch of a unique string in `reactFiles`. HTML already had F1.
3. **bolt.diy file actions** — `reactFileDeletes` on the hosted-site assistant; GUI delete in the tree. Host widgets cannot be deleted.
4. **Open Lovable clone URL** — fetch public HTML, extract title / copy / colors / logo, rebuild hosted HTML (and React files if that runtime is on). No Firecrawl, no E2B sandbox. SSRF closed for localhost / private IPs / credentials.

Left out on purpose (see `docs/lovable_parity_plan.md` out of scope): WebContainer + npm, GitHub two-way sync, wrapping another CLI agent in the page studio.

## Attribution

bolt.diy is MIT © 2024 StackBlitz, Inc. and bolt.diy contributors. Open Lovable is MIT © 2024 Firecrawl / mendableai. Spine copies the *ideas* (tree sort, inspector, scrape-then-rebuild) into `lib/hosted-site-*`, not their WebContainer / Firecrawl runtime.
