# Example Select demo

This bundled example shows **LLM relevance filtering** over a library of reference scopes — an alternative to embedding RAG when you need interpretable “why is this example useful?” reasoning.

## Problem

You have many past scope-of-works examples and a new damage description. Embedding search often returns irrelevant rows with no explanation. Downstream LLMs then force-fit bad examples.

## Approach (example-select step)

1. **Cache-friendly prompt** — shared prefix with `{description}` from the damage-case Document; only `{example}` changes per candidate.
2. **Structured per-item call** — cheap model returns `chain_of_thought` + `is_relevant` (not user-defined schema).
3. **Enriched output** — kept rows gain `selection_reason` so the final LLM sees *why* each example applies.
4. **Config only** — no shared code between projects; wire labels, prompt, and structures in the builder.

## Pipeline (this seed)

| Step | Kind | Role |
|------|------|------|
| Damage Case | input | New leak description (`damage_case.txt`) — context for example-select via `content` |
| Example Library | input | JSON array of `ScopeExample` rows on the spine |
| Select Relevant Examples | **example-select** | Filters library; context = **Damage Case**.content |
| Assemble Draft Request | assemble | `{ description, selected_examples }` from Document.content + selected list |
| Draft Scope | llm | Writes scope using selected examples + reasons |
| Scope Output | output | Final artifact |

Two inputs in a row is valid here: example-select and assemble read **Damage Case** from pipeline state by label, so the spine can switch to the library list without a combine. Combine is only required when processing sits *between* two inputs (`input → code → input`).

## Bundled files

- `damage_case.txt` — upstairs bathroom leak, collapsed kitchen ceiling, cupping floor
- `damage_case_roof_storm.txt` — storm roof tiles + bedroom ceiling stains (roof example should win)
- `damage_case_kitchen_reno.txt` — cabinetry-only job (reno example should win)
- `example_library.json` — seven past scopes (two clearly relevant per scenario, plus unrelated distractors such as door hinge / fence / flyscreen that should be filtered out)
- `example_select_demo_inference.json` — default Inference preset (bathroom leak)
- `roof_storm_inference.json` / `kitchen_reno_inference.json` — alternate Inference presets
- `example_select_demo_testing.json` — default Testing tab with golden deterministic steps
- `roof_storm_testing.json` / `kitchen_reno_testing.json` — scenario-specific test fixtures

## Tips

- Use a **cheap model** on example-select; accuracy matters less than the final draft step.
- Set **context field** to `content` when the context step is a Document (or `description` when an earlier step already emitted a struct).
- Add **selection_reason** (or your chosen field) to the output structure so materialization keeps the chain-of-thought.
- Optional **pre-filter max** caps candidates before LLM calls (embedding pre-filter can slot in upstream later).

## Reference

Inspired by cached-prefix relevance filtering vs embedding RAG — see the platform **Example Select** step in Add step.
