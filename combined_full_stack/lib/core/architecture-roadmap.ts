// AI : Architecture / duplication — grep "TODO (arch" for open work.
//
// Keep (do NOT merge):
//   - Client useStore, server Store, SpineSession stay three stores (docs/parity.md).
//   - ModuleKind.Llm is not webhook; n8n is not webhook (remote-call / n8n roadmaps).
//   - shared/ copies under lib/shared/ are sync-shared.sh output — edit shared/, not the copies.
//   - BAML export is a different IR; don't force it into the ts/py/go/rs table.
//
// Layers that are already right:
//   - Domain types: lib/types.ts re-exports lib/server/types.ts (one Project / PipelineModule).
//   - Validators: GUI/CLI/MCP import computeInvalid — do not reimplement.
//   - Actions-as-data: lib/core/actions.ts ids match useStore / SpineSession names.
//   - Overlay: overlayOptimisticProjects shared by GUI + session.
//
// Open refactors (file-level TODOs use the same tags):

// AI : TODO (arch-thin-store) — GUI useStore reimplements rename/delete/apply; wrap SpineSession
// AI :   for local mutations. React keeps hydration, debounce save, billing caches (parity.md §8.5).
// AI : TODO (arch-gui-viewmodels) — React pipeline/docs panels should consume toPipelineView /
// AI :   toDocsView so CLI and GUI cannot drift (parity.md §8.5).
// AI : DONE (allow-pipeline-non-linear-fork) — series-parallel Fork step (nested linear lanes + join).
// AI :   Not React Flow. See lib/server/fork-roadmap.ts. Linear spine + Parallel/Combine/Assemble stay.
// AI : TODO (arch-module-union) — PipelineModule is a god object; discriminated union per ModuleKind.
// AI : TODO (arch-store-async) — Store is sync + write-behind RAM; make methods async (JsonStore vs
// AI :   SupabaseStore should not both be in-memory mirrors).
// AI : TODO (arch-export-dispatch) — table is pipeline_export_dispatch.ts (ModuleKind × ts/py/go/rs).
// AI :   Merge/example-select step bodies call lib/export_runtime (copied into zips, not generated).
// AI : TODO (arch-export-file) — generatePipelineSource* still assemble sections in 4 files;
// AI :   one assembler + lang adapters after dispatch is the only kind switch.
// AI : TODO (arch-export-webhook) — exportWebhookStepBody{Ts,Py,Go,Rust} is the same call shape four times.
// AI : TODO (arch-export-orchestrator) — do not IR-print yet; generateOrchestrator* + generate*StepBody*
// AI :   still walk the same spine (leave BAML alone). Next after arch-export-file.
// AI : TODO (arch-export-stubs) — runtime libraries live in lib/export_runtime/{ts,py,go,rs}/ and are copied into zips. Generated pipeline files import them. LLM JSON schemas come from exportLlmSchemaJson.
// AI : TUI_AREAS / BUILDER_AREAS / prefetch chunks derive from lib/app-area-windows.ts + AppWindowId.
// AI : DONE (arch-assistant-http) — pipeline-assistant/route.ts re-exports project-assistant.
// AI : TODO (arch-structure-assistant) — HTTP structure-assistant uses full project assistant;
// AI :   CLI still calls proposeStructureChange. One path.
// AI : DONE (arch-assistant-billing-http) — testing/diagnosis/summary/evaluate share parseAssistantRequestModel.
// AI : TODO (arch-proposal-changed) — ProjectProposal.changed mirrors proposal fields.
// AI : TODO (arch-billing-view) — BillingAccountView declared in core/types and again (richer) in store.tsx.
// AI : TODO (arch-share-form) — spend-limit parse is shared; busy/copy/default-docs still duplicated.
// AI : TODO (arch-lint-types) — pipeline_lint vs pipeline_export_lint diagnostic types overlap.
// AI : TODO (arch-validity-split) — validity.ts mixes graph I/O, n8n; canRunStep removed; keep computeInvalid
// AI :   as the graph checker (linter-first TODOs already cover replacing TS heuristics).
// AI : TODO (arch-run-engine-name) — lib/run-engine.ts is the browser client-step shim; server engine
// AI :   is lib/server/run_engine/. Rename the client file so "run engine" isn't two trees.
// AI : TODO (arch-window-ids) — AppWindowId is the window catalog (pure, no React). Optional: move to
// AI :   lib/core/windows.ts so core/view does not import from lib/app-window-id.
// AI : DONE (arch-store-overlay) — overlayStore(base, extraDocs, extraContent) shared by hosted + shared-link.
// AI : TODO (arch-ephemeral-store) — landingEphemeralStore and parity ephemeralStore are copy-paste noop Stores.
// AI : DONE (arch-hash-content) — SpineSession and store import hashContent from lib/content-hash.
// AI : TODO (arch-blank-project) — session blankProject twins seed.blankProject; one factory.
// AI : TODO (arch-validate-wrap) — cli/validate_project remaps computeInvalid; wrap lintPipeline instead.
// AI : TODO (arch-chat-turn) — SessionChatTurn identical to assistant-shared ChatTurn; one type.
// AI : TODO (arch-proposal-port) — core/types imports ProjectProposal from GUI assistant types; use a
// AI :   neutral port so core does not depend on project-assistant-types.
// AI : TODO (arch-workspace-edits) — promote cli/workspace_edits into SpineSession (or core/workspace)
// AI :   so GUI builders don't reimplement add-model/add-step.
// AI : TODO (arch-run-chrome) — inference.tsx and testing.tsx share start/stop/job-hub/trace chrome.
// AI : TODO (arch-consumer-run) — own-pipeline-run-panel and shared-run-panel are one ConsumerRunPanel
// AI :   with funding/download slots.
// AI : TODO (arch-pydantic-walk) — allModelsTo{Pydantic,Dts,Rust,Go,Baml} share a field walk; printers only.
// AI : DONE (arch-cli-result) — flagString / cliOk / cliUsage live in cli/types.ts.
// AI : TODO (arch-parser-cache) — JsonStore parser/vision cache should use parser_vision_cache_index + fs adapter.
// AI : TODO (opt-browser-tui) — optional GUI terminal mode (not required). DOM skin of Ink ViewModels
// AI :   + extracted controller; never Ink-in-browser or a PTY. lib/cli/ink/browser-tui-roadmap.ts.
// AI : DONE (vibe-fewshot-explode) — Example 1c wrapper + flatten; PromptListVsItem warning.
// AI : DONE (vibe-fewshot-parallel) — Example 5 parallel lanes then memo.
// AI : DONE (vibe-fewshot-assemble) — greenfield names assemble; Example 4 kept.
// AI : DONE (vibe-mustache) — prompts are not templates; incremental user message repeats it.
// AI : DONE (vibe-document-clone) — structure rules: do not clone Document.
// AI : DONE (vibe-module-patch) — incremental turns prefer modulePatch in the user message.
// AI : DONE (vibe-unused-model) — PipelineWarningKind.UnusedModel.
// AI : DONE (session-chat-isolate) — never copy orphan global chat; chatForActiveProject uses bag only.
// AI : DONE (mcp-ask-timeout) — ask_agent returns inFlight; poll get_project.
// AI : DONE (arch-pending-creates) — persist pendingCreateIds; extras-only pendingCreates.
// AI : DONE (sql-id-ref) — slices A–B: Key column, branded ids, catalog, inspector, inspect_ids.
// AI : TODO (sql-id-ref) — slice C: run JSON tables, allowed-id LLM hints, near-match, checkRefs.
// AI :   Distinct from field.ref (embed) and type-join (lookup-embed). lib/sql-id-roadmap.ts.
// AI : DONE (media-view-A-registry) — data vs view: InputType media + DataViewPanel; not TypeExpr kinds.
// AI :   Grep TODO (media-view. lib/server/media-view-roadmap.ts + docs/media_and_custom_views_plan.md.

export {}
