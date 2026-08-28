// AI : Spine-in-Spine bootstrap — rebuild the Spine *product UI* as a Spine hosted app.
// Grep: TODO (spine-in-spine-bootstrap
// P11 dogfood (compiler + toy seed) already shipped — this file is the next work.
//
// Vibe prompt (paste one step tag):
//   Implement TODO (spine-in-spine-bootstrap-S<n>-…) in this file.
//   Read the step block, the "Do not rebuild" list, and the files it names.
//   Do not port React. Do not add a second run engine. Mark the tag DONE when shipped.

export {}

// ---------------------------------------------------------------------------
// READ FIRST — host vs guest (chicken and egg)
// ---------------------------------------------------------------------------
// Spine cannot compile Spine until something already runs pipelines and mounts
// hosted HTML. Split the product:
//
// HOST (keep in Next.js — this IS the runtime; guest pages call it)
//   lib/server/run_engine/     execute LLM / batch / custom-code / input / output
//   lib/core/session.ts        SpineSession mutations + snapshot
//   lib/core/actions.ts        SESSION_ACTIONS (id → session method)
//   lib/hosted-site-slots.ts   {{run}} {{table}} {{pay}} {{auth}} {{output}} {{chatbot}} {{docs}}
//   components/share/hosted-site-viewer.tsx   slot renderer
//   auth, document blobs, billing ledger, LLM HTTP, page studio (edits guest HTML)
//
// GUEST (the Spine-in-Spine app — what we vibe-code)
//   structures  = product tables (Project, StructureModel, PipelineStep, …)
//   functions   = named pipelines bound into {{run:alias}}
//   pages       = hosted HTML that *composes slots*, not 247 React components
//
// P11 today (`lib/spine-in-spine.ts`, `seeds/spine_in_spine.json`) is a *compiler
// demo*: 3 toy tables, 2 marketing pages, one mega HTML. It is not the product.
//
// v1 = guest UI on host engine. v2 (later) = describe the run engine itself as
// Spine pipelines. v3 (later) = drop the React AppShell. Do v1 first.

// ---------------------------------------------------------------------------
// Efficiencies the bootstrapped version already gives you (vs the React app)
// ---------------------------------------------------------------------------
// These are real savings — use them; do not reimplement the React cost.
//
// 1. Types ARE SQL.
//    StructureModel = pydantic class = CREATE TABLE (`allModelsToSql`, P11
//    `compileSchemaPack`). React today keeps Zod + TS props + Supabase
//    migrations + jsonb blobs in parallel. Guest CRUD is rows on tables.
//
// 2. Slots ARE the UI widgets. You do not write them.
//    {{run}} {{run:alias}}  pipeline run + auto upload form (P3)
//    {{table:Model}}        live rows (P8) — HostedTableSlot
//    {{pay}}                funding / checkout (P8)
//    {{auth}}               sign-in
//    {{output}}             DataViewPanel
//    {{chatbot}}            chat widget (Vibe right-pane equivalent)
//    {{docs}}               document viewer
//    React rebuilt each of these as tab-sized components (~247 .tsx files).
//
// 3. Compile is LLM-free, cached, $0.
//    SPINE_SCHEMA_COMPILE_TS / SPINE_WEBSITE_COMPILE_TS are pure functions.
//    Changing the builder chrome is "edit the blueprint + recompile", not a
//    Next.js rebuild. Tests are golden JSON (already in documents/spine_in_spine).
//
// 4. Mutations are already UI-independent.
//    SpineSession + SESSION_ACTIONS + data-spine-id (parity catalog).
//    CLI / TUI / MCP already drive the product without React. Hosted HTML is
//    another skin of the same actions — not a fourth store.
//    Quadratic LLM savings (docs/LLM_spine_summary.markdown) apply to *user
//    pipelines* (batch steps), not to the builder chrome. Builder savings are
//    surface area: slots + tables + actions replace components.
//
// 5. ViewModels already exist.
//    lib/core/view.ts `toPipelineView` / `toStructureView` / `toInferenceView`
//    / `toTestingView` / `toDocsView` / `toLogsView` / … TUI renders these.
//    Custom slots (DAG, traces) should consume ViewModels, not useStore.
//
// 6. One-click share, typed ports, upload forms, row store already shipped.
//    P1 ports, P3 upload, P4 share hub, P8 slots, P12 functions, P13 rows.
//    Guest pages bind them. Do not rebuild Vibe, ShareSiteForm, export, session.

