# Billed Work Catalog Select

Two-pass **example-select** over a master work-item catalog. Past jobs reference catalog IDs in `billed_items` instead of free-text scope lines.

Named distinctly from **Example Select Demo** so cloning the original demo twice (`Example Select Demo 1`, `Example Select Demo 2`, …) does not collide with this template in the project picker.

## Problem

You have ~100+ billable work items (scaling to 10k) and past jobs that billed a subset. A new claim description arrives. You cannot paste the whole catalog into one prompt.

## Approach

1. **Pass 1 — filter past jobs** — cached prefix with `{description}` from Work Description.content; each job is `{example}` (`title` + `work_description` via `examplePromptView`). Opaque `billed_items` (`WI-xxxxx`) stay on the spine for pass 2 / draft.
2. **Assemble Item Filter** — `{ description, selected_examples }` becomes the per-run cached block for pass 2.
   - TODO (type-join): denormalize billed lines here (lookup-embed `work_item_id` → `WorkItem`), not inside pass 1 candidates.
3. **Pass 2 — filter catalog** — same relevance schema; only each `WorkItem` row changes per call. Combine Catalog is required because pass 1 sits between the job library and catalog inputs; example-select unwraps `items` from the combine product.
4. **Draft Billed Work** — final LLM picks quantities from filtered items using `selection_reason` on kept rows.

Excluded candidates are auditable: each example-select step stores `exampleSelectVerdicts` on the run step (kept + excluded, each with `chain_of_thought`). Browse **excluded** in Logging → Step trace → Relevance verdicts.

## Pipeline

| Step | Kind | Role |
|------|------|------|
| Work Description | input | Claim narrative — context for pass 1 via `content` |
| Job Example Library | input | JSON array of structured past jobs |
| Select Relevant Jobs | example-select | Pass 1 |
| Assemble Item Filter | assemble | `{ description, selected_examples }` for pass 2 |
| Work Item Catalog | input | 100 catalog rows (JSON array) |
| Combine Catalog | combine | context + catalog list — required after pass-1 processing |
| Select Relevant Work Items | example-select | Pass 2 (unwraps combine `items`; 100 LLM calls) |
| Merge for Draft | merge | Request for final LLM |
| Draft Billed Work | llm | Structured `line_items` |
| Billed Work Output | output | Final artifact |

## Bundled files

- `billed_work_description.txt` — bathroom leak default case (unique filename — same text as example-select demo `damage_case.txt`)
- `job_example_library.json` — 12 past jobs with `billed_items` references
- `work_item_catalog.json` — 100 catalog rows (`WI-00001`–`WI-00100`)
- Regenerate data: `npx tsx scripts/generate_billed_work_catalog_select_data.ts`

## Cost notes

Pass 2 runs one cheap LLM call per catalog row (100 by default). Prompt caching makes the case + selected-jobs prefix cheap on repeats; tune `costLimitCents` on **Select Relevant Work Items** when scaling up.
