# Competitor comparison: Spine vs landscape

**Spine** (`combined_full_stack`) is a schema-first LLM pipeline IDE: typed structures (Pydantic/Zod), linear document pipelines, golden-file testing, run logging, Stripe billing, share links / hosted APIs / marketplace, and multi-language export (TS, Python, Rust, Go, BAML). See [`combined_full_stack_specification.md`](../combined_full_stack_specification.md) for the full feature list.

Legend: **Overlap (1–10)** = how much the product overlaps Spine’s core (schema-first LLM document pipelines + testing + share/monetize); color is conditional (red = low → green = high). **Overlap notes** = shared capability · **Key differences** = how we diverge · **What to add** = concrete Spine follow-ups inspired by that competitor (keep schema-first / monetization strengths)

<!-- AI : overlap badge colors — 1–3 red, 4–5 amber, 6–7 lime, 8–10 green -->

---

## Visual LLM workflow builders

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [Langflow](https://www.langflow.org/) | Open visual DAG of LLM nodes | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#bbf7d0;color:#14532d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">7</span> | Visual pipeline editor, LLM steps, parallel calls, document inputs | Langflow: branching DAG, large node palette, LangChain ecosystem. Spine: **linear typed spine**, schema-locked I/O, auto “parse to structure” for non-JSON docs, built-in testing + billing | Optional branching / conditional edges while keeping schema-locked I/O; richer node palette (tools, memory) without abandoning the linear default |
| [Flowise](https://flowiseai.com/) | Drag-and-drop LLM chains / agents | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#d9f99d;color:#365314;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">6</span> | LLM chains, document ingestion, deployable flows | Flowise: agent tools, RAG, wider connector set. Spine: **structure editor + golden tests**, no vector KB, no open graph | Vector KB / RAG step type; agent tool-calling step with typed tool I/O |
| [Dify.ai](https://dify.ai/) | LLM app platform (workflows, RAG, agents) | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#bbf7d0;color:#14532d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">7</span> | Workflows, structured outputs, sharing / API deploy | Dify: RAG knowledge bases, agent studio, larger app marketplace. Spine: **document-centric typed pipelines**, creator earnings on shared links/APIs, export to standalone code | Knowledge-base ingest + retrieval steps; grow marketplace discovery (categories, search, featured) |
| [Gumloop](https://www.gumloop.com/) | No-code AI automation (browser + integrations) | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | Automate multi-step LLM tasks, non-dev friendly UI | Gumloop: SaaS integrations (Gmail, Sheets, etc.), general automation. Spine: **dev-grade schema validation**, custom TS/Python code steps, testing tab | First-party SaaS connectors (Sheets, Gmail, Slack) as typed input/output steps; scheduled / trigger runs |
| [Stack AI](https://www.stackai.com/) | Enterprise AI workflow builder | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#d9f99d;color:#365314;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">6</span> | Visual workflows, deploy APIs, document processing | Stack AI: enterprise connectors, compliance packaging. Spine: open export, marketplace clone, per-step cost logging | Enterprise SSO / audit logs / compliance packaging; more enterprise document connectors |
| [Dust.tt](https://dust.tt/) | Team AI assistants on company data | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | LLM calls over documents, shared deployments | Dust: Slack/email assistants, team knowledge. Spine: **pipeline builder + monetization**, not a chat assistant product | Team workspace + shared company docs; Slack/email trigger that runs a pipeline and posts results |
| [Wordware](https://www.wordware.ai/) | Natural-language-defined AI apps | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Prompt-driven apps, iteration on LLM behavior | Wordware: English-as-code UX. Spine: **explicit schemas + pipeline graph**, code export, step-level typing | Stronger NL → pipeline generation (AI sidebar that scaffolds full pipelines from English) |

---

## General workflow / orchestration

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [n8n](https://n8n.io/) | General automation DAG (400+ integrations) | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Linear automation, API hosting, custom code nodes | n8n: branching DAG, huge integration library, self-host. Spine: **LLM-native typed I/O**, document parsing, LLM cost billing — not a general iPaaS | Branching DAG option; webhook / HTTP trigger inputs; self-host story for exported pipelines |
| [Windmill](https://www.windmill.dev/windmill_ai) | Script + workflow orchestration | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | TS/Python/Rust code steps, scheduled runs | Windmill: infra orchestration, cron, internal tools. Spine: **LLM-first**, schema editor, inference UI, no general job scheduler | Cron / schedule runs; folder-watch renewals (spec’d); better long-running job UX |
| [Temporal](https://temporal.io/solutions/ai) | Durable workflow engine | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | Reliable multi-step execution, retries | Temporal: backend durability for any workflow. Spine: **visual LLM pipeline product**; no distributed workflow engine | Durable retries + resume-from-step for failed runs; clearer failure recovery UX |
| [Inngest](https://www.inngest.com/ai) | Event-driven background jobs + AI | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Step functions, AI step patterns | Inngest: developer SDK for server events. Spine: full UI product with documents, testing, sharing | Event / webhook triggers that kick off pipelines; fan-out step patterns |
| [Trigger.dev](https://trigger.dev/) | Background jobs / long-running tasks | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Async pipeline runs, progress streaming | Trigger.dev: code-first job runner. Spine: no-code/low-code pipeline canvas + schema layer | Stronger async run queue + progress streaming for long pipelines |
| [Dagster](https://dagster.io/) | Data pipeline orchestration | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | Step graph, observability on runs | Dagster: ETL/data assets. Spine: **LLM document pipelines**, not data-warehouse oriented | Asset-style lineage view (which docs/structs fed which outputs); batch over document folders |

---

## LLM orchestration frameworks (code-first)

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| LangChain / LangGraph / LangSmith | Framework + agent graphs + tracing | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#d9f99d;color:#365314;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">6</span> | Chains, parallel LLM, tracing/evals (LangSmith) | Frameworks: code-first, any topology. Spine: **GUI + Supabase-backed projects**, export generates code but editing is visual | Optional agent / tool-loop step; round-trip edit of exported code back into the canvas; LangSmith-style eval datasets |
| [LlamaIndex Workflows](https://www.llamaindex.ai/workflows) | Event-driven LLM workflows in Python | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Multi-step LLM pipelines, document ingestion | LlamaIndex: RAG/indexing first. Spine: schema validation UI, share/monetize without writing Python | Index + retrieve steps over uploaded docs; Web URL input (spec’d, not shipped) |
| Vercel AI SDK + Zod | Streaming LLM calls with typed schemas | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Zod-structured LLM outputs, TS ecosystem | SDK: library for app devs. Spine: **full platform** (documents, testing, billing, marketplace) built around similar typing idea | Stream token-by-token into inference UI; publish a thin SDK that wraps hosted pipeline APIs |

---

## Structured output / schema tooling

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [BoundaryML](https://boundaryml.com/) (BAML) | Typed LLM prompts → structured outputs | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#bbf7d0;color:#14532d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">7</span> | Schema-first LLM I/O, Pydantic-like models | BAML: prompt/template language in code. Spine: **visual structure editor**, pipeline canvas, document upload | Freeform-first “think then JSON” pass (spec’d, arxiv 2604.03616); prompt templates co-located with schemas |
| [Instructor](https://useinstructor.com/) | Structured LLM outputs via Pydantic | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#d9f99d;color:#365314;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">6</span> | Pydantic validation on LLM responses, retries | Instructor: Python library. Spine: UI for schemas + auto-retry on validation failure in pipeline | Smarter validation-retry strategies (field-level repair, max-retry UX); expose retry policy per LLM step |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | Agent framework with Pydantic types | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | Typed agent I/O, tool use patterns | Pydantic AI: code agents. Spine: **non-agent linear pipelines**, human-review step, no tool-calling agent loop | Optional typed tool-calling agent step that still lands in a schema |
| [Pydantic Logfire](https://github.com/pydantic/logfire) | Observability for Pydantic apps | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Cost/latency visibility on LLM calls | Logfire: tracing/APM SDK. Spine: **built-in logging tab** per run; not a standalone observability product | Export run traces to OpenTelemetry / Logfire; richer latency flamecharts |

---

## LLM observability, evals, and prompt ops

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [Langfuse](https://langfuse.com/) | Open-source LLM tracing | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | Per-run traces, token/cost, prompt/response storage | Langfuse: SDK-integrated tracing for any app. Spine: tracing **inside the product** for your pipelines only; no external trace ingestion | Optional Langfuse / OTEL export of pipeline runs; ingest external traces only if we open an SDK |
| LangSmith | LangChain-native eval + trace | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Run history, eval datasets | LangSmith: framework-coupled. Spine: golden-file `*_testing.json` tests, deterministic vs probabilistic field checks | Eval dataset browser across projects; compare prompt variants side-by-side |
| [Humanloop](https://humanloop.com/) | Prompt management + evals | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Prompt versioning, eval loops, human review | Humanloop: prompt CMS for teams. Spine: prompts live **inside pipeline steps**; human-review step exists but no separate prompt registry | Prompt registry / versioning across steps; A/B prompt experiments with cost + pass-rate |
| [Vellum AI](https://www.vellum.ai/) | LLM dev platform (prompts, evals, deploy) | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#86efac;color:#14532d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">8</span> | Schemas, evals, deployment, structured outputs | Closest competitor. Vellum: stronger eval dashboards / prompt playground. Spine: **document ingestion, marketplace earnings, code export**, golden tests with git-diff UI | Eval dashboards (pass-rate trends); dedicated prompt playground detached from full pipeline run |
| [Braintrust](https://www.braintrust.dev/) | Eval + logging for LLM products | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | Test suites, regression on LLM outputs | Braintrust: CI eval platform. Spine: evals **in-app** tied to pipeline steps; no separate CI SDK | CI SDK / GitHub Action that runs golden tests on PR; regression gates |
| [Promptfoo](https://www.promptfoo.dev/) | CLI eval / red-teaming | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | Compare expected vs actual LLM output | Promptfoo: config-file evals, red team. Spine: visual test editor, partial step coverage, LLM-judge for non-deterministic fields | Red-team / adversarial test packs; CLI to run `*_testing.json` offline |
| [DeepEval](https://deepeval.com/) / [RAGAS](https://www.ragas.io/) | LLM/RAG quality metrics | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | Quality scoring of outputs | Metric libraries for RAG/agents. Spine: **schema + golden diff** testing; no RAG-specific metrics (no vector RAG) | Pluggable quality metrics (faithfulness, etc.) once RAG exists; score columns in testing tab |
| [Arize Phoenix](https://arize.com/phoenix/) | ML/LLM observability | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Trace analysis, eval experiments | Phoenix: open eval/trace for ML teams. Spine: simpler run log UI, no embedding drift / retrieval analysis | Experiment compare UI across runs; retrieval/embedding diagnostics if we add RAG |
| [W&B Weave](https://wandb.ai/site/weave/) | Experiment tracking for LLM apps | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Log LLM calls, compare runs | Weave: experiment tracking. Spine: billing-integrated run logs with step cost breakdown | Named experiments + parameter sweeps (model, temp) with cost/quality charts |

---

## Document parsing and extraction

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [LlamaParse](https://developers.llamaindex.ai/llamaparse/) | PDF → structured text/markdown | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | PDF/Word parsing, OCR toggle | LlamaParse: parsing API only. Spine: **full pipeline** after parse — structures, LLM steps, testing | Higher-fidelity PDF layout / table parse; optional “parse-only” hosted API for docs |
| [Reducto](https://reducto.ai/) | Document → structured data API | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | PDF/table extraction into JSON | Reducto: extraction service. Spine: extraction is **input step + optional vision OCR**, then typed LLM processing | Better table / form extraction into schemas; confidence scores per field |
| [AnyFormat](https://anyformat.ai/) | Document data extraction | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | Multi-format docs → structured fields | AnyFormat: pre-built extraction models. Spine: user-defined schemas, not fixed extraction templates | Template library of common extraction schemas (invoice, resume, etc.) on marketplace |
| LlamaExtract (LlamaCloud) | Schema-guided extraction | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#d9f99d;color:#365314;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">6</span> | LLM extraction into user schema | LlamaExtract: managed extraction. Spine: same idea but **inside editable pipeline** with export | One-click “extract into this schema” shortcut that scaffolds a minimal pipeline |
| [Extend.ai](https://www.extend.ai/) | Document AI / IDP | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fef08a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">5</span> | PDF → JSON, human-in-loop | Extend: enterprise IDP. Spine: lighter IDP; general-purpose pipeline builder | Stronger human-in-the-loop review queues; confidence thresholds that route to human-review |

---

## Coding agents and IDE tools

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| Claude Code / [Claude managed agents](https://www.anthropic.com/) | Autonomous coding agent | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | AI assists editing pipeline/structures | Agents: write arbitrary code/repos. Spine: **constrained domain** — pipelines with validation, not a general IDE | Deeper AI sidebar: multi-file edits, auto-fix validation errors, apply-with-diff approval |
| Cursor | AI-native IDE | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | AI sidebar edits pipeline/structures (Spine has pipeline + structure assistants) | Cursor: general code editor. Spine: **purpose-built LLM pipeline product**, not an editor replacement | Inline AI edits on structures/pipeline with accept/reject hunks; git-style project history / merge (spec’d) |
| [Relevance AI](https://relevanceai.com/) | Build and deploy AI agents | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fde68a;color:#713f12;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">4</span> | Agent workflows, deployable tools | Relevance: agent marketplace, tool use. Spine: **typed linear pipelines**, no agent tool loop | Agent marketplace listings that wrap Spine pipelines; typed tool-use step |
| [Replit](https://replit.com/) | Cloud IDE + deploy | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | Run code, host apps | Replit: general dev environment. Spine: no-code/low-code pipeline UI with export to code | One-click deploy of exported TS/Python to a hosted runtime; live code preview of export |
| [Lovable](https://lovable.dev/) | AI front-end app builder | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">1</span> | Landing page demo, UI generation | Lovable: React app generation. Spine: **backend LLM pipeline** focus; exports include inference UI stub | Richer generated inference UIs (forms from schemas, file drop zones) beyond the stub |

---

## Front-end / internal-tool builders

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [Streamlit](https://streamlit.io/) | Python → quick data/ML UI | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Inference UI for runs, JSON/excel viewers | Streamlit: Python scripts. Spine: visual pipeline + **share links** with billing | Customizable share-link UI (widgets from schema); charts for numeric pipeline outputs |
| [Retool](https://retool.com/) | Internal tools on databases/APIs | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | Deploy internal UIs, API integrations | Retool: DB/API connectors. Spine: **LLM document pipelines**, not a generic internal-tool builder | DB / REST connectors as typed steps; internal-tool layouts on top of hosted APIs |

---

## Inference hosting and API marketplaces

| Competitor | Primary focus | Overlap (1–10) | Overlap notes | Key differences | What to add |
|---|---|---|---|---|---|
| [Baseten](https://www.baseten.co/) | Model deployment / inference infra | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fecaca;color:#7f1d1d;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">2</span> | Host scalable API, model selection | Baseten: GPU/model hosting. Spine: **orchestration layer** on OpenRouter; hosts pipeline APIs not raw models | Bring-your-own model endpoint; autoscaling / SLA knobs for hosted pipeline APIs |
| [RapidAPI](https://rapidapi.com/) | API marketplace | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Monetized API endpoints, discovery | RapidAPI: any REST API. Spine: **pipeline-specific marketplace** — clone full pipeline snapshot, not generic API listing | Marketplace search, ratings, usage analytics for creators; API key plans beyond simple markup |
| [GPT Store](https://openai.com/index/introducing-the-gpt-store/) | ChatGPT custom GPT marketplace | <span style="display:inline-block;min-width:1.75rem;text-align:center;background:#fed7aa;color:#9a3412;border-radius:4px;padding:0.1rem 0.4rem;font-weight:700">3</span> | Publish AI workflows for others | GPT Store: conversational GPTs. Spine: **document pipeline APIs/links** with schema I/O and creator markup | Consumer-facing browse UX; featured / curated listings; chat wrapper over a pipeline when useful |

---

## Summary matrix (capability vs category)

| Capability | Spine | Workflow builders (n8n, Langflow, Dify) | Schema libs (Instructor, BAML) | Observability (Langfuse, Braintrust) | Doc parsers (LlamaParse, Reducto) | Coding agents (Cursor, Claude Code) |
|---|---|---|---|---|---|---|
| Visual pipeline editor | ✅ linear | ✅ DAG / rich nodes | ❌ code-only | ❌ | ❌ | ❌ |
| Typed schema editor (Pydantic/Zod) | ✅ | partial | ✅ | ❌ | partial | ❌ |
| Document ingest (PDF, Word, Excel…) | ✅ | partial | ❌ | ❌ | ✅ core product | ❌ |
| Parallel LLM steps | ✅ | ✅ | via code | ❌ | ❌ | ❌ |
| Custom code steps (TS/Python) | ✅ | partial | via code | ❌ | ❌ | ✅ general |
| Golden-file / step testing | ✅ | weak | via code | ✅ eval platforms | ❌ | ❌ |
| Run logging + cost per step | ✅ built-in | partial | via Logfire etc. | ✅ core product | ❌ | ❌ |
| Share link / hosted API | ✅ + billing | partial | ❌ | ❌ | API only | ❌ |
| Marketplace / creator earnings | ✅ | ❌ / weak | ❌ | ❌ | ❌ | GPT Store only |
| Multi-language export | ✅ TS/Py/Rust | JSON export | codegen | ❌ | ❌ | full repos |
| RAG / vector KB | ❌ | ✅ (Dify, Flowise) | via LlamaIndex | ❌ | ❌ | partial |
| Branching DAG workflows | ❌ | ✅ | via LangGraph | ❌ | ❌ | ❌ |
| General SaaS integrations | ❌ | ✅ (n8n) | ❌ | ❌ | ❌ | ❌ |
| Standalone trace SDK | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Where Spine is differentiated

1. **End-to-end in one product** — schema → pipeline → documents → test → infer → log → bill → share → marketplace → export. Most competitors cover one or two layers.
2. **Schema-locked document pipelines** — non-JSON inputs auto-insert a locked “parse to structure” LLM step; type mismatches block runs before inference.
3. **Monetization built in** — sharer/viewer pays, spend limits, API markup, earnings tab, marketplace clone (spec + early implementation).
4. **Testing as a first-class tab** — partial step coverage, deterministic vs probabilistic fields, git-diff expected/actual, not bolted-on eval SDK.
5. **Own your runtime** — export full pipeline to TS/Python/Rust with connector servers, not just workflow JSON.

## Where competitors are ahead (gaps to watch)

| Gap | Who does it better |
|---|---|
| Branching / DAG workflows | n8n, Langflow, Flowise, LangGraph |
| RAG / vector knowledge bases | Dify, Flowise, LlamaIndex |
| Hundreds of SaaS integrations | n8n, Gumloop, Retool |
| Standalone observability / CI evals | Langfuse, Braintrust, Promptfoo, LangSmith |
| Dedicated document extraction APIs | LlamaParse, Reducto, Extend |
| General-purpose coding agents | Cursor, Claude Code, Relevance AI |
| Web URL as pipeline input | — (Spine spec lists Web; not yet implemented) |
| Freeform-first LLM “think then JSON” pass | Spec’d (arxiv 2604.03616); not yet implemented |
| Git-style project history / merge | Spec’d; not yet implemented |
