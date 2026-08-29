// AI : Workspace library + share + function↔website — grep "TODO (lib-share" / "DONE (lib-share".
// Product: pipelines and websites are the same four shelves. Share lives above
// "pipeline" vs "website". A project is functions over shared structures (SQL tables).
// Do not invent a second SQL product — structures already name tables.

export {}

// ---------------------------------------------------------------------------
// P0 — Library shelves (pipelines | websites) × (yours | shared | marketplace | templates)
// ---------------------------------------------------------------------------
// AI : DONE (lib-share-P0-shelf) — LibraryShelf is the generic picker chrome
// AI : DONE (lib-share-P0-website-templates) — seeds with hostedSite show under Websites → Example templates
// AI : DONE (lib-share-P0-double) — Double / 3n+1 is two functions over shared_number, cloneable as a website
// AI : TODO (lib-share-P0-mkt-site-row) — persist marketplace.kind = pipeline | website (snapshot + siteOptions)

// ---------------------------------------------------------------------------
// P1 — Share is generic; only some cards are entity-specific
// ---------------------------------------------------------------------------
// AI : DONE (lib-share-P1-target) — ShareTarget = pipeline | website; ShareSheet on Build + website studio
// AI : DONE (lib-share-P1-cards) — Link + Embed for both; API only on pipelines; funding only if a function can run
// AI : TODO (lib-share-P1-you-i-pay-blank) — page-only site: hide you-pay / I-pay (no run to bill)
// AI : TODO (lib-share-P1-publish-site) — Marketplace publish stores siteOptions + bound function ids

// ---------------------------------------------------------------------------
// P2 — Functions sharing structures (#9 / #19)
// ---------------------------------------------------------------------------
// AI : DONE (lib-share-P2-fn-bind) — HostedSiteActionBinding.functionId + WebsitePipelineBinding.functionId
// AI : DONE (lib-share-P2-run) — hosted run / SQL / preview use projectForFunction (schedules already did)
// AI : DONE (lib-share-P2-vibe) — pipeline vibe authors named functions; actions bind functionId
// AI : TODO (lib-share-P2-live-spine) — stop withLiveModules copy-in/out; engine reads functions[].modules only

// ---------------------------------------------------------------------------
// P3 — Websites independent (#18)
// ---------------------------------------------------------------------------
// AI : DONE (lib-share-P3-no-inject) — empty pipelineBindings stay empty at runtime
// AI : DONE (lib-share-P3-page-only) — site mint without a stub host pipeline
// AI : TODO (lib-share-P3-nullable-db) — shared_links.project_id nullable (today "" means page-only)

// ---------------------------------------------------------------------------
// P4 — SQL is the structure layer, not a second engine
// ---------------------------------------------------------------------------
// AI : DONE (lib-share-P4-table) — action.table + function outStructure → tableNameForModel
// AI : TODO (lib-share-P4-typed-row) — structure field types are the SQL row type (no parallel schema)