// ---------------------------------------------------------------------------
// How to make Spine-in-Spine *simpler* than the React app (constraints)
// ---------------------------------------------------------------------------
// Follow these or the guest becomes a second React app inside HTML strings.
//
// R1 Slot-first. If a slot exists, use it. Never rewrite pay / table / auth /
//    run / docs / chatbot / output in guest HTML.
// R2 Session-only writes. Buttons use data-spine-id → SESSION_ACTIONS.
//    No useStore in guest. No new REST routes that wrap session methods.
// R3 Tables for CRUD. Editing a Project / field / step / doc / run is
//    {{table:Model}} (+ add/delete action ids). Not a custom form per entity.
// R4 Four pages, not 15 tabs. Vibe | Structures | Functions | Account.
//    Logging/cache/earnings/settings collapse into tables on those pages.
// R5 Extract, don't rewrite, the few widgets HTML cannot do:
//    pipeline DAG, type-expr editor, step trace, Monaco code.
//    These become HostedSlot widgets wrapping *existing* components.
// R6 User pipelines run on the HOST engine. The guest "Run" slot binds to the
//    selected user Project row — it does not reimplement lib/server/run_engine.
// R7 No shadcn port. Hosted CSS (hosted-site-defaults) + slots.
// R8 No Next.js route per builder tab. Guest nav is hosted page links.
// R9 Compiler stays pure. HTML/SQL come from AppBlueprint functions; keep
//    seed custom-code byte-equal to the TS source (existing test).
// R10 Feature-flag beside React. Do not delete AppShell until S10 is proven
//    against the parity catalog.

// ---------------------------------------------------------------------------
// Do not rebuild (reuse)
// ---------------------------------------------------------------------------
//   SpineSession, SESSION_ACTIONS, PARITY_ROWS / data-spine-id
//   to*View ViewModels (lib/core/view.ts)
//   Vibe chat = ProjectAssistantDockPanel → {{chatbot}} (do not fork assistant)
//   ShareSiteForm, PipelineExportDialog, HostedSitePageStudio (page studio stays HOST)
//   run engine, documents, cache, billing APIs
//   P11 compiler strings — extend them; do not start a second compiler

// ---------------------------------------------------------------------------
// React → guest map (what each tab becomes)
// ---------------------------------------------------------------------------
//   Vibe            page /           {{chatbot}} + {{run:active-user-project}}
//   Structures      page /structures {{table:StructureModel}} {{table:ModelField}}
//                                    + slot:type-expr (S4)
//   Pipeline        page /functions  slot:pipeline-dag + {{table:PipelineStep}}
//   Testing         page /functions  {{run:test}} + {{table:ExpectedOutput}}
//   Inference       page /           {{run}} {{docs}} {{output}}  (same as Vibe)
//   Documents       page /           {{docs}} + {{table:Document}}
//   Share           host studio + {{pay}}  (do not nest studio in guest)
//   Logging/Cache   page /functions  {{table:PipelineRun}} {{table:CacheEntry}}
//   Billing/Earn    page /account    {{pay}} + {{table:Earnings}}
//   Settings        page /account    {{auth}} + {{table:AccountPref}}
//   AppShell/nav    hosted <nav> links between those four pages

// ===========================================================================
// S0 — Freeze the split (docs in this file; no code)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S0-freeze) — treat HOST vs GUEST above as the spec.
// AI :   v1 never moves run_engine / session / slot renderer / auth / blobs / billing
// AI :   into guest custom-code. Page studio stays host (or the guest cannot edit itself).

