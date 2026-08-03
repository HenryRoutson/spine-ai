# Spine — Antler pitch summary

**One line:** Spine is a typed pipeline platform that turns document-heavy AI workflows into many small, validated, parallel LLM steps — so you run cheap models on short contexts, catch errors early, and sell the result as a product or API.

**Live:** [spine-ai.dev](https://www.spine-ai.dev/) · App: [antler-vc-hackathon.vercel.app](https://antler-vc-hackathon.vercel.app/)

---

## The problem (what critics will ask first)

Most “AI automation” today is either:

1. **One big LLM call** — throw a 50-page PDF at GPT-4 and hope the JSON is right. Cost scales with context length. Accuracy drops as context grows. When it fails, you cannot tell *which* sub-task broke.
2. **An opaque agent** — Gumloop / Relevance-style agents that “just work” until they do not. Hard to test, hard to price, hard to prove compliance.
3. **A dev framework** — Instructor, BoundaryML/BAML, Pydantic AI. Good for engineers; no billing, sharing, document store, or non-technical operator UI.

Enterprises (legal, finance, education, ops) need **high-throughput, auditable document pipelines** — not chatbots. They will not pay frontier-model prices for work a decomposed pipeline can do on DeepSeek at 1/10th the cost.

---

## The insight: decompose, don’t monolith

**Thesis:** Accuracy and cost are both functions of *task granularity* and *context size*, not model size alone.

| Approach | Context per call | Typical model | Failure mode |
|----------|------------------|---------------|--------------|
| Single LLM on full document | Entire PDF + rubric + instructions | Frontier ($$$) | Schema drift, missed sections, untraceable hallucinations |
| **Spine: N parallel steps** | One rule, one question, one row | Cheap (DeepSeek, Qwen) | Validated per step; failure localised to step 4 of 12 |

**Economics (from product thinking in TODO):** If you split a job into `SPLITS` parallel LLM calls, each call sees ~`1/SPLITS` of the context. At scale, effective compute savings approach **`SPLITS²`** — you pay less per token *and* you need fewer retries because each sub-task is simpler.

**Accuracy mechanism:** Each step has an explicit **input/output schema** (Pydantic / Zod). Validation is implicit on every boundary — not a optional “guardrails” bolt-on. Wrong shapes fail *before* the next step runs. Quotes are extracted with source offsets and validated against structure paths (no brute-force RAG over the whole doc).

**No RAG by default:** Quotes tied to schema fields are more traceable than embedding retrieval. Targeted retrieval can be added per step; the default is provenance you can click in the UI.

---

## What Spine is

**Spine** = full-stack **AI engineering pipeline builder** for document → structured output workflows.

Users define:

1. **Structures** — typed models (like Pydantic/Zod) for every hand-off between steps  
2. **Pipeline** — linear sequence of steps: document input → doc-to-text → LLM → **parallel LLM batch** → custom code → output  
3. **Tests** — expected outputs per step (deterministic, tolerance, or LLM-judged probabilistic fields)  
4. **Inference** — run on real documents with caching, billing, and step-level traces  
5. **Share / monetise** — hosted UI links and APIs with markup (Shopify-for-AI-automations)

Built as **Next.js + Supabase + OpenRouter**, with a **CLI** so agents and CI can run the same pipelines without the React UI.

### Core pipeline step types (implemented or specced)

- **Input** — PDF, Word, Excel, JSON, text, web, image (with optional OCR path)  
- **Single LLM** — structured JSON output validated against a Structure  
- **Parallel LLM batch (`llm-batch`)** — list in → N concurrent cheap calls → typed list out (the main cost/accuracy lever)  
- **Custom code** — TypeScript (client-side compile) / Python / Rust with fallback chains and error hashing  
- **Human review** — bool / chat / single text (spec’d; inference UX incomplete)  
- **Output** — JSON, Excel-style views, export  

Default model: **DeepSeek V4** via OpenRouter — cheap, fast, good enough when context is small.

---

## What is already built (honest snapshot)

The repo `combined_full_stack/` is a working product skeleton, not a slide deck.

| Area | Status |
|------|--------|
| Auth (Supabase), projects, clone/delete | ✅ |
| Structure builder + Zod validation | ✅ (type system still evolving — see gaps) |
| Pipeline builder (linear), validity checks, AI sidebar | ✅ |
| `llm` + `llm-batch` execution, caching, billing per step | ✅ |
| Testing tab — per-step expected outputs, git-diff, stale/pass indicators, parallel test runs | ✅ (actively being extended) |
| Inference + run jobs hub + step traces | ✅ |
| Logging — syntax highlighting, cost/latency per step, prompt profiling | ✅ |
| Documents — upload, hash dedupe, PDF/text views | ✅ (OCR is placeholder) |
| Share links, hosted APIs (early), earnings tab | 🟡 partial |
| Export to Python / TS / Rust / Go / BAML | 🟡 partial |
| 12+ seed projects (legal eval, homework grader, expense auditor, etc.) | ✅ |
| Landing demo + session replay (rrweb) | 🟡 reliability work ongoing |
| Custom LLM providers (enterprise / KPMG-style internal APIs) | 🟡 modular provider layer started |
| CLI + validation test suite | 🟡 growing |

**Flagship demo pipeline — Homework Grader:** Ingest marking guide + student work → derive **dynamic marking schema** per section/question → grade each section in **parallel** → assemble results. Shows why one LLM call cannot work for arbitrary worksheets.

**Other seeds:** Company legal evaluation (atomic rules + parallel compliance check), GPS site profiling, SQL migration mapping, expense auditor, bank reconciler, bug enricher, procurement match, etc.

---

## Business model

1. **Platform usage** — credits for LLM calls; cache hits reduce bill; markup % on OpenRouter passthrough  
2. **Share economics** — creator sets billing multiplier or flat fee; payer can be sender or receiver; spending limits on shared links  
3. **Marketplace** (planned) — buy/sell/copy pipelines — “Shopify for AI automations” instead of selling SKUs  
4. **Enterprise** — custom LLM provider plug-ins, confidential deployments on open stack (Supabase, not Firebase), export full pipeline to code for on-prem  

**Why this can undercut API pricing:** Competitors sell *tokens*. Spine sells *correct, decomposed execution* — fewer tokens, fewer retries, cacheable intermediate steps.

---

## Competitive landscape

### Closest overlap

| Competitor | Strength | Spine differentiation |
|------------|----------|----------------------|
| **Gumloop** | Strong agent UX; built legal rule extraction demo cheaply | Gumloop is agent-first → hard to verify step-by-step. Spine is pipeline-first → testable, typed, exportable |
| **Dify / Flowise / Langflow** | Node editors, integrations | Amateur enterprise feel; weak code export. Spine targets production pipelines + billing + share |
| **BoundaryML (BAML)** | Typed prompts, deterministic/probabilistic field logic | Library, not platform. Spine wraps existing languages (Python/TS) and adds docs, tests, monetisation |
| **Instructor / Pydantic AI** | Schema-validated LLM outputs | OpenAI-centric or dev-only; no document store, parallel batch, or marketplace |
| **Vellum / Relevance AI** | Agent workflows | Throughput caps; not built for N parallel structured calls on large doc sets |
| **n8n / Make / Windmill** | Integrations | General automation; no first-class typed LLM batch + quote validation |
| **Claude Code / Cursor agents** | Best-in-class coding agent | Wrong tool for repeatable doc pipelines at scale; expensive; non-deterministic |
| **Langfuse / Logfire** | Observability | Spine logs are pipeline-native, not a generic OTel wrapper |
| **Stack AI / Wordware** | Enterprise AI apps | Less focus on decomposed parallel LLM + developer-grade testing |

**Human notes from founder evals:** Gumloop is the best seen for agent-style legal extraction; BoundaryML interesting but pre-1.0 and “replace programming language” oriented; Relevance capped at ~10 agents in testing; Dify good nodes but no export.

**Feature checklist we track** (`competitor_features.md`): document ingestion, structured extraction, parallel LLM, caching, custom providers, quote-based grounding, deploy-without-showing-logic, deterministic vs probabilistic testing, prompt profiling, human-in-the-loop, code export, marketplace, MCP — Spine is aiming to be the only product that combines **all** of these for document pipelines, not chat.

---

## Why now / why this founder

- Document automation (legal, finance, education, ops) is moving from experiments to production — buyers ask for **audit trails, cost caps, and correctness**, not demos.  
- Cheap Chinese models (DeepSeek, Qwen) are good enough **when context is small** — but only if your architecture splits work.  
- Experience targeting enterprise deployments (e.g. KPMG-style internal LLMs) informs **provider modularity** and export-to-code — not locked to OpenRouter.

---

## Traction & assets

- Deployed app + marketing site  
- 12 seeded real-world pipeline templates  
- Homework grader with dynamic schemas + multi-grade test fixtures  
- Testing infrastructure with step-level isolation (pinpoints *where* a pipeline breaks)  
- Stripe billing wired; earnings/share flow in progress  

---

## Risks & gaps (pre-empt the criticism)

Be direct — these are known, tracked in `TODO.txt` and the spec:

| Gap | Impact | Mitigation path |
|-----|--------|-----------------|
| Type system still “vibes-based” in places (`outIsList`, loose conversions) | Silent validation bugs | Planned typed Python/TS compile from JSON; per-step errors |
| OCR placeholder (PDF.js fallback, not DeepSeek OCR) | Image/scanned doc quality | Wire DeepSeek OCR or Reducto |
| “Think first, then JSON” retry not fully implemented | Retry accuracy | Paper-backed two-phase response on validation failure |
| Human review steps skipped in inference UI | Blocks HITL workflows | Approve/reject + chat flows |
| Input compatibility (wrong homework + wrong rubric) | Late failures | Dynamic schema matching + explicit mismatch UI |
| Marketplace, full code export, OpenHands agent tier | GTM / power-user features | Phased; agent VM architecture already planned |
| Landing demo reliability | Top-of-funnel | More test coverage; agent suite for one-shot pipeline generation |
| Billing arbitrage guard / profit-per-user table | Unit economics | `-`$10 floor exists; full margin tracking TODO |

**Strategic choice:** Stay **linear pipeline** (not arbitrary DAG) for v1. Parallelism comes from `llm-batch`, not graph complexity — simpler to test, explain, and sell.

---

## The ask (Antler)

Build the **default platform for production document AI** — where the moat is not the model but the **decomposition + validation + economics layer**.

Near-term milestones:

1. **Prove unit economics** — benchmark Spine (split + cheap model) vs single-call frontier on homework grader + legal eval: cost, latency, accuracy  
2. **Ship share + markup** — first creators earning from hosted pipelines  
3. **Enterprise pilot** — one confidential deployment with custom LLM provider + export  
4. **Tighten type system** — zero silent coercion from text → schema  

---

## Appendix: product surface (from spec)

**Tabs:** Projects · Structures · Pipeline · Testing · Inference · Share · Earnings · Logging · Cache · Documents · Docs · Billing · Settings

**Example use cases:**

- Legal: PDF regulations → atomic rules with quotes → parallel compliance vs company docs → Excel liability report  
- Education: Dynamic rubric from marking guide → parallel per-section grading  
- Finance: Receipts + policy PDF → line-item audit; bank reconcile; tax workpapers  
- Ops: Feedback routing, SLA breach reports, bug enrichment  

**Graduated UX (planned):** Builder-developer → Builder (non-technical) → Consumer (run shared links only)

**Supported export languages:** TypeScript, Python, Rust, Go, BAML, Swift, Kotlin (varying completeness)

---

## Elevator pitch (30 seconds)

> **Spine turns document workflows into typed, testable pipelines of small parallel LLM calls.** Instead of one expensive frontier call on a whole PDF, you split the job — grade each question, check each legal rule, extract each row — run DeepSeek on short contexts, validate every hand-off with schemas, and cache what already worked. Builders get debugging, testing, and logs; operators get a link or API they can sell with markup. We’re building Shopify for AI automations — and we can undercut raw API pricing because decomposition is a **compute multiplier**, not a feature flag.

---

*Sources: `combined_full_stack_specification.md`, `combined_full_stack/`, `TODO.txt`, `docs/competitors.md`, `docs/competitor_human_notes.md`, `docs/competitor_features.md`, `docs/demo_outline.md`, `docs/tasks_examples.md`.*
