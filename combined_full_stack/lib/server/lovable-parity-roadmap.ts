// AI : Frontend building on existing Vibe / Share / export — grep "TODO (lovable" / "DONE (lovable".
//
// Plan: docs/lovable_parity_plan.md
// Do NOT rebuild Vibe observe tabs, pipeline assistant, ShareSiteForm, or PipelineExportDialog.
// Do NOT generate a SPA, GitHub two-way, or a second export pipeline.
// New work is HostedSitePageStudio: show it on Vibe Share, click-to-edit, extra pages/slots into the same zip.

export {}

// Existing (do not replace):
//   vibe-panel.tsx — chat + Inference / Schedule / Share / Logging
//   HostedSitePageStudio — Vibe/Code + HtmlPreviewFrame viewport + PipelineExportDialog(siteOptions)
//   ShareSiteForm — mint site_, funding, brand, auth UI
//   hosted-site-export.ts — hosted/index.html, auth.html, styles.css, .env.example
//   pipeline export — TS/Py/Rs/Go/BAML + inference_ui.html + connector

// ---------------------------------------------------------------------------
// F0 — Put the existing studio on Vibe Share
// ---------------------------------------------------------------------------
// AI : DONE (lovable-F0-vibe-share) — SharePage simple/isVibe renders ShareSiteForm, not only ShareLinkForm
// AI : keep Inference / Schedule / Logging; do not auto-mint site_ on project create
// AI : Link / API / Embed stay on the full (non-simple) Share page

// ---------------------------------------------------------------------------
// F1 — Point at the page
// ---------------------------------------------------------------------------
// AI : DONE (lovable-F1-select) — HtmlPreviewFrame postMessage css-path; ignore .hs-run-slot / .hs-auth-slot
// AI : DONE (lovable-F1-inline) — inline text patches customHtml without LLM
// AI : DONE (lovable-F1-snippet) — selection goes to hosted-site-assistant (studio chat), not pipeline assistant
// AI : viewport desktop/mobile already shipped (share.site-preview-viewport)

// ---------------------------------------------------------------------------
// F2 — More page, same export
// ---------------------------------------------------------------------------
// AI : DONE (lovable-F2-pages) — optional HostedSiteOptions.pages[]; default stays one app HTML + auth HTML
// AI : DONE (lovable-F2-slots) — {{output}} {{chatbot}} {{docs}} mount DataViewPanel / ChatbotPanel / viewerMarkdown
// AI : DONE (lovable-F2-pay-table) — {{pay}} / {{table:Model}} live on hosted pages via platform widgets
// AI : DONE (lovable-F2-export) — generateHostedSiteExportFiles emits one HTML per page; dialog tabs stay hosted/*
// AI : optional later: drop inference_ui.html into .hs-run-slot in the zip (SETUP already says to do it by hand)
