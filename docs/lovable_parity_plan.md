# Match Lovable’s capability — frontend on top of what already ships

Spine already has the Lovable **backend** loop: vibe a typed pipeline, run it, schedule it, share it, export it. The gap is the **frontend**: a product page around that run, vibe-coded like Lovable’s preview.

Do not rebuild Vibe, Share, or export. Add page-building to the surfaces that exist.

Code markers: grep `TODO (lovable` — source of truth is [`combined_full_stack/lib/server/lovable-parity-roadmap.ts`](../combined_full_stack/lib/server/lovable-parity-roadmap.ts). Mark `DONE` when a stage ships.

Related: [`media_and_custom_views_plan.md`](media_and_custom_views_plan.md) (output viewers), [`parity.md`](parity.md), [`lovable_replit_alts.md`](lovable_replit_alts.md), `lib/server/connect-roadmap.ts`.

---

## Reuse — do not rebuild

### Vibe (`components/vibe-panel.tsx`)

Chat left (`ProjectAssistantDockPanel` → pipeline assistant). Right pane is observe-only:

| Tab | What it already is |
|---|---|
| **Inference** | Run the pipeline (`simple` mode — spreadsheet chrome, no DAG) |
| **Schedule** | Cron / inbound share (`/api/schedules`) |
| **Share** | Mint a public run link (`ShareLinkForm` simple) |
| **Logging** | Run history |

`VIBE_OBSERVE_WINDOW_IDS` in `lib/app-nav-config.ts`. Chat owns project edits; these tabs observe. **Keep that split.** Do not replace Inference with a fake IDE. Do not add a fifth observe tab that duplicates Share.

### Frontend studio (already exists, hidden)

Build → Share → Publish → **Site** → `HostedSitePageStudio` (`components/share/hosted-site-page-studio.tsx`):

- **Vibe / Code** tabs — hosted-site-assistant (HTML/CSS/brand only; cannot touch the pipeline) vs Monaco HTML
- Live preview — `HtmlPreviewFrame` + `HostedSiteChrome` + `SharedLinkPreview` in `{{run}}`
- Desktop / mobile toggle — already in `html-preview-frame.tsx` (`share.site-preview-viewport`)
- App / sign-in surface toggle when auth is on
- Brand colors, logo, tagline
- Sign-in UI (`hosted-site-sign-in.tsx`) — Spine vs custom Supabase placeholders
- **Export** button — `PipelineExportDialog` passed `siteOptions`

`ShareSiteForm` mints `site_` links, funding modes, spend limits, viewer markdown, default files. Public URL is `/site/{id}`.

**The product bug:** Vibe’s Share tab is *simple* and only shows `ShareLinkForm`. The Site studio is the full Share page (developer tools on). Lovable parity is “the page builder is on Vibe Share,” not a new window.

### Code export (already exists)

`PipelineExportDialog` + `POST /api/pipeline-export/documents` already zips:

- `{slug}_pipeline.{ts,py,rs,go,baml}` + shared `pipeline_runtime.*`
- `inference_ui.html` — standalone run form → connector
- `hosted/index.html`, `hosted/auth.html`, `hosted/styles.css`, `hosted/.env.example` — from `lib/hosted-site-export.ts` (same `siteOptions` the studio edits)
- `connector_server.{ts,py}`, proto, `run_example.*`, README / SETUP

Existing TODO on the dialog: *bundled Supabase SQL + Next.js inference shell alongside connector files* — that is an **export tab**, not a new GitHub product. Do not invent two-way sync or a second export pipeline.

SETUP already says: drop `inference_ui.html` into `.hs-run-slot`. If the zip should do that for you, that is a small generator change in `hosted-site-export.ts`.

### Backend Lovable-Cloud equivalents (already shipped)

| Lovable Cloud | Spine — keep using |
|---|---|
| Edge Functions / AI | Pipeline (LLM, batch, chatbot, custom-code) |
| Jobs | Schedule tab |
| Storage | Documents |
| Secrets | Library → Secrets |
| App+chat connectors | Connect + Nango (publisher OAuth) |
| Auth (builder) | Supabase sign-in |
| Payments (platform) | Billing + `SharedLinkFundingMode` + Earnings |
| Hosting | `/site/{id}`, `/run/{id}`, `/embed/{id}`, hosted APIs |
| Tests | Testing tab + `*_testing.json` |
| Agent / MCP | Vibe chat, CLI, `mcp_tool/` |

---

## The actual gap

Lovable’s preview **is** the website. Spine’s website builder exists but:

1. It is not on the Vibe Share tab.
2. You cannot click a headline and edit it (preview is display-only aside from viewport).
3. One HTML document, two slots (`{{run}}`, `{{auth}}`).
4. Export already includes that HTML; it does not need a new repo format.

Everything else in the old L3–L10 list (app-user tables, Stripe Connect in the page, custom domains, visitor OAuth, Next.js from scratch) is **not frontend building**. Leave it for other plans. Do not block page-building on it.

---

## New work — frontend only (F0–F2)

### F0 — Put the existing studio on Vibe Share

**Do not** change Inference / Schedule / Logging. **Do not** mint a site on blank project create.

On Vibe Share (`SharePage` `simple` / `isVibe`):

