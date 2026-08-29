# Product prompts log

A chronological record of product-direction prompts (user voice, not task-demo seeds). Newer entries go at the top.

---

## 2026-08-29 — Full AI product spec (this session)

ok combined_full_stack_specification.md Ln 1–80 is hand coded mostly, but i want a full AI version which is in complete detail. please build this

The dump stays as the regression checklist. The complete AI prose spec is `docs/product_spec.md` (every dump section plus types, share/websites, authoring, landing, dashboard, UI modes).

---

## 2026-08-29 — Base44 prompt to rebuild Spine

Paste-ready spec for giving Base44 (or similar) so it tries to build Spine itself: one type = Zod = SQL, auto OCR + quote-link steps, spreadsheet views, vibe proposes / run executes.

- Index: `docs/base44_rebuild_spine.md`
- Prompt: `docs/base44_rebuild_spine_prompt.md`
- Follow-ups: `docs/base44_rebuild_spine_followups.md`

---

## 2026-08-29 — Remove topology cheat sheet; generalize SQL; Spine-only eval

Fix the vibe topology cheat sheet (task-string retry hints). Leave A/B scoring as-is (still testing). Spine-in-Spine stays. Hosted SQL must not be a Collatz toy — available in vibe and configurable in the UI. Typed DAG is fine. Competitor compare: Spine only (cloud cannot test Base44/others). Explain #9 / #18 / #19.

---

## 2026-08-29 — Store OpenRouter key in Cursor secrets, run live tests

I gave you the openrouter key already, please store it! In secrets on cursor not on git, it’s only got a bit of money I don’t care it’s exposed it’s for testing, run tests : [key redacted]

Store `OPENROUTER_API_KEY` as a Cursor environment secret, never in git. Run the live OpenRouter A/B.

---

## 2026-08-29 — Seed few-shot lookup is reward hacking (this session)

Ok then it’s not a test, remove this behaviour and test again, note this down that it’s reward hacking to do this

Seed was matching the Vibe task string to Example 1–5 and writing that canned `payload` (JSON, `pipeline.js`, or harness `write_file`). Reliability then scored 100% because the answer key was pasted, not generated. That is reward hacking. Seed must not look up few-shot answers. Catalog materialize tests still prove the examples themselves are valid. Live OpenRouter is the coding comparison.

---

## 2026-08-29 — JSON authoring vs JS library (this session)

I’m worried about the custom json being so new for the llm that performance in coding is terrible, so I would like an option for the llm to output into normal JavaScript and then it’s converted into the the json schema, the other option is that I go the library approach which is probably better where stuff like caching , step by step output, DAG visualisation is exported from a library rather than a json structure, the issue with this is that it’s not cross language and would need to be implemented repeatedly across languages. While being able to have have a single function that is intensive be a language like rust and everything else JavaScript is nice, the json coding performance degradation is a real issue. Please create a doc file which record all my prompts and another doc file which is the product spec in markdown pure AI description , including this prompt. Try to create a library where each function takes a single zod structure and try to enforce all restrictions of the json. Compare using json or library if this improves performance with harness or direct retry output (currently json)

---

## Earlier product prompts already in the repo

These were already captured as specs, demo scripts, or example tasks. They are not restated in full here; the files below are the source of truth.

| Source | What it is |
| --- | --- |
| `docs/product_spec.md` | Complete AI product spec (prose). Source of truth for “what is the product.” |
| `combined_full_stack_specification.md` | Running feature dump: tabs, structures, pipeline kinds, inference, share, cache, documents, vibe coding. |
| `docs/demo_outline.md` | Original demo: typed I/O, cached steps, batch LLM, implicit zod/pydantic validation. |
| `docs/example_prompts.md` | Harder greenfield task prompts (KYC, quantum, tax, investment banking, PTR). |
| `docs/platform_plan.md` | Project = group of functions sharing structures; websites bind functions. |
| `docs/new_type_system_plan.md` | TypeExpr IR, drop `outIsList`, linter-first Python/Rust. |
| `docs/pipelines_and_websites_plan.md` | Pipelines vs hosted sites. |
| `docs/lovable_parity_plan.md` | Hosted-site / Lovable comparison. |
| `docs/media_and_custom_views_plan.md` | Media views vs TypeExpr. |
| `docs/sql_types.md` | SQL as the human/LLM-facing type language. |

### Demo-outline prompt (core product, condensed)

Build an AI engineering pipeline builder: validate LLM output in a defined structure; outline modules so work is checkable, smaller, reusable, and cached. Structures are pydantic/zod. Every step shows input and output models. Schema validation is implicit on every hop, not a separate step. Run buttons on cached/ready steps. `llm-batch` turns a list of LLM responses into a typed list. Frontend is presentation-only.

### Example task prompts (from `docs/example_prompts.md`)

```
please build an agent where i can pass in a legal doucment like know your customer requiremnts and then company documentation on their implmentation and it can break the legal document into different rules and then for any company you can pass this doucmentation and get an assessment with a batch call for each rule which should be atomic. evaluate the compliance and consequences. build example files
```

```
Please build me quantum
```

```
migration project
```

```
Continuous monitoring of opportunities for tax reduction
```

```
Investment banking
A coal mine is being aquired.
```

```
Create an example around PTR or payment time reporting in Australia
Map different excel files into the same PRT stanard format which is compliant with regulations
Clean white spaces, unneeded commas, spelling, missing values, date format standardisation
calculate compliance statistics after all anomolies have been resolved.
```
