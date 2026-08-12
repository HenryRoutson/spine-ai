

# Who am I?

I'm Henry,
I'm an AI engineer at KPMG, where i work in a team of around 12 with 5 PhDs.

I've worked on production grade financial automation with AI,
and lead the development of our teams shared library of internal code infrastructure.

# What is the problem?

It's widely publicised that large companies are starting to cut AI spend after subpar results. 

Partially, we belive this is because they jumped the gun on funding technology that needed more time to mature, 
both on the model and the software side.

Additionally, small startups are struggling to implement 
- interpretable
- accurate 
- and cost effiecient 
AI engineering solutions without spending 200k a year on a single engineer.

As an example of this demand,
I was contacted on linkedin for contract work paying 160k in 6 months, 
with less than a single year experience.

the demand for high quality AI engineering work is extremely high, 
but comapnies are having to cut funding without results. 

# Who is the ICP for this problem? who feels this problem the most?

we see it as

tehcnical founders of 'AI-native' companies without specific AI-engineering experience.

Startup founders are at risk of losing their jobs within months without high quality AI engineering.

# What is the solution we're offering them.

Our single line pitch is :

Loveable for AI engineering. 

The elevator pitch is :

We offer vibe coding for AI engineering,
where you can build production level systems,
while being non tehcnical.
We handle the hosting, and automate the backend development with AI using deep experience.


# in a few words, how are we differentiated?


We're very opintionated about AI engineering, and this is built into our platform.

1. 
embedding RAG is uninterpretable -> impossible to debug and fix.
What's the fix?
Chain of thought - everywhere.
feed that chain of thought trace when there is a test case divergence > quick fixes, often automatic.

2. 
agents are very useful, 
but for production systems they're 
- more variable
- expensive in particular with small tasks 

By some measurements agents can be 37x as expensive as a direct chatbot response.

Inference while testing our product had often been less than a single cent, because we don't have the 30 thousand tokens overhead like claude code.
Agents are still available, but only where required.

3. 
Claude code is great, 
but it often creates tangled blobs of code rather than sepeate interpretable steps. 
Our platform creates modular blocks of code, often handled with pre build steps, and caches these to achieve greater cost efficiency.

# Development progress

For around 2 weeks full time development and 120k lines of code, i've got a fully chargeable product with some bug fixes,
and a prototype vibe coding agent.

our future development focus is on an agent which can guide someone non-technical to creating a highly reliable backend. 
We output data into excel natively, and we've automated error tracing and isolation with our structured approach, a key inhibitor to raw claude code vibe coding.

# Who are the competitors? and How much money could this make?

We've conducted extensive competitor analysis, and used a subset of their products.
We've identified around 90 companies which are direct competitors or adjacent to our product.
The leading product with the hightest annual reccuring revenue is relevance AI at 13M ARR.

From my experience in KPMG, i know that relevance AI isn't used in production, and wouldn't be taken seriously to do that.
It's exclusively used for non-technical client demos, and requires the development team to develop the demos. 

A closer product to spine ai is dify.ai .
it's got more developer features than relevance AI and around 450k lines of code. 
Launching around 3 years ago, it now has 3 million ARR at 180 million valuation.


# feature comparison 

A small subset of high level features to compare across products.

| Platform | Visual builder | Typed schema enforcement | Multi-language code eject | Step-level eval harness | Run observability | Creator monetization | Self-host / custom LLM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Spine (this repo)** | Yes | Yes | Yes | Yes | Yes | Yes | Part |
| Dify AI | Yes | Part | — | Part | Yes | — | Yes |
| Vellum AI | Yes | Yes | Part | Yes | Yes | — | — |
| StackAI | Yes | — | — | Part | Part | — | Part |
| Windmill | Yes | Part | Part | — | Yes | — | Yes |
| Relevance AI | Yes | — | — | — | Part | — | — |
| Gumloop | Yes | — | — | — | Part | Part | — |
| BoundaryML | — | Yes | Yes | Part | Part | — | Yes |
| Flowise | Yes | — | — | — | Part | — | Yes |
| Langflow | Yes | — | — | — | Part | — | Yes |
| Wordware | Yes | Part | — | — | Part | Part | — |