// ===========================================================================
// S1 — Real product schema (replace the toy blueprint tables)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S1-schema) — expand SPINE_PLATFORM_BLUEPRINT.tables
// AI :   in lib/spine-in-spine.ts + write_spine_in_spine_seed.ts models[].
// AI :   Start with fields a {{table}} can CRUD — not every React prop.
// AI :
// AI :   Project            id, name, kind, documentation, active_function_id
// AI :   StructureModel     name, description, auto, dynamic, locked
// AI :   ModelField         model_id, name, type_name, optional, description, ref, deterministic
// AI :   PipelineFunction   project_id, name
// AI :   PipelineStep       function_id, kind, label, in_structure, out_structure, prompt
// AI :   Document           hash, name, type, label
// AI :   PipelineRun        project_id, status, cost_cents, started_at
// AI :   SharedLink         kind, funding_mode
// AI :   WebsitePage        path, headline, html
// AI :
// AI :   Skip on purpose (host keeps them): ModuleKind god-object fields, fork lanes,
// AI :   custom LLM providers, team pointers, visualizers. Add a column when a table
// AI :   cell is enough; add a custom slot when it is not (S4).
// AI :   Regen seed: npx tsx scripts/write_spine_in_spine_seed.ts
// AI :   Test: lib/spine-in-spine.test.ts still byte-equals compiler source.

// ===========================================================================
// S2 — Four hosted pages (not one mega HTML)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S2-pages) — compiler emits one HTML string per
// AI :   page_def, not a single concatenated marketing page.
// AI :   pages[] in the blueprint become HostedSiteOptions.pages[] (lovable-F2 already
// AI :   supports this). Layout per page:
// AI :     /            nav + {{chatbot}} + {{run:active-user-project}} + {{output}} + {{docs}}
// AI :     /structures  nav + {{table:StructureModel}} + {{table:ModelField}} + {{slot:type-expr}}
// AI :     /functions   nav + {{slot:pipeline-dag}} + {{table:PipelineStep}} + {{table:PipelineRun}}
// AI :     /account     nav + {{auth}} + {{pay}} + {{table:Earnings}}
// AI :   Nav is plain <a href> between hosted pages. Drop AppWindowId for the guest.
// AI :   Files: lib/spine-in-spine.ts SPINE_WEBSITE_COMPILE_TS, lib/hosted-site.ts pages[].

// ===========================================================================
// S3 — Hosted buttons → SpineSession (the missing primitive)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S3-actions) — hosted HTML click on data-spine-id
// AI :   dispatches SESSION_ACTIONS. Reuse SPINE_ACTION_ATTR (lib/core/parity.ts).
// AI :   Do NOT invent {{action:id}} unless a token is easier than a button attribute.
// AI :   Wire in HostedSiteChrome / hosted-site-viewer: capture click, lookup
// AI :   SESSION_ACTIONS[id], parse closest form fields into the zod input, run.
// AI :   First ids to prove: project.add, project.open, structure.add-model,
// AI :   structure.add-field, pipeline.add-step, documents.remove, assistant.send.
// AI :   Files: lib/core/actions.ts, components/share/hosted-site-viewer.tsx,
// AI :   lib/core/parity-catalog.ts (hosted column can stay "host" until S9).
// AI :   Test: click data-spine-id="project.add" on a hosted page → session.addProject.

// ===========================================================================
// S4 — Custom slots = extract existing widgets (do not rewrite)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S4-dag) — HostedSlot "pipeline-dag" wraps
// AI :   PipelineCanvas / pipeline-builder visualization. Input: toPipelineView(snapshot).
// AI :   File to wrap: components/pipeline-canvas.tsx (not the whole PipelineBuilder).
// AI : TODO (spine-in-spine-bootstrap-S4-type-expr) — HostedSlot "type-expr" wraps
// AI :   type-expr-editor.tsx. Table cells stay type_name text; this slot edits TypeExpr.
// AI : TODO (spine-in-spine-bootstrap-S4-trace) — HostedSlot "step-trace" wraps
// AI :   simple-step-trace.tsx / logging chrome. Table of PipelineRun is the list;
// AI :   this slot is the selected-run detail.
// AI : TODO (spine-in-spine-bootstrap-S4-monaco) — HostedSlot "code" wraps the existing
// AI :   Monaco used by custom-code steps / hosted studio. Guest pages do not ship Monaco.
// AI :   Parse {{slot:pipeline-dag}} etc. in hosted-site-slots.ts the same way as
// AI :   {{table:Model}} (named alias). Token: {{slot:<widget>}}.

