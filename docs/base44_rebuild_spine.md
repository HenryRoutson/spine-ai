# Rebuild Spine in Base44

This folder is a **paste-ready product prompt** for Base44 (or any vibe-coding tool) to attempt building Spine itself.

| File | What to do with it |
|------|--------------------|
| [`base44_rebuild_spine_prompt.md`](base44_rebuild_spine_prompt.md) | **The prompt.** Copy the entire file (from the first `#` after the copy-banner) into Base44’s build box. |
| [`base44_rebuild_spine_followups.md`](base44_rebuild_spine_followups.md) | Optional second/third messages if Base44 truncates, stalls, or ships a chatbot instead of a typed pipeline. |

## How to use it

1. Create a new Base44 app.
2. Paste **the whole prompt file** as the first message. Do not paraphrase. The examples are load-bearing.
3. If the builder asks “what should I start with?”, answer: *seed the Company Legal Evaluation project and make the Structures + Pipeline + Run loop work before any other tab.*
4. After the first generate, send follow-up 1 (legal demo must actually run), then follow-up 2 (quotes click through), then follow-up 3 (spreadsheet views).
5. Do **not** let it add vector RAG, a generic agent chat as the product, or a separate “database schema” tab. Those are the usual failure modes.

## What this prompt is optimizing for

Not pixel-parity with the real Spine React app (~247 `.tsx` files). Distilled **ideas**:

- One type is Zod **and** SQL **and** the runtime validator
- A pipeline is a **visible, typed spine of steps**, not a hidden agent loop
- PDF OCR, JSON parse, and quote-linking are **locked auto-steps**, not homework for the user
- Complex nested JSON is always viewable as a **spreadsheet**
- Backend functions and frontend pages are **separate objects** that bind, they are not one blob of generated React

If Base44 builds those five things, it has built Spine’s core. Everything else in the real product (marketplace, billing markup, Langfuse, Rust export, pixel-exact chrome) is later.

## Source of truth in this repo

The prompt is a distillation of:

- `docs/platform_plan.md` — project = functions sharing structures
- `docs/new_type_system_plan.md` — TypeExpr, no `outIsList`
- `docs/sql_types.md` — SQL as annotation; prompt VIEWs vs spine rows
- `docs/demo_outline.md` — AI engineering pipeline builder
- `docs/json_vs_library_product_spec.md` — JSON IR vs authoring library
- `docs/media_and_custom_views_plan.md` — data vs view
- `docs/lovable_parity_plan.md` / `docs/pipelines_and_websites_plan.md` — pages bind functions
- `combined_full_stack_specification.md` — layout hierarchy, tabs, quote/OCR/excel details
- `combined_full_stack/lib/server/spine-in-spine-bootstrap-roadmap.ts` — host vs guest, slots
- Bundled examples: legal evaluation, example-select, billed-work catalog
