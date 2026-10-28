# Web Research Scraper

This bundled example **scrapes web pages as a pipeline step** — Python (optional [Ray](https://github.com/ray-project/ray) fan-out) turns search hits into plain text, then an LLM-batch extracts facts and a final LLM writes a briefing.

## Problem

A research brief is not enough. You need current public pages, but live search + fetch does not belong in the LLM prompt. Search, scrape, and extract should be separate steps so scrape stays deterministic and parallel.

## Approach

1. **Research brief** — topic + goals on pipeline state.
2. **Search hits** — JSON in the same shape an [n8n](https://n8n.io) web-search workflow would POST (`query`, `provider`, `results[]` with `url` / `title` / `snippet` / optional `html`).
3. **Scrape Pages (Python)** — strip HTML snapshots; if `html` is empty, fetch the URL. When Ray is installed (exported Python runner), fetches run as remote tasks.
4. **Extract Facts (llm-batch)** — one structured call per page.
5. **Write Briefing (llm)** — synthesize using the brief + extracts.

In-app, bundled `html` snapshots keep the scrape step offline and CORS-safe. Export the pipeline as Python and `pip install ray` to fan out live fetches.

## Pipeline (this seed)

| Step | Kind | Role |
|------|------|------|
| Research Brief | input | Topic + goals (`research_brief.txt`) |
| Parse Brief | custom-code | `{ topic, goals }` on pipeline state |
| Search Hits | input | n8n-shaped JSON — side input, must be followed by **Combine Inputs** |
| Combine Inputs | combine | Merges `ResearchQuery` + `SearchHitFile` |
| Parse Hits | custom-code | `list[SearchHit]` from `bundle.search.results` |
| Scrape Pages | custom-code (Python, TS fallback) | HTML → text; Ray-parallel fetch when exported |
| Extract Facts | llm-batch | Structured facts per scraped page |
| Merge for Briefing | merge | `{ topic, goals, extracts }` |
| Write Briefing | llm | Executive briefing with cited sources |
| Briefing Output | output | Final artifact |

## Bundled files

- `research_brief.txt` — Ray vs n8n research question
- `search_hits.json` — three public-docs hits with HTML snapshots (Ray, n8n, Python HTTP)
- `web_research_scraper_inference.json` — default Inference preset
- `web_research_scraper_testing.json` — golden deterministic steps; LLM steps use null placeholders

## Swap Search Hits for n8n

n8n is not a first-class step yet. To drive search from n8n instead of the JSON upload:

1. Build an n8n workflow: **Webhook** → search node (SerpAPI / Tavily / HTTP Request) → optional HTTP Request per URL for HTML → respond with `{ query, provider: "n8n", results: [{ url, title, snippet, html }] }`.
2. In the builder, replace **Search Hits** with a **Webhook** step (`POST`, URL `env:N8N_WEB_SEARCH_URL`) whose output structure is `SearchHitFile`.
3. Keep **Scrape Pages** — n8n can leave `html` empty and let Python/Ray fetch, or fill `html` so scrape only strips tags.

## Tips

- Prefer **HTML snapshots** in tests so scrape is deterministic.
- Live fetch only when `html` is missing; respect robots.txt and rate limits.
- Export as **Python** and add `ray` to use the parallel path (`pip install ray`).
- Use a cheap model on Extract Facts; the briefing step is where quality matters.