- Show `ShareSiteForm` (page studio + mint), not only `ShareLinkForm`. Link / API / Embed stay on the full Share page for developers.
- Keep one `site_` draft in form state until they hit the existing Create button — same as today.

**Done when:** hide developer tools, open Vibe → Share, vibe the hero, preview the run form, export zip — without leaving Vibe.

Files: `components/share/share-page.tsx` (simple branch), reuse `ShareSiteForm` / `HostedSitePageStudio` as-is.

### F1 — Point at the page (the missing Lovable gesture)

`HtmlPreviewFrame` already has desktop/mobile. Add:

1. Click-to-select outside slots (`postMessage` css-path / `data-hs-id`). Ignore clicks inside `.hs-run-slot` / `.hs-auth-slot`.
2. Inline text edit → patch `customHtml` (no LLM).
3. Selected snippet into the **existing** hosted-site-assistant chat (studio Vibe tab), not the pipeline assistant.

Keep the sanitizer in `lib/hosted-site.ts`. No scripts, no handlers.

**Done when:** changing a headline does not require a prompt.

Files: `html-preview-frame.tsx`, `hosted-site-page-studio.tsx`, `hosted-site-assistant.ts` (user prompt only).

### F2 — More page, same export

Still HTML + slots. Still one zip.

1. Optional extra pages in `HostedSiteOptions` (`pages[]` with path + html). Default remains today’s single app HTML + auth HTML. Studio gets a page switcher next to App / Sign-in.
2. New slots that **mount widgets that already exist** — do not write new runtimes:

   | Token | Existing widget |
   |---|---|
   | `{{run}}` | inference form (shipped) |
   | `{{auth}}` | sign-in card (shipped) |
   | `{{output}}` | `DataViewPanel` (media-view) |
   | `{{chatbot}}` | `ChatbotPanel` |
   | `{{docs}}` | `viewerMarkdown` (ShareViewerDocsFields) |

3. `generateHostedSiteExportFiles` emits one HTML file per page. `PipelineExportDialog` already maps `hosted/*` tabs — add rows, do not replace TS/Py export.

Skip `{{pay}}` and `{{table:Model}}` here (those need product billing / a row store — not frontend).

**Done when:** a landing page + workspace page export as `hosted/index.html` + `hosted/app.html` (or `pages[]`) and still run against the same connector.

---

## F3 — bolt.diy / Open Lovable (MIT) onto the existing studio

Do not vendor those repos (dogfood D3). Port the missing gestures:

1. **File tree** (bolt.diy workbench) on the React Code tab — folders before files, add/delete. Host widgets (`RunPipeline`, `HostedSlot`, `App.tsx`, `main.tsx`) cannot be deleted.
2. **React click-to-edit** (bolt inspector) — F1 already did this for HTML. The React preview now selects an element, patches unique source text without an LLM, and pins the matching file for the assistant.
3. **Clone URL** (Open Lovable, without Firecrawl) — fetch a public page, extract title/copy/colors, rebuild `customHtml` (and `reactFiles` when runtime is React). SSRF: no localhost / RFC1918 / credentials.

`reactFileDeletes` is the bolt file-delete action on the existing structured assistant (no XML artifact parser).

**Done when:** switch to React → tree + Monaco + live preview; click a headline to edit; paste `https://…` and get a rebuilt hosted page.

Files: `lib/hosted-site-file-tree.ts`, `lib/hosted-site-react-select.ts`, `lib/hosted-site-clone.ts`, `components/share/hosted-site-file-tree.tsx`, `app/api/hosted-site/clone-url/route.ts`.

Out of scope: WebContainer/npm, GitHub two-way, wrapping Claude Code inside the studio (use MCP).

---

## Out of scope (already built, or a different plan)

| Tempting rebuild | Reality |
|---|---|
| “Default Vibe to hosted preview” | Inference tab is the run. Preview lives in Share’s site studio (F0). |
| “One chat routes page vs pipeline” | Two assistants already: project dock vs studio Vibe. Keep them. |
| “Wire schedules from chat” | Schedule tab + vibe can already add connect/schedule. |
| “Export a Next app + GitHub two-way” | Zip already has pipeline + hosted HTML + inference UI. Optional later: existing dialog TODO for a Next shell **tab**. |
| App users / `app_rows` / Stripe Connect / custom domains / visitor OAuth | Not frontend. Auth **UI** and funding **modes** already exist on `ShareSiteForm`. |

---

## Sequencing

```
F0 surface studio on Vibe Share
  └─ F1 click-to-edit on HtmlPreviewFrame
       └─ F2 extra pages + {{output}}/{{chatbot}}/{{docs}} → same export zip
            └─ F3 bolt.diy file tree + React click-to-edit + Open Lovable clone URL
```

First PR is F0 only: Vibe Share renders `ShareSiteForm`. No new slots, no visual edit, no export format change.

---

## Implementation notes

- Hosted-site-assistant must keep “HTML only, no pipeline.” Pipeline changes stay on the left Vibe chat.
- Parity: F0 is a Share simple-mode change (`data-spine-id` already on site vibe / export). New select/inline controls get catalog rows.
- Verify in the browser: Vibe → Share (hidden developer tools) and Build → Share → Site (must stay the same studio).
