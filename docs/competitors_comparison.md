# Competitor comparison: Spine vs landscape

**Spine** (`combined_full_stack`) is a schema-first LLM pipeline IDE: typed structures (Pydantic/Zod), linear document pipelines, golden-file testing, run logging, Stripe billing, share links / hosted APIs / marketplace, and multi-language export (TS, Python, Rust). See [`combined_full_stack_specification.md`](../combined_full_stack_specification.md) for the full feature list.

Legend: **Overlap** = shared capability · **Spine-only** = we have it, they don’t (or much weaker) · **They-only** = they have it, we don’t (or much weaker)

---

## Visual LLM workflow builders

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [Langflow](https://www.langflow.org/) | Open visual DAG of LLM nodes | Visual pipeline editor, LLM steps, parallel calls, document inputs | Langflow: branching DAG, large node palette, LangChain ecosystem. Spine: **linear typed spine**, schema-locked I/O, auto “parse to structure” for non-JSON docs, built-in testing + billing |
| [Flowise](https://flowiseai.com/) | Drag-and-drop LLM chains / agents | LLM chains, document ingestion, deployable flows | Flowise: agent tools, RAG, wider connector set. Spine: **structure editor + golden tests**, no vector KB, no open graph |
| [Dify.ai](https://dify.ai/) | LLM app platform (workflows, RAG, agents) | Workflows, structured outputs, sharing / API deploy | Dify: RAG knowledge bases, agent studio, larger app marketplace. Spine: **document-centric typed pipelines**, creator earnings on shared links/APIs, export to standalone code |
| [Gumloop](https://www.gumloop.com/) | No-code AI automation (browser + integrations) | Automate multi-step LLM tasks, non-dev friendly UI | Gumloop: SaaS integrations (Gmail, Sheets, etc.), general automation. Spine: **dev-grade schema validation**, custom TS/Python code steps, testing tab |
| [Stack AI](https://www.stackai.com/) | Enterprise AI workflow builder | Visual workflows, deploy APIs, document processing | Stack AI: enterprise connectors, compliance packaging. Spine: open export, marketplace clone, per-step cost logging |
| [Dust.tt](https://dust.tt/) | Team AI assistants on company data | LLM calls over documents, shared deployments | Dust: Slack/email assistants, team knowledge. Spine: **pipeline builder + monetization**, not a chat assistant product |
| [Wordware](https://www.wordware.ai/) | Natural-language-defined AI apps | Prompt-driven apps, iteration on LLM behavior | Wordware: English-as-code UX. Spine: **explicit schemas + pipeline graph**, code export, step-level typing |

---

## General workflow / orchestration

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [n8n](https://n8n.io/) | General automation DAG (400+ integrations) | Linear automation, API hosting, custom code nodes | n8n: branching DAG, huge integration library, self-host. Spine: **LLM-native typed I/O**, document parsing, LLM cost billing — not a general iPaaS |
| [Windmill](https://www.windmill.dev/windmill_ai) | Script + workflow orchestration | TS/Python/Rust code steps, scheduled runs | Windmill: infra orchestration, cron, internal tools. Spine: **LLM-first**, schema editor, inference UI, no general job scheduler |
| [Temporal](https://temporal.io/solutions/ai) | Durable workflow engine | Reliable multi-step execution, retries | Temporal: backend durability for any workflow. Spine: **visual LLM pipeline product**; no distributed workflow engine |
| [Inngest](https://www.inngest.com/ai) | Event-driven background jobs + AI | Step functions, AI step patterns | Inngest: developer SDK for server events. Spine: full UI product with documents, testing, sharing |
| [Trigger.dev](https://trigger.dev/) | Background jobs / long-running tasks | Async pipeline runs, progress streaming | Trigger.dev: code-first job runner. Spine: no-code/low-code pipeline canvas + schema layer |
| [Dagster](https://dagster.io/) | Data pipeline orchestration | Step graph, observability on runs | Dagster: ETL/data assets. Spine: **LLM document pipelines**, not data-warehouse oriented |

---

## LLM orchestration frameworks (code-first)

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| LangChain / LangGraph / LangSmith | Framework + agent graphs + tracing | Chains, parallel LLM, tracing/evals (LangSmith) | Frameworks: code-first, any topology. Spine: **GUI + Supabase-backed projects**, export generates code but editing is visual |
| [LlamaIndex Workflows](https://www.llamaindex.ai/workflows) | Event-driven LLM workflows in Python | Multi-step LLM pipelines, document ingestion | LlamaIndex: RAG/indexing first. Spine: schema validation UI, share/monetize without writing Python |
| Vercel AI SDK + Zod | Streaming LLM calls with typed schemas | Zod-structured LLM outputs, TS ecosystem | SDK: library for app devs. Spine: **full platform** (documents, testing, billing, marketplace) built around similar typing idea |

---

## Structured output / schema tooling

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [BoundaryML](https://boundaryml.com/) (BAML) | Typed LLM prompts → structured outputs | Schema-first LLM I/O, Pydantic-like models | BAML: prompt/template language in code. Spine: **visual structure editor**, pipeline canvas, document upload |
| [Instructor](https://useinstructor.com/) | Structured LLM outputs via Pydantic | Pydantic validation on LLM responses, retries | Instructor: Python library. Spine: UI for schemas + auto-retry on validation failure in pipeline |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | Agent framework with Pydantic types | Typed agent I/O, tool use patterns | Pydantic AI: code agents. Spine: **non-agent linear pipelines**, human-review step, no tool-calling agent loop |
| [Pydantic Logfire](https://github.com/pydantic/logfire) | Observability for Pydantic apps | Cost/latency visibility on LLM calls | Logfire: tracing/APM SDK. Spine: **built-in logging tab** per run; not a standalone observability product |

---

## LLM observability, evals, and prompt ops

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [Langfuse](https://langfuse.com/) | Open-source LLM tracing | Per-run traces, token/cost, prompt/response storage | Langfuse: SDK-integrated tracing for any app. Spine: tracing **inside the product** for your pipelines only; no external trace ingestion |
| LangSmith | LangChain-native eval + trace | Run history, eval datasets | LangSmith: framework-coupled. Spine: golden-file `*_testing.json` tests, deterministic vs probabilistic field checks |
| [Humanloop](https://humanloop.com/) | Prompt management + evals | Prompt versioning, eval loops, human review | Humanloop: prompt CMS for teams. Spine: prompts live **inside pipeline steps**; human-review step exists but no separate prompt registry |
| [Vellum AI](https://www.vellum.ai/) | LLM dev platform (prompts, evals, deploy) | Schemas, evals, deployment, structured outputs | Closest competitor. Vellum: stronger eval dashboards / prompt playground. Spine: **document ingestion, marketplace earnings, code export**, golden tests with git-diff UI |
| [Braintrust](https://www.braintrust.dev/) | Eval + logging for LLM products | Test suites, regression on LLM outputs | Braintrust: CI eval platform. Spine: evals **in-app** tied to pipeline steps; no separate CI SDK |
| [Promptfoo](https://www.promptfoo.dev/) | CLI eval / red-teaming | Compare expected vs actual LLM output | Promptfoo: config-file evals, red team. Spine: visual test editor, partial step coverage, LLM-judge for non-deterministic fields |
| [DeepEval](https://deepeval.com/) / [RAGAS](https://www.ragas.io/) | LLM/RAG quality metrics | Quality scoring of outputs | Metric libraries for RAG/agents. Spine: **schema + golden diff** testing; no RAG-specific metrics (no vector RAG) |
| [Arize Phoenix](https://arize.com/phoenix/) | ML/LLM observability | Trace analysis, eval experiments | Phoenix: open eval/trace for ML teams. Spine: simpler run log UI, no embedding drift / retrieval analysis |
| [W&B Weave](https://wandb.ai/site/weave/) | Experiment tracking for LLM apps | Log LLM calls, compare runs | Weave: experiment tracking. Spine: billing-integrated run logs with step cost breakdown |

---

## Document parsing and extraction

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [LlamaParse](https://developers.llamaindex.ai/llamaparse/) | PDF → structured text/markdown | PDF/Word parsing, OCR toggle | LlamaParse: parsing API only. Spine: **full pipeline** after parse — structures, LLM steps, testing |
| [Reducto](https://reducto.ai/) | Document → structured data API | PDF/table extraction into JSON | Reducto: extraction service. Spine: extraction is **input step + optional vision OCR**, then typed LLM processing |
| [AnyFormat](https://anyformat.ai/) | Document data extraction | Multi-format docs → structured fields | AnyFormat: pre-built extraction models. Spine: user-defined schemas, not fixed extraction templates |
| LlamaExtract (LlamaCloud) | Schema-guided extraction | LLM extraction into user schema | LlamaExtract: managed extraction. Spine: same idea but **inside editable pipeline** with export |
| [Extend.ai](https://www.extend.ai/) | Document AI / IDP | PDF → JSON, human-in-loop | Extend: enterprise IDP. Spine: lighter IDP; general-purpose pipeline builder |

---

## Coding agents and IDE tools

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| Claude Code / [Claude managed agents](https://www.anthropic.com/) | Autonomous coding agent | AI assists editing pipeline/structures | Agents: write arbitrary code/repos. Spine: **constrained domain** — pipelines with validation, not a general IDE |
| Cursor | AI-native IDE | AI sidebar edits pipeline/structures (Spine has pipeline + structure assistants) | Cursor: general code editor. Spine: **purpose-built LLM pipeline product**, not an editor replacement |
| [Relevance AI](https://relevanceai.com/) | Build and deploy AI agents | Agent workflows, deployable tools | Relevance: agent marketplace, tool use. Spine: **typed linear pipelines**, no agent tool loop |
| [Replit](https://replit.com/) | Cloud IDE + deploy | Run code, host apps | Replit: general dev environment. Spine: no-code/low-code pipeline UI with export to code |
| [Lovable](https://lovable.dev/) | AI front-end app builder | Landing page demo, UI generation | Lovable: React app generation. Spine: **backend LLM pipeline** focus; exports include inference UI stub |

---

## Front-end / internal-tool builders

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [Streamlit](https://streamlit.io/) | Python → quick data/ML UI | Inference UI for runs, JSON/excel viewers | Streamlit: Python scripts. Spine: visual pipeline + **share links** with billing |
| [Retool](https://retool.com/) | Internal tools on databases/APIs | Deploy internal UIs, API integrations | Retool: DB/API connectors. Spine: **LLM document pipelines**, not a generic internal-tool builder |

---

## Inference hosting and API marketplaces

| Competitor | Primary focus | Overlap with Spine | Key differences |
|---|---|---|---|
| [Baseten](https://www.baseten.co/) | Model deployment / inference infra | Host scalable API, model selection | Baseten: GPU/model hosting. Spine: **orchestration layer** on OpenRouter; hosts pipeline APIs not raw models |
| [RapidAPI](https://rapidapi.com/) | API marketplace | Monetized API endpoints, discovery | RapidAPI: any REST API. Spine: **pipeline-specific marketplace** — clone full pipeline snapshot, not generic API listing |
| [GPT Store](https://openai.com/index/introducing-the-gpt-store/) | ChatGPT custom GPT marketplace | Publish AI workflows for others | GPT Store: conversational GPTs. Spine: **document pipeline APIs/links** with schema I/O and creator markup |

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
