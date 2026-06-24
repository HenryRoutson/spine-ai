# Demo Outline

The goal for the demo is an **'AI engineering pipeline builder'**.
After getting visibility on multiple real world use cases, this is the core of all projects.

It allows you to:

1. Validate the output of an LLM in a defined structure.
2. Outline the modules and pipeline to get from input to output in the way to get the most performance.

What I mean by that is that you need to have intermediate steps which are used to:

1. Check your work.
2. Separate out tasks to make things less difficult for the LLM.
3. Make sure your development is modular and reusable for later projects.
4. Cache and avoid recalculating and billing yourself for steps you've already completed.

The UI should have the following window for each project inside the project selector.

## 1. Structure builder

Using code or a UI to build pydantic / zod model (structures) that each step should output or input.

For the demo please have the UI structure builder when you click on it say **"in progress"**, additionally add a pydantic tab with the same thing.

## 2. Pipeline builder

Where does the model take inputs?

- For example maybe you input a legal PDF, convert it to text and atomic rules to assess.
- Then you take in a company outline after that step and see if the company is adhering to those rules or if they might be liable for damages.

What types of inputs are they? Excel, Word, PDF, JSON.

You should be able to see:

- The last run output and input from each step.
- The history with times for each input and output.
- In other words:
  - `document_input_latest.txt`
  - `document_input_11Jun2026_12pm45.txt`
- These should be saved in the documents tab under **'previous runs'**.

Include some metrics like average latency and average cost.

The most important part is that each step shows their input and output model, and the UI points out where a pipeline is invalid because an input flows into an output that isn't equal.

Schema validation isn't an explicit step in the pipeline, it's implicit in the validation of every input and output from every step. You should not include a separate schema validation step.

Please have the input/output schema visible without clicking on each individual step:

```
input : ...
output : ...
```

Please have a run button on each step which has a cached or has an input ready. This should go dark if the pipeline is invalid.

## 3. AB testing

Test what approach works best in the pipeline. You might want to compare what works best between:


LLL environment options :

1. A single LLM call.
2. An RLM call (Recursive Language Models).
3. A full Claude Code instance tackling your problem.
4. A Claude Code like system running on a cheap Chinese model for cost efficiency.

using models from a selection : 

1. Deepseek
2. Sonnet 4.7 (if nothing else works well )

Please run all the LLL environment options using a cheap model and if none work try with a single sonnet call.

Ensure logs are kept for this AB testing, in particular, sytax highlighted code from the RLM, claude code systems.
Which is the best choice will be evaluated by an LLM.

## 4. Inference

Running your pipeline with a simple drag and drop system, no need to deploy anything like a custom pipeline. It should be easy to send a link to others of just this page.

Please have a run button on each step which has a cached or has an input ready. The cache files should be saved in documents tab probably as JSON files, with a pydantic / zod structure attached which should be static and valid.

This tab should show the same errors if the input doesn't feed into the output.

## 5. Logging

There should be a page dedicated to logging of all the pipeline inference. This should have syntax highlighting where JSON or markdown is used in the UI, there should be a download button.

Additionally, there should be a **'high level'** page where logging output is in easy to visualise HTML rather than detailed technical logs, this HTML should include progress bars and be shown as progress in the 4. Inference tab.

## 6. Documents

This contains documents uploaded during inference or training with a label of which.
Avoid duplicates using hashing as an ID.
If the document is a pdf please add both a pdf view and a text view. You don't need to use OCR.

## 7. Billing

A graph of billing from different LLM models, services.

---

One feature that would be helpful to show in the demo is the **'validated text'** feature. If an LLM has extracted text, the user should be able to click on it and jump to the document.

<https://github.com/google/langextract>

For now the pipeline should be a straight line and not a tree.

Where appropriate there should be selectors for what LLM can be used, by default this should be a cheaper Chinese model. This will use OpenRouter in the background or something to easily switch.

## Example to build (set as default): Company Legal Evaluation

1. Take in a legal document with a prebuilt document to text step — annotate with its purpose.

> **# skipped**
> Use a prebuilt sliding window component which converts a long context task into much smaller tasks. pydantic / zod is `text -> list[text]`. Use `text` in place of `string` for non technical. (For this demo I might skip building this, ignore in UI demo.)

2. Convert to a list of rules. `text -> list[tuple[text, quote]]`, which is a list of rule descriptions and the quote where they came from in the original document. The user should be able to go into the saved output and click the quote to go to the document.

3. Combine current pipeline input with new data. This should be with the **'new input data'** component, which should take in an input module like web, document and then combine into a new format. You should name this input data **"company data"**. Define this as a model automatically (spec: keyed by step **label**, no separate combine step):

```json
{
  "Company data": "...",
  "Company legal requirements": "..."
}
```