// ===========================================================================
// S5 — {{run}} binds to the *user* project, not the meta compile pipeline
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S5-user-run) — two different run targets:
// AI :   (a) Meta functions on the Spine-in-Spine project: Compile schema / Compile
// AI :       website (already the seed). Used by tests and "compile this blueprint".
// AI :   (b) User function: the Project row the builder has selected. {{run}} on
// AI :       page / must invoke the HOST run engine on THAT project's modules.
// AI :   Implement (b) as run alias "active-user-project": HostedSiteSlotWidgets.run
// AI :   reads session.snapshot.activeProjectId (or a selected-row id) and runs it.
// AI :   Do not write a custom-code step that loops modules — that is the host engine.
// AI :   Files: lib/website-pipelines.ts aliases, hosted-site-slot-widgets.tsx,
// AI :   components/share/shared-link-preview.tsx (already the run widget).

// ===========================================================================
// S6 — {{table:Project}} reads the host Store, not nested structureRows
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S6-mirror) — HostedTableSlot today reads
// AI :   project.structureRows for the *current* project. For the guest builder,
// AI :   Project / Document / PipelineRun rows ARE host entities.
// AI :   Adapter: if model.name is in HOST_MIRROR_MODELS, map session snapshot →
// AI :   table rows (projects list, docs, runs). Writes go through S3 actions.
// AI :   Do not nest a full Project JSON as a structureRow of the meta-project
// AI :   (that's a v2 persistence experiment, not v1).
// AI :   File: components/platform/hosted-table-slot.tsx
// AI :   HOST_MIRROR_MODELS = Project, Document, PipelineRun, SharedLink, Earnings.

// ===========================================================================
// S7 — Compiler emits the four pages + slot tokens (extend P11, don't fork)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S7-compile) — SPINE_WEBSITE_COMPILE_TS gains:
// AI :   - per-page HTML (S2)
// AI :   - {{auth}} {{chatbot}} {{docs}} on the pages that need them (today only
// AI :     {{run}} {{table:first}} {{output}} {{pay}})
// AI :   - {{slot:pipeline-dag}} / {{slot:type-expr}} where S4 landed
// AI :   - {{run:active-user-project}} on /
// AI :   Keep evalCompile + byte-equal seed test. Update expected/*.json via
// AI :   scripts/write_spine_in_spine_seed.ts (do not hand-edit goldens).
// AI :   typed_ports stay: each guest function ↔ its input table.

// ===========================================================================
// S8 — Seed opens as a hosted site (dogfood the guest UI)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S8-site) — seeds/spine_in_spine.json grows
// AI :   HostedSiteOptions (pages from compiler, pipelineBindings for compile +
// AI :   active-user-project). Opening the seed → Share → Site shows the guest
// AI :   builder, not the marketing mega-page.
// AI :   Inference preset "Compile Spine" stays for the meta pipeline.
// AI :   Files: write_spine_in_spine_seed.ts, lib/shared-link-types.ts options shape.
// AI :   Manual check: load seed, Publish, /site/{id} has nav + {{run}} + a table.

// ===========================================================================
// S9 — Parity: hosted guest === CLI/MCP/TUI actions
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S9-parity) — every guest button id is already
// AI :   a PARITY_ROWS id. Fill the hosted/GUI column as "hosted data-spine-id"
// AI :   once S3 works. Do not add parallel ids. `npm run spine -- session actions`
// AI :   remains the catalog. If an id has no SESSION_ACTIONS runner, add the
// AI :   action (core/actions.ts) before adding a button.

// ===========================================================================
// S10 — Feature flag: guest shell beside React
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S10-flag) — env/localStorage SPINE_IN_SPINE_UI
// AI :   serves the hosted Spine-in-Spine site as the app chrome instead of
// AI :   AppShellLayout tabs. React remains: slot widgets + page studio + host APIs.
// AI :   Prove with parity-catalog.test + a hosted click-through of add project →
// AI :   add structure → add step → run. Only then delete React tab panels.
// AI :   File to branch on: components/app-shell-layout.tsx

// ===========================================================================
// Later — not v1 (do not start these in the same vibe pass)
// ===========================================================================
// AI : TODO (spine-in-spine-bootstrap-S11-engine) — v2: describe run_engine steps as
// AI :   guest custom-code (input → llm → batch → output) so the engine is a Spine
// AI :   pipeline. Only after S10. Host still eval's custom-code and talks to LLMs.
// AI : TODO (spine-in-spine-bootstrap-S12-drop-react) — v3: AppShell / useStore /
// AI :   per-tab pages go away. Remaining React is HostedSlot widgets + studio.
// AI :   Blocked on S10 flag being the default for a full demo (homework grader).