# TAM, SAM, SOM

TAM — $5B 
SAM — $450M
SOM — $4M

in 2026 


GROK

  GROK ESTIMATE

  TAM — $5B 
  SAM — $450M
  SOM — $4M

  in 2026 


  **Pitch line: TAM $5B · SAM $450M · SOM $4M ARR by month 36.**

  Full breakdown is in [Spine TAM / SAM / SOM](/Users/henry/.cursor/projects/Users-henry-Documents-documents-nosync-Git-nosync-antler-vc-hackathon/canvases/spine-tam-sam-som.canvas.tsx) — open it beside chat. I used a canvas because the ranges, methods, and sources are easier to inspect than a wall of numbers.

  **TAM — $5B in 2026** (range $4–8B), growing to about **$12B by 2031**.

  This is spend on tools that build, host, evaluate, and run production LLM backends. The cleanest single print is Mordor’s no-code AI platform market at **$4.88B in 2026**. LLMOps is larger ($7.1B) and “agentic development platforms” is **$14.6B** — that last one includes Azure/AWS/Google, so I would not put it on the slide. Also leave out Lovable’s $400–500M ARR and n8n’s $5.2B valuation; those are adjacent categories, not this product.

  **SAM — $450M** (range $300–700M).

  That is English-speaking AI-native startups, SMBs, and agencies that need a production LLM backend without a dedicated AI engineer — your ICP. Two methods land in the same place:

  - **Buyers × ACV:** ~15k reachable teams × ~$12k blended ACV (platform + inference markup) is ~$180M on a strict cut. Widen ACV toward $20–40k of a $150–200k AI-engineer hire and you get $300–600M.
  - **Captured ARR / penetration:** close peers in your landscape sum to ~$40M ARR (Relevance ~$13M, Gumloop now **>$10M** after the $50M Series B — the $1.1M figure in the HTML is stale). Add LangSmith and you are around $55–70M of independent-vendor revenue. If that is 12–20% of the real category, implied SAM is ~$450M.

  Australia alone is too small to be the SAM (Tracxn: ~500–576 AI companies). It is a wedge, not the market.

  **SOM — $4M ARR in 36 months** (range $1.5–8M).

  That is ~0.9% of SAM, and it matches **Dify** (~$3–7M ARR, 3 years, $180M valuation) more than Gumloop’s YC/Benchmark path. Rough path: **$0.35M year 1** (free + inference markup + 1–2 consulting jobs) → **$1.5M year 2** → **$4M year 3** (~500 customers × ~$8k). Upside $8M only if PLG actually works. Do not write “1% of TAM = $50M” — that is a Series B outcome, not a 36-month solo-founder plan.

  The number that can kill this: if founders keep shipping backends in Claude Code, SAM collapses to the visual-builder niche that is already only ~$40–70M of captured ARR. $4M SOM only holds if Spine stays lower-friction than Claude + a VPS for non-AI-eng founders.