> **# skipped**
> Ideally in a full pipeline this should be n calls where you look at the company data with each rule to not overwhelm the LLM. You should also probably use the sliding window to ensure the company data isn't like 10M tokens long also.

4. Output a document containing the legal considerations for the company.

---

## Other considerations

Some of the parts in this pipeline require custom code to loop over things to make efficient. Ideally this would be interesting to have as something automated in the AB testing, but would need to consider how to auto merge things. Maybe just have a custom step option if you need to code a single step.

### Custom TypeScript function steps

Instead of a prebuilt step you can write a custom TypeScript function as a pipeline step:

- The step stores its **code** (a string on the module) and compiles it to one **function which maps input to output** — `(input, state) => output` where `state` is every prior step's output keyed by **step label** (async allowed, or a bare body using `input` / `state` with a `return`). Until migration, `(input) => output` still works.
- The code is **saved**: with the pipeline definition, and per run alongside the step's input/output artifacts (`<module>_code_latest.ts` + timestamped) in 'previous runs'.
- Output passes the same implicit schema validation as every other step — useful for splitting tasks into smaller deterministic pieces (sort, filter, reshape) with no LLM cost.
- The default legal pipeline seeds an example: "Sort Rules by Severity" between rule extraction and combine.

### Batch LLM step

A very basic batch step (`llm-batch`) which gets a pydantic / zod output from a list of LLM responses:

- Input is a **list**; the step makes **one structured call per item** (bounded concurrency), each response validated against the step's output structure.
- Results merge back into a single typed list in input order — this is the "n calls so you don't overwhelm the LLM" pattern from the example pipeline.

Given I'm developing in JS, I'll use zod instead of pydantic to create the schemas.

For the prebuilt "document to text step", please default to a Python PDF reader (I will only provide PDF files while demoing), but have a placeholder option for DeepSeek OCR.

Please make every part of the pipeline which is a placeholder to be implemented in backend or fake data as **"TODO placeholder"**.

---

## What is going to be built in the backend?

The frontend is presentation-only — it imports a `lib/` (`store`, `types`, `run-engine`, `pydantic`, `doc-viewer`) that doesn't exist yet. The backend owns that `lib/` plus all real data, execution and persistence. Stack is JS + `zod`, default model is a cheap Chinese one via OpenRouter. Full detail lives in `backend/requirements/overall_requirements.md`; summary by tab:

**Shared** — OpenRouter gateway (done: `getStringResponse`, `getStructuredResponse`), typed `config`, model registry (`MODEL_OPTIONS` with cost + cheap flag), per-project store, `file_write_helper`, token-usage capture on every call.

1. **Structure** — CRUD of `StructureModel`/`ModelField`; one canonical `zodFromModel` that backs both the `models.py` code view and runtime `validate(value, model)` (implicit on every step's I/O, no separate validation step); auto-structure from sample JSON (**TODO placeholder** beyond the legal example).

2. **Pipeline** — CRUD of the ordered `PipelineModule[]`; canonical I/O-validity check (upstream output model must equal a step's input model) driving the invalid badges + dark run buttons; per-kind executors: `input`, `doc-to-text` (JS PDF reader default, **DeepSeek OCR placeholder**), `llm` (`getStructuredResponse`), `llm-batch` (one structured call per list item → typed list), `transform`, `combine` (auto `{Company data, Company legal requirements}`), `custom-code` (saved TypeScript `(input) => output` function), `output`; per-module `avgMs`/`avgCostCents` from history. Seeds the default Company Legal Evaluation pipeline (incl. a custom-fn severity sort).

3. **A/B Test** — runner per `StrategyKind`: `single-llm` (real), `rlm`, `claude-code`, `cheap-claude-code` (**TODO placeholders**); metrics (accuracy, schema pass-rate, latency, cost) + an LLM judge that picks the winner.

4. **Inference** — `runPipeline(projectId, inputDocId, model)` executes the linear pipeline step-by-step, honours the cache, streams progress, and returns a `PipelineRun` (per-step trace, totals, `savedCents`). Output rules carry `{quote, start, end}` offsets for the clickable doc jump. Share link is a **TODO placeholder**.

5. **Logging** — persist every `PipelineRun` with full trace/tokens/cost; filterable history; detailed logs **and** a high-level HTML view (progress bars, mirrored in Inference); download endpoint + `*_latest`/timestamped files.

6. **Documents** — content-addressed store (hash = id, dedupe on collision); `inference`/`training` labels; PDF served as both PDF and text view; **quotation/validated-text** (langextract-style: extract, validate, closest-match, store offset link); "previous runs" = cached step JSON (with attached static zod structure) + `document_input_latest/<timestamp>.txt`.

7. **Billing** — aggregate token usage into daily spend per model and per service (`doc-parse svc`); cost = tokens × `costPer1k`; cheap/open vs frontier split; cache savings. Seeded 7-day series is a **TODO placeholder** until wired to real runs.
