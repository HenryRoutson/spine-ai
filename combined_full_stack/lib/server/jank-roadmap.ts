// AI : Hardcoded / non-generic / leftover — grep "TODO (jank-" / "DONE (jank-".
// Survey of allowlists, filename heuristics, identity leftovers, and GUI-only hosts.
// Do NOT expand Connect to hundreds of pieces. Do NOT treat filename "confidential" as ACL.
// Large product work stays on existing roadmaps (connect, fork, media-view, arch, mcp-capability).

export {}

// ---------------------------------------------------------------------------
// Security / deploy leftovers
// ---------------------------------------------------------------------------
// AI : DONE (jank-landing-secret) — hosted deploys require LANDING_BUILD_ACCESS_SECRET or
// AI :   LANDING_DEMO_PROXY_SECRET; never sign with SUPABASE_SERVICE_ROLE_KEY.
// AI : DONE (jank-redirect-decode) — sanitize_redirect.ts decodes once; rejects %2e%2e, control
// AI :   chars, leftover encoding, and protocol-relative / traversal after decode.
// AI : DONE (jank-cors-app-origin) — landing_demo_cors.ts allows spine-ai-app.dev (live app host).
// AI : TODO (jank-shared-run-abuse) — rate_limit_config shared_run is IP-bucketed (5/10m);
// AI :   rotation still drains sharer_pays credits. Pair with CAPTCHA / spend caps.
// AI : TODO (jank-pyodide-cdn) — custom_code.ts loads Pyodide from jsDelivr; pin SRI or self-host.
// AI : TODO (jank-confidential-name) — confidential-upload.ts is a filename substring UX hint;
// AI :   trivial bypass — do not treat as access control.

// ---------------------------------------------------------------------------
// Identity / URL drift
// ---------------------------------------------------------------------------
// AI : TODO (jank-legal-identity) — shared/legal/site.ts controllerName is still
// AI :   "Spine (Antler hackathon project)". Product rename is a legal copy change.
// AI : TODO (jank-site-urls) — production hosts are split: spine-ai.dev (marketing),
// AI :   spine-ai-app.dev (app), app.usespine.com (login), auto-pipeline.dev (legacy CORS).
// AI :   One constant module + env overrides; do not hardcode a fourth name.
// AI : DONE (jank-mcp-paths) — .cursor/mcp.json uses PATH `node` + mcp_tool/spine-mcp.mjs (cwd .).
// AI : TODO (jank-oauth-login) — login page GitHub/Google OAuth is commented out
// AI :   (callback route exists at /auth/callback).

// ---------------------------------------------------------------------------
// Allowlists / filename heuristics
// ---------------------------------------------------------------------------
// AI : TODO (jank-connect-allowlist) — Connect catalog is Slack + Gmail + Sheets + HTTP
// AI :   (plus matching AP three). Grow only when a seed needs an id (ap-sidecar-C-grow).
// AI : TODO (jank-doc-name-match) — inputNameContains is a filename substring. A marking
// AI :   guide and homework can "match" and still be the wrong documents. Schema-gated
// AI :   upload / typed pairing is the generic fix (TODO.txt).
// AI : TODO (jank-test-filename) — tests are discovered by *_testing.json suffix, not a
// AI :   doc label or type. tutoring_* fixtures skip until expectedOutputs exist.
// AI : DONE (jank-default-model) — UI fallbacks use DEFAULT_MODEL / DEFAULT_VISION_DOC_PARSE_MODEL.
// AI : DONE (jank-frontend-stub-drift) — types.ts is the source of truth; no v0 stub in this repo.

// ---------------------------------------------------------------------------
// Host / surface limits (leave on existing roadmaps; ids for grep)
// ---------------------------------------------------------------------------
// AI : TODO (jank-human-review-modes) — HumanReview is approve/reject passthrough.
// AI :   Chat-until-resolution + single-text (+ optional voice) still in TODO.txt.
// AI : TODO (jank-codehost-node) — custom code + human-review throw on MCP/CLI
// AI :   (mcp-capability). Browser CodeHost / Pyodide only.
// AI : TODO (jank-app-sql-join) — app-sql.ts is SELECT/UPDATE/INSERT, equality WHERE, no JOIN.
// AI : TODO (jank-export-quad) — webhook/orchestrator bodies are copied four times
// AI :   (arch-export-webhook / arch-export-file).
// AI : TODO (jank-pipeline-god-object) — PipelineModule is one shape for every kind
// AI :   (arch-module-union). Dual FieldType + TypeExpr (fieldTypeToExpr).
