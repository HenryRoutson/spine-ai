// AI : Pipelines × websites many-to-many — grep "TODO (websites-m2m" / "DONE (websites-m2m".
// Plan: docs/pipelines_and_websites_plan.md
// Do NOT make website a Project.kind. Do NOT rebuild ShareSiteForm.
// A Project stays a pipeline. A website stays a site_ shared link with bindings.

export {}

// ---------------------------------------------------------------------------
// P0 — Independent lists + bindings on siteOptions
// ---------------------------------------------------------------------------
// AI : DONE (websites-m2m-P0-picker) — /pipelines and /websites entry URLs; picker tabs Pipelines | Websites
// AI : DONE (websites-m2m-P0-bindings) — HostedSiteOptions.pipelineBindings; empty = link.projectId only
// AI : DONE (websites-m2m-P0-hydrate) — open website hydrates ShareSiteForm for that site_ id
// AI : DONE (websites-m2m-P0-slots) — {{run:alias}} parsed; {{run}} still the primary pipeline

// ---------------------------------------------------------------------------
// P1 — Website is the page-studio home
// ---------------------------------------------------------------------------
// AI : DONE (websites-m2m-P1-vibe) — website vibe = page studio full-width; pipeline Share is link + websites list
// AI : DONE (websites-m2m-P1-runtime) — public /site/{id} resolves alias → bound pipeline run
// AI : DONE (websites-m2m-P1-workspace) — website chrome is Website • name; Building = page code, not pipeline DAG

// ---------------------------------------------------------------------------
// P2 — HTML | React switch
// ---------------------------------------------------------------------------
// AI : DONE (websites-m2m-P2-switch) — studio toolbar HTML | React; generate reactFiles from HTML snapshot
// AI : DONE (websites-m2m-P2-preview) — React preview compiles the file tree and mounts live RunPipeline widgets
