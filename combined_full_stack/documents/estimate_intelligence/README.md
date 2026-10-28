# Estimate Intelligence

Two-pass **example-select** over a builder's own past assessments. Line items are denormalized on each job so compose does not need a JOIN. Prompt views drop those lines (and later qty/rate) from uncached `{example}` tokens.

Named for the Lodgicl Estimate Intelligence shape: retrieve comparable jobs from *this* builder, then compose a preliminary estimate from those jobs' billed lines.

## Problem

Years of scoping decisions sit in a repairer's job history. A new structured assessment arrives. You cannot paste every analogue's billed lines into the retrieval prompt — that suffix is uncached per candidate — but you still need those lines after a job is kept.

## Approach

1. **Pass 1 — comparable jobs** — cached prefix is the whole `Assessment` JSON. `{example}` is the prompt view (`id, builder_id, title, peril, construction, storeys, rooms_affected, narrative`). `billed_lines` stay on the spine.
2. **Explode Analogue Lines** — flatten kept `billed_lines`, unique by `work_item_id`, attach `source_job_id`.
3. **Pass 2 — applicable lines** — same cached assessment. `{example}` omits `quantity` / `unit_rate` (relevance is "does this work apply", not the historical dollars). Kept rows still have rates.
4. **Compose Preliminary Estimate** — copy SKUs/rates from selected lines; flag coverage gaps; human still signs off.

Empty prompt view = stringify the full candidate (too many uncached tokens once `billed_lines` are denormalized).

## Pipeline

| Step | Kind | Role |
|------|------|------|
| Current Assessment | input | Structured claim — `{description}` for both example-selects |
| Past Job Library | input | JSON array of `PastJob` with denormalized `billed_lines` |
| Select Comparable Jobs | example-select | Pass 1 — prompt view without `billed_lines` |
| Explode Analogue Lines | custom-code | Unique SKUs from kept jobs |
| Select Applicable Lines | example-select | Pass 2 — prompt view without qty/rate |
| Assemble Estimate Request | assemble | assessment + jobs + lines |
| Compose Preliminary Estimate | llm | Draft dollars from analogues |
| Estimate Output | output | Preliminary estimate |

## Bundled files

- `bathroom_leak_assessment.json` — default two-storey ensuite/kitchen water claim (`bld-prime-north`)
- `roof_storm_assessment.json` — single-storey storm roof
- `past_job_library.json` — 12 jobs (this builder + two other-builder distractors)
- Regenerate data: `npx tsx scripts/generate_estimate_intelligence_data.ts`

## Cost notes

Pass 1 is one cheap call per past job (12 by default). Pass 2 is one call per unique analogue SKU, not a full catalog scan. Prompt caching keeps the assessment prefix cheap on repeats.
