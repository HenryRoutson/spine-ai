# Pipelines × websites (many-to-many)

A **pipeline** is a typed DAG (`Project`). A **website** is a vibe-coded hosted page (`site_` share link). They are independent lists with a many-to-many bind. Share stays the simple hosted-page UI; it lives on the website, not nested inside a pipeline.

IA comparison: Windmill Apps/Flows, Retool Apps/Workflows, Lovable preview-as-product. Canvas: `pipelines-websites-ia.canvas.tsx`.

Code markers: grep `TODO (websites-m2m` — source of truth is [`combined_full_stack/lib/server/pipelines-websites-roadmap.ts`](../combined_full_stack/lib/server/pipelines-websites-roadmap.ts).

Related: [`lovable_parity_plan.md`](lovable_parity_plan.md) F0 put the page studio on pipeline Vibe Share. This plan **moves** that studio onto the website object. Do not rebuild ShareSiteForm.

---

## Reuse

| Keep | Do not |
|------|--------|
| `Project` = one pipeline | A `kind: "website"` project |
| `site_` SharedLink + `/site/{id}` | A second hosting product |
| `HostedSitePageStudio` + `ShareSiteForm` | Nesting the studio under pipeline Share as the home |
| Documents “Available in” chips | A new attach metaphor |
| Simple funding / spend-limit / Create-Save | Developer Link/API/Embed on the website vibe |

---

## Data

`HostedSiteOptions` gains:

- `pipelineBindings: { alias, projectId }[]` — empty means “the link’s `projectId` only” (today).
- `runtime: "html" | "react"` — default `html`.
- `reactFiles: { path, contents }[]` — Vite-style tree when `runtime === "react"`.

`SharedLink.projectId` remains the **primary** pipeline (permissions, billing fallback, default `{{run}}`). Extra pipelines are bindings. Named HTML slots: `{{run}}` (alias `run`) and `{{run:alias}}`. React: `<RunPipeline alias="…" />`.

---

## UI

**Picker** — tabs `Pipelines` | `Websites` (same chrome as Run’s My pipelines / Shared). Separate New buttons.

**Open pipeline** — current builder. Vibe observe: Inference / Schedule / Logging. Simple Share = pipeline link, not the page studio (after websites page exists). Chips: used-by websites.

**Open website** — hydrate `ShareSiteForm` for that `site_` id (re-edit, not a blank mint). Studio + bindings table + existing Share chrome. Page assistant cannot edit pipelines.

**Build Share (developer tools)** — Link / API / Embed stay. Page tab creates or opens a website instead of owning the only studio.

---

## HTML → React

Toolbar toggle next to Vibe / Code. Confirm both directions. HTML → React generates `src/App.tsx`, CSS, and `RunPipeline`. React → HTML keeps a last-HTML snapshot. Export still uses `hosted/*` plus the React tree when runtime is React. No GitHub two-way.

---

## Sequencing

1. Picker lists + hydrate existing sites (do not break Open pipeline).
2. Bindings on `siteOptions`; public runtime resolves alias → project.
3. Website as the studio home; pipeline Share stops nesting the page builder.
4. HTML | React switch + React preview.