CLAUDE

  | | 2026 | 2030 | Definition |
  | --- | --- | --- | --- |
  | **TAM** | ~$25B | ~$85B | Global spend on building + running production AI systems: LLMOps software, agent platforms, prompt-to-app builders, and the AI implementation services they displace. |
  | **SAM** | ~$2.5B | ~$9B | Self-serve-reachable geos (NA / EU / UK / ANZ), non-enterprise buyers, build-host-eval wedge only. |
  | **SOM** | $1–3M (yr 1–2) | $20M base / $150M+ bull (yr 5) | Beachhead: ANZ + agency channel, then the vibe-coding motion. |

  **TAM — top down.** LLMOps software is $7.1B in 2026 → $15.6B by 2030 (21.6% CAGR, TBRC). Agent platforms add $5.3B (narrow) to $12.1B (broad) in 2026 → $14–53B by 2030. Prompt-to-app / vibe coding is $4.7B in 2026 at 38% CAGR. AI consulting and implementation is $14B in 2026 → $73B by 2033. These overlap heavily; de-duplicated, the build-and-run layer is **~$25B today, ~$85B by 2030**.

  For reference, the whole low-code market Gartner sizes at $44.5B in 2026. We are the AI-native slice of that same budget line.

  **TAM — bottom up (sanity check).** ~9M developers have built on Gemini, 10M+ on Copilot; that implies roughly 300k–1M organisations shipping LLM features. At a $10–30k blended annual platform spend, that is $5–30B — brackets the top-down number.

  **SAM.** Three cuts off TAM: geography (NA + Western Europe + ANZ ≈ 65% of spend), buyer (startups and mid-market without a dedicated AI team — we do not win the F500, they buy Databricks or Big Four), and wedge (build, host, eval — not GPU serving, vector DBs, or governance suites). $25B × 65% × ~20% ≈ **$3B**.

  Bottom-up agrees. 37.4k AI-native companies globally, 8.7k funded, 3.6k Series A+ (Tracxn). Call the reachable ICP ~150k teams across target geos once you include non-AI-native SMBs shipping AI features. Priced against the peer set — Dify $59–159/mo per workspace, Vellum $50–500/mo self-serve — a $6k blended ACV gives $0.9B, plus ~$1B of productisable mid-market implementation spend. **~$2–3B.**

  **SOM — and the honest base rate.** The direct peer cohort clusters between $1M and $13M ARR: Dify $3M at three years ($180M valuation), Relevance AI $12.6M, Vellum $3.5M, StackAI $2.9M (acquired by Asana for $75M). That is the gravity of this category, and it is the 20%-of-VC-fundable problem.

  What breaks out of it is the consumer-facing motion, not the enterprise one. Lovable went $200M → $500M ARR in seven months and $6.6B → $13.3B valuation in eight; Bolt hit $40M ARR in five months; Replit is targeting $1B ARR this year. Prompt-to-app distribution is an order of magnitude faster than LLMOps distribution.

  - **Year 1–2, $1–3M ARR.** ANZ beachhead: 609 AI companies, 192 funded, plus the KPMG / NAB / agency channel. 150–300 paying teams at $3–5k, plus two to four implementation engagements at $200k–1M each.
  - **Year 3, $20M ARR (base) = 0.5% of SAM.** Clears Relevance AI, roughly 6x Dify's three-year mark.
  - **Year 5, $150–250M ARR (bull) = 2–3% of SAM.** Only reachable if the vibe-coding product carries the acquisition and the enterprise tooling monetises the traffic.

  The services leg is what de-risks the early years: implementation deals run $200k–$1M at 30–40% margin and managed AI services $10–50k/month at 50–65% with very high retention. It funds the consumer motion that produces the outlier outcome.


# Traction

(For context, I was planning on pivoting, but i've come back to this idea.)

Strong industry connections with NAB, KPMG, and AI-Engineering agencies, a phone call away.

Interviews with startup founders experiencing severe and urgent pain with AI engineering. 

# Pricing

Initially, free with inference markup to get maximum user feedback. 
Later, a synergistic multi-pronged approach.
- vibe coding consumer facing product - name brand driver
- enterprise development tooling for tooling
- consulting services to companies requiring enterprise development without dedicated engineering teams

# What is our moat?

Claude eats our product with time (my original reason for pivoting.)
Currently, a claude code user still needs to handle deployment, until anthropic clones our product.
Until then, we will still be the lowest friction solution to engineering a backend.

Our plan is : make money first, build a moat later.
No product is truely safe from a superintelligent claude 10, 
and adapting to market demand is the best plan. 


# Quick technical deep dive


*show images*









