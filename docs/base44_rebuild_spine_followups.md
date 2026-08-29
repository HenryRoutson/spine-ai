# Follow-up prompts for Base44 after the Spine rebuild prompt

Send these **as later messages** in the same Base44 thread. Do not paste them instead of `base44_rebuild_spine_prompt.md`.

Use when the first generate is a chatbot, a generic “AI dashboard,” or a pipeline with no types.

---

## 1. Force the legal slice to actually run

The app is not done until Company Legal Evaluation runs end-to-end.

- Seed two documents: a short KYC-style regulation and a company implementation write-up (plain text is fine if PDF generation is hard).
- Pipeline must include locked auto-steps: PDF/text extract after each Input, Link Quotes after Extract Atomic Rules.
- Run tab: pick both files, Run, get a **table** of RuleAssessment rows (not a markdown essay).
- Zod-validate every step. If the LLM returns extra keys, strip or fail visibly on that step card.
- llm-batch: one HTTP call per rule, show N progress ticks, preserve order.

Do not replace this pipeline with a single chat completion that “assesses the documents.”

---

## 2. Quotes must click through

AtomicRule.source_quote and RuleAssessment.evidence_quote are not ordinary strings in the UI.

- After the LLM step, a locked Link Quotes step walks the structure (not the whole JSON) and writes `{ text, quote: { doc_id, start, end } }`.
- In the table view, those cells are links.
- Click → document overlay scrolled to `start`/`end` with a highlight.
- Exact match on whitespace-normalised text; otherwise sliding-window token overlap scored against the **quote** token count.
- Inexact matches show a warning chip. If quotes don’t click, the bug is on Link Quotes, not Extract Rules.

---

## 3. One type, three skins + spreadsheet everywhere

- Structures editor is a field spreadsheet (name, type with plain-language labels, optional, deterministic, description).
- Code preview tabs on the same structure: Zod, SQL CREATE TABLE, Pydantic. They must agree. There is no separate Database tab.
- Nested list[model] in SQL is a child table, not a JSON blob column, when the parent has an id PK.
- Every run output and every JSON document opens in the shared viewer: Table | Tree | JSON, plus Download xlsx/csv/json.
- Break the pipeline on purpose: set Assess each rule `inType` to AtomicRule (singular) while upstream is list[AtomicRule]. The edge goes red and Run disables. Provide “fix this step” / “fix upstream” buttons.

---

## 4. OCR is an auto-step, not a user puzzle

- Input only binds the file. If the slot accepts pdf/image/word/web, insert locked doc-to-text immediately after.
- Explainer on that card (verbatim): *Input only binds the file; this step fills Document.content (parser or Vision OCR) and is cached per document. If it is slow or fails, the problem is here — not on Input.*
- OCR toggle: off = text extract; on = vision model. Separate cache keys.
- Documents viewer: original + extracted text. Do not put file bytes into the LLM JSON.

---

## 5. Vibe proposes pipelines; it does not do the job

- Left: chat. Right: Run / Logs (spreadsheet chrome).
- User: “break this regulation into atomic rules and batch-assess a company PDF.”
- Agent emits structures + modules JSON. Show a diff. **Approve** applies. Chat must include current validation errors.
- After approve, the canvas matches the JSON. Then Run still has to execute the spine.
- Forbidden: answering with the assessment in the chat transcript and calling that the product.

---

## 6. Example-select (only after 1–3 work)

Add a second example project:

- Damage-case text + JSON library of past scopes (include distractors: fence, hinge, flyscreen).
- example-select step: cheap model per row returns `{ chain_of_thought, is_relevant }`; kept rows gain selection_reason.
- Logging shows excluded rows and reasons.
- `{example}` may be a projection (`id, title, body`) while the spine keeps the full object. Do not invent embeddings.

---

## 7. Consumer vs builder layout

- Users with zero projects: Run-only shell (paste a share link). No Structures tab.
- Builder: header project selector; Build stepper 01–04; entity rail muted ~200px; canvas largest; pipeline inspector labeled and collapsible.
- Do not clone the same sidebar style four times.
- Share link opens the consumer Run panel, not the editor.

---

## 8. If Base44 truncated the original prompt

Reply with only this:

Rebuild using these invariants: (1) Structure = Zod = SQL table, edited as a spreadsheet; (2) linear pipeline of typed steps, validation implicit on every hop, red edge on mismatch; (3) auto-insert doc-to-text and Link Quotes, locked, with explainers; (4) llm-batch = one structured call per list item; (5) outputs default to a table with clickable quote spans; (6) Vibe writes the pipeline, Run executes it. Seed Company Legal Evaluation. Skip marketplace, RAG, and fork.

Then resend follow-up 1.
