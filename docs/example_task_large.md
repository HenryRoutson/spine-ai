
# Prompt :
What's an AI automation task that might take a couple of days in python to automate given an OpenRouter API key and Cursor to an AI engineer? Real world business task. Pick a task which doesn't use API access and might require splitting up a task into smaller pieces because of it's size.

# Response (Claude) :
A strong fit is **bulk contract / document abstraction** — say, a procurement or legal ops team that has a few hundred supplier agreements sitting in a SharePoint folder as PDFs, and wants a spreadsheet of key terms pulled out of every one: renewal/auto-renewal dates, notice periods, liability caps, payment terms, governing law, termination triggers, price-escalation clauses, etc.

It hits all three of your constraints cleanly:

**Real business value.** This is genuinely done by hand today, often by paralegals or analysts at considerable cost, and it's the kind of thing where "we have 400 contracts and no idea which ones auto-renew next quarter" is a real, expensive problem. Lease abstraction in real estate and RFP/policy analysis are the same shape.

**No API to lean on.** The source of truth is a pile of PDFs (some scanned, so you may need OCR via something like `pytesseract` or a vision model through OpenRouter before you can even read them). There's no clean endpoint returning structured fields — extracting structure *is* the job.

**Size forces you to split, in two different dimensions.** This is the interesting part and where the couple of days actually goes:

1. *Across documents* — you batch and parallelize across the 400 files, with retry/resume logic so a crash at file 250 doesn't restart everything.
2. *Within a document* — a single 80-page master services agreement won't fit cleanly in one context window alongside a detailed extraction prompt, and even when it nominally fits, accuracy degrades on long inputs. So you chunk. Naive fixed-size chunking is the trap here: it splits clauses across boundaries and you lose the liability cap because half of it landed in chunk 3 and half in chunk 4. The better move is section-aware splitting (break on clause numbers / headings), then a map–reduce pattern: a *map* pass extracts candidate fields from each chunk, and a *reduce* pass consolidates them, dedupes, and resolves conflicts when the same field shows up in multiple places (definitions section vs. the actual operative clause).

OpenRouter specifically earns its place because you can route by stage: a cheap fast model to triage which chunks even mention a given field, and a stronger model only for the careful extraction on those chunks. That cost-routing, plus a validation pass (does the extracted renewal date actually appear in the cited text? flag low-confidence ones for human review), is exactly the kind of thing that turns a one-day hack into a two-day production-ish pipeline.

The deliverable at the end is mundane and exactly what the business wants: a clean Excel/CSV, one row per contract, plus a "needs human review" flag column.

A few other tasks with the same fingerprint if this one doesn't fit the context:

- **Support-ticket theme mining** — a manual CSV export of 10k tickets (no help-desk API), clustered and summarized into recurring issue themes; splitting is needed because 10k tickets blow past any single context.
- **Resume screening** against a job description — folder of PDF resumes, no ATS access, ranked and structured.
- **Invoice/receipt data extraction** — OCR a pile of vendor PDFs into a structured ledger.

The contract one is the cleanest illustration of the chunking problem, though, since a single input document can itself exceed the window — not just the corpus.