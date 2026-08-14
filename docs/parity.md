# Spine surface parity — API, CLI, GUI, MCP

Spine is one product with four surfaces: **GUI**, **CLI/TUI**, **HTTP API**, and **MCP**. They must not grow separate domain models. Conversion always goes through a **headless session** (`SpineSession`) plus **actions-as-data** and **ViewModels**. Pixels, argv, HTTP, and MCP tools are adapters.

This document is the map of what is already the same, how you convert between surfaces, remaining host gaps (Node `CodeHost`, Stripe, OAuth), and what MCP still needs to match the full UI.

**Button table:** §11 — every GUI control has a searchable `id` (`data-spine-id`) and a row for TUI, API, MCP, and the library (`SpineSession` / `useStore`). Catalog: `combined_full_stack/lib/core/parity-catalog.ts`. Test: `lib/core/parity-catalog.test.ts`.

Code roots:

| Layer | Path |
|---|---|
| Domain types | `combined_full_stack/lib/types.ts` → `lib/server/types.ts` |
| Headless session | `combined_full_stack/lib/core/` |
| HTTP API | `combined_full_stack/app/api/` + `lib/api-routes.ts` |
| GUI store | `combined_full_stack/lib/store.tsx` (`useStore`) |
| CLI | `combined_full_stack/lib/cli/` + `scripts/spine-cli.ts` |
| Ink TUI | `combined_full_stack/lib/cli/ink/` |
| MCP | `mcp_tool/` (stdio: session_action + Testing-tab pinpoint + Vibe ask/apply) |

---

## 1. What “parity” means

Parity is **not** “the Ink TUI looks like the React app.” It is:

1. **Same domain objects.** `Project`, `PipelineModule`, `StructureModel`, `DocRef`, `PipelineRun`, `ProjectProposal` are shared. CLI does not invent a second project JSON.
2. **Same method names.** `SpineSession.addProject` / `renameProject` / `applyProjectChanges` / `applyProposal` match `useStore()`. CLI `session` subcommands are those names with kebab-case flags.
3. **Same validators.** `computeInvalid`, `validateTestFile`, `findQuote`, `derivePipelineMermaid` are imported by GUI, CLI, and MCP — not reimplemented.
4. **Same apply path for the agent.** Vibe/Build GUI and `spine agent` both call `proposePipelineChange` and apply with the same `changed.*` deltas as `project-assistant.tsx`.
5. **Same realtime overlay rules.** Never drop local creates; never resurrect tombstones (`overlayOptimisticProjects` in `lib/core/realtime.ts`). GUI `store.tsx` and CLI `SpineSession.ingestRemoteProjects` share that function.
6. **Locality is orthogonal to renderer.** `local` work (validate, quotes, apply proposal JSON) must work `--offline`. `remote` work (LLM, `startRun`, billing) must fail closed when egress is blocked.

Three stores stay distinct on purpose:

| Store | Role | Must not |
|---|---|---|
| Client `StoreState` (`lib/store.tsx`) | UI session: hydration, debounce save, billing caches | Import Next/Ink; become the engine |
| Server `Store` (`lib/server/store.ts`) | Engine + DB: runs, cache, RLS | Import React |
| Headless `SpineSession` (`lib/core/session.ts`) | Vanilla subscribe/getSnapshot for CLI/TUI/MCP | Import React, Ink, or Next |

Conversion is always **surface → SpineSession (or the same named methods on `useStore`) → optional HTTP**. Never CLI-specific types into React, and never React components into CLI.

---

## 2. The four surfaces

### 2.1 GUI (React)

Entry: `app/page.tsx` → `components/app-shell-layout.tsx`.

**L0 primary:** Run (consumer) / Build / Billing / Settings.

**Build sub-surface:** Vibe (agent-first) vs editors.

**Editor windows** (`lib/app-window-id.ts`):

| `AppWindowId` | What it does | Typical HTTP |
|---|---|---|
| `structure` | Models, fields, type aliases, pydantic/zod preview, structure assistant | `PUT /api/projects/:id`, `POST /api/structure-assistant` |
| `pipeline` | Step graph, per-step fields, export bundle | `PUT /api/projects/:id`, `POST /api/pipeline-export/documents` |
| `testing` | `*_testing.json`, run tests, diffs, testing assistant | `POST /api/runs`, `POST /api/testing-assistant`, `POST /api/testing-evaluate` |
| `inference` | Assign docs per Input, `startRun`, human-review, chatbot, custom-code client step | `POST /api/runs`, `POST /api/runs/:id/client-step`, `.../chatbot-turn` |
| `share` | Shared links, marketplace, hosted APIs | `/api/shared-links`, `/api/marketplace`, `/api/hosted-apis` |
| `earnings` | Creator payouts | `/api/earnings` |
| `logging` | Run history, step traces, test verdicts, notes | `GET /api/runs`, `GET /api/runs/:id` |
| `cache` | Step cache inspect | `/api/cache` |
| `documents` | Upload, OCR/PDF layers, labels, project binding | `/api/docs` |
| `docs` | Project markdown (edit/preview/split) | `PUT /api/projects/:id` (`documentation`) |
| `project-billing` / `billing` | Credits, keys, Stripe | `/api/billing` |
| `project-settings` / `settings` | Account + developer tools | `/api/account` |
| `vibe` | Same project agent as Build dock | `POST /api/pipeline-assistant` (and chats) |

Assistants (four, not one):

| Assistant | Route | GUI host |
|---|---|---|
| Project / Vibe | `/api/pipeline-assistant`, `/api/project-assistant` | `components/project-assistant.tsx`, Vibe panel |
| Structure | `/api/structure-assistant` | Structure tab |
| Testing | `/api/testing-assistant` | Testing tab |
| Diagnosis | `/api/diagnosis-assistant` | Failed-run hub |

Persist: debounced `PUT /api/projects/:id` via `flushPendingSave`. Hydrate: streaming `GET /api/state`. Realtime: `useTeamRealtime` → channel `team-shared-pointers` on `projects`, `docs`, `runs`, `team_members` (400ms debounce).

Custom code **executes in the browser** (`lib/custom_code.ts` → `POST /api/runs/:id/client-step`). Server parses syntax and pauses; it does not run user TS/Python.

### 2.2 CLI

Entry: `npx tsx scripts/spine-cli.ts` (`npm run spine`). Ink TUI: `npm run spine:tui` (vite-node; tsx cannot load yoga-layout).

Dispatcher: `lib/cli/run.ts`. Result shape: `CliCommandResult` (`ok`, `command`, `issues[]`, `data`). `--json` for agents. Exit `0` ok, `1` validation, `2` usage.

**Direct commands (no session file):**

| Command | Same logic as |
|---|---|
| `validate project \| test \| tests \| setup` | Structure/Pipeline/Testing badges |
| `parse test` | Testing-tab parse |
| `profile landing` | Landing demo analytics (remote/DB) |

**Session commands** (`lib/cli/session_cli.ts`) — file persist `.spine-session.json` / `SPINE_SESSION_PATH`:

`list`, `add-project`, `open`, `rename`, `clone`, `delete`, `import-seed`, `seeds`, `set-docs`, `add-model`, `add-step`, `add-doc`, `docs`, `pipeline`, `mermaid`, `tests` (validate only), `logs`, `link-quotes`, `validate`, `snapshot`, `actions`.

**Agent commands** (`lib/cli/agent_cli.ts`):

`ask`, `apply`, `reject`, `history`, `apply-file`. `ask` calls `proposePipelineChange` (same as Vibe). `--offline` blocks ask. Apply is local.

**Ink TUI tabs** (`TUI_TABS` in `lib/core/view.ts`): `build`, `docs`, `tests`, `agent`, `logs`. Keys: `1–5` tabs, `n` new, `r` rename, `m` model, `s` step, `a` agent, `y` apply, `x` delete.

`--once` / non-TTY: `renderToString` one frame (CI). Interactive: Ink `render()`.

### 2.3 HTTP API

Canonical paths: `lib/api-routes.ts`. Auth via `requireAuthStore` except public shared-link / hosted-invoke / landing-demo / webhook.

Grouped by GUI tab (this **is** the conversion table GUI ↔ API):

| Area | Routes |
|---|---|
| Hydrate | `GET /api/state`, `GET /api/demo/state` |
| Projects | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id`, `POST /api/projects/resync-examples`, `GET /api/project-templates`, `GET/PUT /api/projects/:id/team` |
| Docs | `POST /api/docs`, `GET/DELETE /api/docs/:id`, text/file/content |
| Runs | `GET/POST /api/runs`, `GET /api/runs/:id`, progress, `client-step`, `chatbot-turn` |
| Cache | `GET /api/cache`, `GET /api/cache/:key` |
| Assistants | `pipeline-assistant`, `project-assistant`, `structure-assistant`, `testing-assistant`, `diagnosis-assistant`, `assistant-chats`, `pipeline-summary`, `testing-evaluate` |
| Share / consumer | `shared-links/*`, `marketplace/*`, `hosted-apis/*` (invoke/progress public) |
| Billing | `billing`, checkout, confirm, keys, webhook, `earnings` |
| Teams | `teams`, invite, members |
| Misc | `account`, `activity`, `session-replay`, `abtest`, `feedback`, `pipeline-export/documents`, landing-demo |

CLI today **does not** speak this HTTP surface except where it imports server libs in-process (`proposePipelineChange`, seed load). It does not `fetch /api/state` unless `SPINE_API_URL` is set (`session pull` / `start-run`).

### 2.4 MCP (Cursor / agents)

Entry: `.cursor/mcp.json` + `~/.cursor/mcp.json` → `mcp_tool/src/index.ts` (stdio JSON-RPC). Spawn must use **absolute** `node` + `tsx/cli.mjs` + `tsconfig.json` — Cursor starts the process from `$HOME` and ignores `cwd`. Handshake test: `mcp_tool/src/mcp-boot.test.ts`.

Two tool families on one server:

| Family | Input | Same logic as |
|---|---|---|
| Pinpoint / lint | `seeds/*.json` + run JSON | Testing tab (`compareRunToTest`, `computeInvalid`, `lintPipeline`) |
| Bar A session | `.spine-session.json` / `SPINE_SESSION_PATH` | CLI session + Vibe (`SpineSession`, `askAgent`, `workspace_edits`) |

MCP **shares functions** with the GUI. It does **not** share the GUI’s live store. Capability (every GUI action as a tool) is the goal; a live “eyes” view of React state is not. See §4.1.

---

## 3. Conversion hub (`lib/core`)

```
                    ┌─────────────────────────┐
                    │     SessionSnapshot      │
                    │  (projects, docs, runs,  │
                    │   chat, pendingProposal) │
                    └────────────┬────────────┘
                                 │
              SpineSession.getSnapshot / subscribe
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
  ViewModels               Actions (Zod)              Persist / Egress
  toPipelineView           addProject, …              PersistPort
  toValidationView         locality: local\|remote     EgressPort
  toAgentView              SESSION_ACTION_IDS          RealtimePort
        │                        │
        ├─ React pixels          ├─ CLI flags
        ├─ Ink pixels            ├─ MCP tools (`mcp_tool/src/index.ts`)
        └─ --json data           └─ HTTP body (egress from session)
```

### 3.1 Snapshot → pixels (GUI and TUI)

Renderers must not re-derive validity. They call ViewModels:

| ViewModel | GUI | CLI / TUI | MCP |
|---|---|---|---|
| `toPipelineView` | Pipeline list | `session pipeline`, TUI `build` | `describe_pipeline_steps` / `get_project` (summary only) |
| `toValidationView` | Red badges | `session validate` | `validate_project` |
| `toDocsView` | Docs tab (partial) | `session docs`, TUI `docs` | `set_docs` |
| `toTestingView` | Testing sidebar names | `session tests` list, TUI `tests` | `list_project_tests` / `session_logs.tests` |
| `toAgentView` | (GUI uses chat components) | `agent history`, TUI `agent` | `ask_agent` (no stream) |
| `toLogsView` | (GUI uses full Logging) | `session logs`, TUI `logs` | `session_logs` (ids/notes, not step JSON) |
| `toQuoteView` | Quote chips | `session link-quotes` | no MCP quote tool |
| `toMermaidView` | Pipeline mermaid | `session mermaid` | not exposed |
| `toSessionSummary` | — | `session list/snapshot` | `get_project` |

Ink `WorkspaceView` is presentational: only ViewModels + prompt state. `SpineTui` dispatches `session.*` on keys — same names as `useStore`.

### 3.2 Actions as data

`lib/core/actions.ts` — `id` is the React method name. Intended to feed CLI flags, MCP `session_action`, and HTTP without new identifiers.

Registered today: `addProject`, `renameProject`, `deleteProject`, `openProject`, `setDocumentation`, `validate`, `linkQuotes`, `ingestProject`, `applyProposal`, `askAgent` (stub: remote, throws if `run()`).

### 3.3 Ports

| Port | GUI | CLI / MCP |
|---|---|---|
| `PersistPort` | Debounced PUT project + GET state | `createFilePersist` → `.spine-session.json` |
| `EgressPort` | `fetch` to `/api/*` (cookies) | `createApiEgress(SPINE_API_URL, SPINE_API_TOKEN)` or thrower |
| `RealtimePort` | `useTeamRealtime` / `createSupabaseRealtimePort` | CLI can `attachRealtime`; MCP does not |

`--offline` injects throwing egress. Local commands must not touch it. `agent ask` is remote and is blocked.

### 3.4 Agent conversion (the important round-trip)

```
GUI Vibe/Build dock
  POST /api/pipeline-assistant  ──┐
                                  │  proposePipelineChange(project, message, history)
CLI  spine agent ask              │  (lib/server/pipeline_assistant.ts)
  in-process import  ─────────────┤
MCP  ask_agent                    │
  in-process import  ─────────────┘
                                  │
                                  ▼
                         PipelineAssistantProposal
                                  │
                    toProjectProposal()  (CLI/MCP)
                    applyProposal()      (GUI project-assistant.tsx
                                          and SpineSession.applyProposal)
                                  │
                         SessionSnapshot / StoreState
```

GUI path is **billed + authed** (`requireAuthStore("llm")`). CLI/MCP `ask` still import the assistant **in-process** (needs `OPENROUTER_API_KEY`, skips HTTP billing). TODO: route MCP/CLI ask through `POST /api/pipeline-assistant`.

Apply deltas (both surfaces):

- `changed.name` → `renameProject`
- `changed.models|modules|typeAliases` → `applyProjectChanges`
- `changed.documentation` → `setDocumentation`
- `changed.docs` → `addDocContent`
- `proposedActions` (`run_inference` | `run_test`) → GUI confirms and runs; CLI `agent apply --run` calls `executeProposedActions` (needs `SPINE_API_URL`)

`spine agent apply-file --file proposal.json` is the disk form of “Approve” in Vibe.

### 3.5 Realtime conversion

Same overlay:

```
remote projects  +  pendingCreates  −  deletedProjectIds
```

GUI: `store.tsx` imports `overlayOptimisticProjects` from `lib/core/realtime.ts`.  
CLI demo: `ingestRemoteProjects([])` must keep the local create; ingesting a deleted id must not resurrect it.

---

## 4. Conversion recipes

### GUI → API

`useStore` methods that persist or run:

| `useStore` | HTTP |
|---|---|
| hydrate | `GET /api/state?projectId=` |
| `addProject` / `cloneProject` / `cloneFromTemplate` | `POST /api/projects` (+ templates) |
| `patchProject` / `setModels` / `setModules` / `setDocumentation` / `applyProjectChanges` | `PUT /api/projects/:id` (debounced) |
| `deleteProject` | `DELETE /api/projects/:id` |
| `addDoc` / `addDocContent` | `POST /api/docs` |
| `removeDoc` / `setDocProjects` | `DELETE/PATCH /api/docs/:id` |
| Inference / Testing run | `POST /api/runs` then poll progress |
| Custom code pause | `POST /api/runs/:id/client-step` |
| Chatbot pause | `POST /api/runs/:id/chatbot-turn` |
| Approve Vibe proposal | local apply + optional `POST /api/runs` |
| Agent message | `POST /api/pipeline-assistant` (stream events) |

### CLI → session (no HTTP)

```
argv  →  runSpineCli  →  runSessionCommand / runAgentCommand
      →  createSpineSession({ persist: createFilePersist, egress? })
      →  session.addProject() …  // same names as useStore
      →  to*View(snapshot)  →  CliCommandResult.data
```

Ink is the same session with a different renderer. `tui --once` proves the ViewModel without a TTY.

### CLI → GUI

1. Mutate `.spine-session.json` via `spine session …`
2. GUI does **not** read that file today. To share one workspace: `session pull` / `session push` with `SPINE_API_URL` (cookie/API token) so CLI hits the same HTTP as the browser.

Reverse: `session pull` hydrates from `GET /api/state`. `session import-seed` still loads disk seeds.

### CLI → API

`EgressPort` (`createApiEgress`) against `SPINE_API_URL` + `SPINE_API_TOKEN`:

- `session pull` → `GET /api/state`
- `session push` → `PUT /api/projects/:id`
- `session start-run` / `run-test` → `POST /api/runs`
- `session billing` / `earnings` → `/api/billing` / `/api/earnings`

Agent propose still runs in-process (`proposePipelineChange`; needs `OPENROUTER_API_KEY`). `--offline` injects throwing egress (`blocked: true`).

### GUI → CLI

Anything that is **pure** on a `Project` is already shared: validate, mermaid, test-file parse, quotes. Export a seed-shaped JSON (or use `seeds/*.json`) and run:

```bash
npx tsx scripts/spine-cli.ts validate project seeds/batch_llm_example.json
npx tsx scripts/spine-cli.ts session import-seed --file batch_llm_example
npx tsx scripts/spine-cli.ts session mermaid
```

Live runs, cache, billing, share link **ids** have CLI wrappers (`start-run`, `cache`, `billing`, `share`). Minting Stripe/marketplace links stays GUI/HTTP.

### API → MCP (Bar A)

`mcp_tool` wraps Testing-tab functions on **seed paths + run JSON**, and Bar A reads `.spine-session.json`: `get_project`, `validate_project`, `apply_project_changes`, `ask_agent`, `start_run` / `run_test` (HTTP), `session_logs`, plus CRUD (`add_project`, `add_step`, `add_model`, `add_doc`, `session_action`).

### 4.1 Same actions, different store

**MCP should be able to do what a human can click.** It does not need to see the live GUI.

| | GUI | MCP |
|---|---|---|
| Project bytes | `useStore` ← `GET /api/state` (Supabase / JsonStore), cookies | `SpineSession` ← `.spine-session.json` |
| Mutations | `useStore` methods (not yet a thin wrap of `SpineSession`) | same **names** via `createSpineSession` + `workspace_edits` |
| Validators | `computeInvalid`, `validateTestFile`, `compareRunToTest` | **same imports** |
| Vibe | `POST /api/pipeline-assistant` (auth, billing, stream, observe tools, UI pins) | `askAgent` → in-process `proposePipelineChange` |
| Runs | `POST /api/runs` then poll until terminal; step JSON in Logging | `start_run` returns `{id, status}` immediately; `pinpoint_failure` needs a finished run JSON |
| Auth | Supabase cookie JWT | `SPINE_API_TOKEN` Bearer — **API does not read it** (`requireAuth()` is cookies only) |
| Agent playbook | on-screen tabs + buttons | MCP `instructions` + prompts `vibe_loop` / `fix_test` / `add_pipeline_step` |

The GUI **does not read** `.spine-session.json`. An MCP `apply_project_changes` is invisible in the browser until `session pull` / `session push` against a working authenticated HTTP API (or until `useStore` loads the file — it does not). That is a **capability** gap (pull/push not MCP tools), not a missing screenshot.

Three workspaces agents mix up:

1. `seeds/*.json` — pinpoint/lint (golden templates)
2. `.spine-session.json` — MCP/CLI session
3. Signed-in Supabase project — what the GUI shows

**Shared today:** types, `SpineSession` method names, `workspace_edits`, ViewModels (`toValidationView` etc.), Testing-tab compare/lint, `proposePipelineChange` source, overlay helper (`overlayOptimisticProjects`).

**Not shared:** the live project document, cookie session, billed assistant HTTP, run polling, UI context pins, chat store, realtime.

### GUI → MCP

```
Cursor agent
  → MCP tool (get_project / ask_agent / apply / validate / run_test / pinpoint)
  → createSpineSession({ persist: file, egress?: API })
  → same SpineSession methods as CLI
```

To make MCP **the same project as the GUI**: `session pull` from `GET /api/state` (needs an auth path the API accepts) then mutate and `session push` (`PUT /api/projects/:id`). Those pull/push verbs exist on CLI/`SpineSession`; they are **not MCP tools yet**.

---

## 5. Capability matrix

Legend: **Y** = same capability, **P** = partial (list/validate/stub), **N** = missing. GUI is the reference.

| Capability | GUI | HTTP API | CLI session/TUI | MCP |
|---|---|---|---|---|
| List/select/rename/delete/clone projects | Y | Y | Y | Y (`get_project` handle + CRUD; full graph dump not required) |
| Blank project | Y | Y | Y | Y `add_project` |
| Clone built-in seeds | Y (`cloneFromTemplate`) | Y templates | Y (`import-seed` / ingest) | Y `import_seed` |
| Structure field CRUD, aliases, pydantic | Y | via project PUT | Y (`add-field` / `add-alias` / `pydantic`) | P (`session_action` add-field; seed `export_pydantic`; no session describe tool yet) |
| Structure assistant | Y | Y | Y (`agent structure`) | P `ask_agent kind=structure` (in-process, not HTTP) |
| Pipeline add step | Y | via PUT | Y (`add-step`) | Y `add_step` |
| Pipeline per-step fields / reorder / export | Y | Y export | Y (`patch-step` / `move-step` / `pydantic`) | P `session_action` configure/assign; no move-step |
| Docs markdown | Y (edit/preview/split) | Y | P (set text / preview slice) | P `set_docs` (no preview) |
| Documents upload, OCR, PDF, labels | Y | Y | P (text `add-doc` / `--file`) | P `add_doc` text only |
| Link quotes (local offsets) | Y | server step + local `findQuote` | Y | N |
| Validate pipeline / structures | Y | implicit on run | Y | Y |
| Testing file validate | Y | — | Y | Y |
| Testing **run** + diffs + LLM judge | Y | Y runs + `testing-evaluate` | P (`run-test` HTTP; diffs via pinpoint MCP) | P `run_test` no wait; pinpoint vs seed+run JSON |
| Inference `startRun` + input assignment | Y | Y | Y (`assign-input` / `start-run`) | P `assign_input` / `start_run` (no poll) |
| Custom code (browser host) | Y | pause + client-step | N (no Node `CodeHost`; action registered) | N |
| Human review / chatbot pauses | Y | Y | N (action registered; GUI pause) | N |
| Logging traces / notes / Langfuse | Y | Y | Y (ViewModel: notes, test, langfuse, steps) | P `session_logs` (no step outputs) |
| Cache inspect | Y | Y | Y (local snapshot / pull) | P `session_logs` |
| Share / marketplace / hosted APIs | Y | Y | P (list ids; mint is HTTP/GUI) | N mint; list ids after pull [P] |
| Earnings / billing / Stripe / keys | Y | Y | P (HTTP refresh; no Stripe TUI) | P refresh via `session_action`; no Stripe |
| Settings / sign-in / teams | Y | Y | P (model / saveError; no OAuth) | N (Bearer token unused by API) |
| Consumer Run mode | Y | shared-link APIs | N | N |
| Vibe / project agent propose+apply | Y | Y | Y (`agent ask/apply`) | P `ask_agent` + `apply_project_changes` (in-process ask) |
| Agent streaming + observe tools + billing | Y | Y | P (no stream/store/catalog) | N |
| Structure / testing / diagnosis agents | Y | Y | Y | P `ask_agent kind=` (in-process) |
| Execute `proposedActions` runs | Y | Y | Y (`--run` + `SPINE_API_URL`) | via `start_run` (no wait) |
| Supabase persist | Y | Y | P (JSON file + `pull`/`push`) | session file; pull/push not MCP tools |
| Realtime overlay | Y | DB + channel | P (TUI attaches when Supabase env set) | N |
| Strategies / A-B | Y | `/api/abtest` | P (`setStrategies` on session) | N |
| `--offline` local-only | N/A | N/A | Y | P (offline flag on `openMcpSession`; not a tool) |

---

## 6. Locality

| Kind | Examples | `--offline` |
|---|---|---|
| `local` | validate, quotes, apply proposal JSON, add-model, mermaid, session CRUD | must succeed |
| `remote` | `agent ask`, `startRun`, billing, assistants, docs upload to Storage | must fail |
| `local-first` | (planned) optimistic project create then confirm via GET state | — |

Quote offsets are **local**: `findQuote` is pure math. The GUI “Link Quotes” **step** also runs in the server engine; the CLI command is the local function only.

Custom code: **local to the browser**, not to Node CLI. Source still goes to the server. CLI cannot finish those pipelines until a Node `CodeHost` exists.

---

## 7. Identifier alignment (do not fork names)

| Concept | GUI | CLI | API | MCP |
|---|---|---|---|---|
| Create project | `addProject` | `session add-project` | `POST /api/projects` | `add_project` |
| Open | `setActiveProjectId` / `openProject` | `session open` | `GET /api/state?projectId=` | `open_project` |
| Patch graph | `applyProjectChanges` | `add-model` / `add-step` / agent apply | `PUT /api/projects/:id` | `apply_project_changes` / `add_step` |
| Docs markdown | `setDocumentation` | `session set-docs` | same PUT | `set_docs` |
| Validate | badges | `session validate` | (engine) | `validate_project` |
| Quotes | quote UI | `session link-quotes` | quote step in run | none |
| Agent ask | Vibe send | `agent ask --message` | `POST /api/pipeline-assistant` | `ask_agent` (in-process) |
| Agent approve | Approve button | `agent apply` | local + optional run | `apply_project_changes` |
| Tabs | `AppWindowId` | `TUI_TABS` | n/a | no window; tools by concern |

When adding a feature, add the `SpineSession` method **and** a `defineAction` id **before** a new CLI verb or MCP tool.

---

## 8. TODOs

Remaining gaps are **browser-only hosts** and **marketplace/Stripe UX**, not missing session methods. Capability matrix in §5.

### 8.1 Hub (`lib/core`) — done

- [x] `SessionSnapshot` includes `modelOptions`, billing/earnings, cache, share/hosted-api ids, `docProjectIds`.
- [x] `SpineSession` methods matching `useStore` names: `cloneFromTemplate`, `addDoc`, `setDocProjects`, `addRun`, `updateRunNotes` / `updateRunTest`, `hydrateRunDetail`, `startRun` / `runTest`, `flushPendingSave`, `refreshBilling` / `refreshEarnings`, `setStrategies`, `pullRemoteState`, `executeProposedActions`.
- [x] Execute `proposedActions` after apply (`agent apply --run` / `ask --apply --run`).
- [x] TUI `attachCliRealtime` when Supabase env is set.
- [x] Actions registered: `startRun`, `runTest`, `addDoc`, `exportPipeline`, `shareLink`, `hostedApi`, `billing`, `cacheGet`, `humanReview`, `customCode`. `askAgent.run` calls `registerAskAgent`.

### 8.2 CLI / TUI — done except browser hosts

- [x] TUI tabs aligned with `AppWindowId` (`structure` … `vibe`; aliases `build`/`agent`/`tests`/`logs`).
- [x] Structure field CRUD, type aliases, pydantic preview.
- [x] Pipeline patch / reorder / delete.
- [x] Docs markdown preview slice; documents via `add-doc --file` (no OCR/PDF).
- [x] `session tests` validates; `session run-test` / `--run` hits HTTP.
- [x] Inference: `assign-input`, `start-run`.
- [x] Logging ViewModel: traces count, notes, Langfuse, test verdicts.
- [ ] Node `CodeHost` for custom-code / assert (GUI is browser). Action `customCode` fails closed.
- [ ] Human-review and chatbot elicitation in CLI. Action `humanReview` fails closed.
- [x] Four assistants: `agent ask --assistant vibe|structure|testing|diagnosis`.
- [x] `session pull` / `session push` against HTTP (`SPINE_API_URL`).
- [ ] Sign-in / teams / Stripe TUI (HTTP wrappers only).
- [x] Demo walkthrough: structure field, assign-input, cache, share, billing snapshot.

### 8.3 HTTP API used from CLI — done

- [x] Authenticated `EgressPort` (`SPINE_API_TOKEN` bearer).
- [x] CLI wrappers for `/api/state`, `/api/runs`, `/api/billing` (and earnings). Cache/share list from snapshot after pull.
- [ ] Do not bypass billing when CLI calls `proposePipelineChange` in-process (still skips `requireAuthStore`).

### 8.4 MCP — Bar A vs full-UI (Bar B)

**Boot (done 14 Aug 2026):** stdio handshake works. Enums import from `@/lib/server/types` (tsx drops `export *` values). Cursor spawn uses absolute `node` + `tsx/cli.mjs` + `tsconfig` (process cwd is `$HOME`). Stdout is JSON-RPC only (`DOTENV_CONFIG_QUIET`, bootstrap filter). Test: `mcp_tool/src/mcp-boot.test.ts`.

**Bar A (replace Vibe on one session file)** — tools exist; not GUI-equivalent yet:

- [x] `get_project` / `validate_project` / CRUD / `ask_agent` / `apply_project_changes` / `start_run` / `run_test` / `session_logs` / pinpoint+lint.
- [x] MCP `instructions` + prompts `vibe_loop` / `fix_test` / `add_pipeline_step` (agents: session vs seed, named tools vs `session_action`).
- [ ] Wrap remaining `SpineSession` verbs as MCP (`mcp-capability`): `pullRemoteState`, `flushPendingSave`, `hydrateRunDetail`, `removeDoc`, `linkQuotes`, `setDocProjects`, `executeProposedActions`, `resyncExamples`. `get_project` stays a handle — do not dump the graph for “eyes”.
- [ ] One project handle: MCP pull/push vs seeds vs GUI Supabase (`mcp-workspace`).
- [ ] `ask_agent` via `POST /api/pipeline-assistant` (billed + auth), not in-process (`mcp-vibe-http`).
- [ ] `wait_for_run` + `get_run` (step outputs) so pinpoint can run on session runs (`mcp-run-loop`).
- [ ] Auth the API accepts: cookie/JWT/PAT in `requireAuth()` (`mcp-auth`). `auth_status` tool (`mcp-auth-tool`).
- [ ] Shrink tool list; structured `{ ok, code, next }` errors (`mcp-tools`, `mcp-errors`).

**Bar B (whole app)** — host-bound or mint HTTP; not started as MCP:

- marketplace / hosted API / embed mint, Stripe checkout + keys, teams invite
- Node `CodeHost` (custom-code / assert)
- human-review + chatbot pause
- OCR/PDF documents, consumer Run, UI select-mode pins, assistant chat store, realtime

**What “MCP = full UI” actually requires (order):**

1. Same **actions**: every GUI `data-spine-id` that is a `SpineSession` method is an MCP tool or `session_action` (see `mcp-capability` TODOs).
2. Same project when the human is signed in: MCP `pull`/`push` **and** an auth header `requireAuth()` honors.
3. Same remote path: billed HTTP assistant + polled runs + pinpoint on that run.
4. Then host ports: CodeHost, human-review, Stripe — or keep those GUI-only forever.

A live view of React state is explicitly **not** required.

Pinpoint stays the Testing-tab specialist; Bar A is the session/Vibe path. They must not stay two sources of truth.

### 8.5 GUI using core (convergence)

- [x] Overlay is shared (`overlayOptimisticProjects`). Method names on `useStore` match `SpineSession`.
- [ ] Thin `useStore` so every mutation goes through `SpineSession` (React still owns hydration/debounce/billing caches).
- [ ] React pipeline/docs panels consuming `toPipelineView` / `toDocsView` so CLI and GUI cannot drift.

---

## 9. How to verify parity

```bash
cd combined_full_stack
npm test -- lib/core lib/cli          # session, overlay, CLI, Ink renderToString, button catalog
npm test -- lib/core/parity-catalog.test.ts
cd ../mcp_tool && npm test            # Bar A session tools + stdio handshake
cd ../combined_full_stack
npm run spine -- session actions      # action ids == useStore names
npm run spine -- demo                 # CRUD + overlay + quotes, egress 0
npm run spine -- tui --once           # ViewModel frame
npm run spine -- agent ask --offline --message "x"   # must fail (remote)
```

A feature is at parity when:

1. It has a `SpineSession` method (or a documented remote action).
2. GUI and CLI both call that method (GUI may wrap HTTP around it).
3. A ViewModel exists if anything is rendered.
4. `--offline` behavior matches locality.
5. Remaining N in §5 are host-bound (browser CodeHost, Stripe, OAuth), not missing session methods.

---

## 10. File checklist (conversion map)

| From | To | File |
|---|---|---|
| Snapshot | views | `lib/core/view.ts` |
| Named mutations | session | `lib/core/session.ts` |
| Action registry | CLI/MCP | `lib/core/actions.ts` |
| Overlay | GUI+CLI | `lib/core/realtime.ts` |
| Offline | CLI flags | `lib/core/transport.ts` |
| HTTP paths | GUI | `lib/api-routes.ts` |
| GUI session | pixels | `lib/store.tsx` + `components/*` |
| CLI argv | session | `lib/cli/session_cli.ts`, `agent_cli.ts`, `run.ts` |
| Session | Ink | `lib/cli/ink/app.tsx` → `workspace-view.tsx` |
| Agent propose | GUI HTTP; CLI/MCP in-process | `lib/server/pipeline_assistant.ts` |
| MCP stdio | Cursor | `mcp_tool/src/index.ts` + `.cursor/mcp.json` |
| Agent apply | both | `session.applyProposal` / `project-assistant.tsx` |
| Button ids | GUI+TUI+API+MCP | `lib/core/parity-catalog.ts` (`data-spine-id`) |

---

## 11. Button catalog (GUI / TUI / API / MCP / library)

Source of truth: `combined_full_stack/lib/core/parity-catalog.ts`. Each `id` is the searchable name:

- GUI: `data-spine-id="<id>"` / `spineId="<id>"` on the button
- TUI: Ink hotkey or `spine session …` / `spine agent …`
- API: HTTP route
- MCP: tool name, or `session_action` with the same `id`
- Library: `SpineSession` / `useStore` method (same names)

Status suffixes in cells: **[P]** partial, **[N]** missing, **[host]** browser-only, **[n/a]** not an action on that surface.

Grep an id (example): `rg 'project.add' combined_full_stack docs mcp_tool`.

| id | GUI | TUI | API | MCP | Library |
|---|---|---|---|---|---|
| `nav.run` | Run | Ink: press 5 (share tab) | GET /api/shared-links + marketplace | session_logs lists share ids after pull [P] | setActiveWindow('share') / SpineSession snapshot.shareLinkIds |
| `nav.build` | Build | Ink: press 2 (pipeline) | GET /api/state?projectId= | get_project | session.openProject(id) |
| `nav.billing` | Billing | Ink: press b | GET /api/billing | session_action id=nav.billing → refreshBilling [P] | session.refreshBilling() |
| `nav.settings` | Settings | Ink: press , | GET /api/account | session_action id=nav.settings → settings snapshot [P] | session.getSnapshot() + setModel |
| `nav.build.vibe` | Vibe | Ink: press a (ask vibe) or tab-vibe | POST /api/pipeline-assistant | session_action id=nav.build.vibe → get_project | session.getSnapshot() / setActiveWindow vibe |
| `nav.build.editors` | dev | Ink: press 1–4 for structure/pipeline/testing/inference | PUT /api/projects/:id | session_action id=nav.build.editors → get_project | session.getSnapshot() / setActiveWindow editors |
| `nav.window.structure` | Structures | Ink: press 1 | PUT /api/projects/:id (models) | validate_project + describe_pipeline_steps | session.setModels / addNamedModel |
| `nav.window.pipeline` | Pipeline | Ink: press 2 | PUT /api/projects/:id (modules) | describe_pipeline_steps | session.setModules / addPipelineStep |
| `nav.window.testing` | Testing | Ink: press 3 | POST /api/runs (testing) + POST /api/testing-evaluate | run_test / validate_test | session.runTest(testDocName) |
| `nav.window.inference` | Inference | Ink: press 4 | POST /api/runs | start_run | session.startRun() |
| `nav.window.share` | Share | Ink: press 5 | POST /api/shared-links | session_action lists shareLinkIds [P] | session.getSnapshot().shareLinkIds |
| `nav.window.earnings` | Earnings | Ink: press 6 | GET /api/earnings | session_action id=earnings.refresh [P] | session.refreshEarnings() |
| `nav.window.logging` | Logging | Ink: press 7 | GET /api/runs | session_logs | toLogsView(session.getSnapshot()) |
| `nav.window.cache` | Cache | Ink: press 8 | GET /api/cache | session_logs.cache [P] | session.getSnapshot().cacheEntries |
| `nav.window.documents` | Documents | Ink: press 9 | POST /api/docs | add_doc | session.addDoc / addDocContent |
| `nav.window.docs` | Docs | Ink: press 0 | PUT /api/projects/:id documentation | set_docs | session.setDocumentation(text) |
| `nav.window.project-billing` | Billing | Ink: press b (account billing; same HTTP) | GET /api/billing | session_action id=billing.refresh [P] | session.refreshBilling() |
| `nav.window.project-settings` | Settings | Ink: press , | PUT /api/projects/:id (langfuse etc.) | session_action + apply_project_changes [P] | session.patchProject |
| `project.add` | New project / Blank project | Ink: press n or / new | POST /api/projects | add_project | session.addProject({ open: true }) |
| `project.browse-all` | All projects… | Ink: ↑↓ in project pane; spine session list | GET /api/projects + GET /api/state | get_project after session list | session.projects / openProject |
| `project.rename` | Rename project | Ink: press r | PUT /api/projects/:id name | rename_project | session.renameProject(id, name) |
| `project.delete` | Delete project | Ink: press x | DELETE /api/projects/:id | delete_project | session.deleteProject(id) |
| `project.open` | Open | Ink: enter on selected project / session open | GET /api/state?projectId= | open_project | session.openProject(id) |
| `project.clone` | Clone project | spine session clone [id] | POST /api/projects (clone body) | clone_project | session.cloneProject(id) |
| `project.clone-template` | Clone (template) | spine session import-seed --file <id> | GET /api/project-templates then POST /api/projects | import_seed | session.cloneFromTemplate / ingestProject |
| `project.resync-examples` | Refresh example documents | no TUI key — HTTP only [P] | POST /api/projects/resync-examples | not exposed; use HTTP [N] | session.resyncExamples() |
| `structure.add-model` | Add struct | Ink: press m | PUT /api/projects/:id models | add_model | addNamedModel(session, name) |
| `structure.add-field` | Add field | spine session add-field --model --name --type | PUT /api/projects/:id | session_action id=structure.add-field | addModelField(session, model, name, type) |
| `structure.remove-field` | Remove field | spine session remove-field --model --name | PUT /api/projects/:id | session_action id=structure.remove-field | removeModelField(session, model, name) |
| `structure.mark-optional` | Mark optional / required | add-field --optional; no toggle command yet [P] | PUT /api/projects/:id field.optional | apply_project_changes with models[] [P] | session.applyProjectChanges({ models }) |
| `structure.add-alias` | Add type alias | spine session add-alias --name --expr | PUT /api/projects/:id typeAliases | session_action id=structure.add-alias | addTypeAlias(session, name, expr) |
| `structure.export-pydantic` | Pydantic preview | spine session pydantic | local export (no extra HTTP) | export_pydantic | exportSessionPydantic(session) |
| `pipeline.add-step` | Add step | Ink: press s | PUT /api/projects/:id modules | add_step | addPipelineStep(session, kind, label) |
| `pipeline.configure-step` | Configure step | Ink: press e | PUT /api/projects/:id | session_action id=pipeline.configure-step | patchStep(session, id, { prompt, label, note }) |
| `pipeline.remove-step` | Remove step | Ink: edit-step → remove / session remove-step | PUT /api/projects/:id | session_action id=pipeline.remove-step | removeStep(session, id) |
| `pipeline.assign-structure` | Assign structure | Ink: e → structure / session assign-structure | PUT /api/projects/:id | session_action id=pipeline.assign-structure | assignStepStructure(session, step, model) |
| `pipeline.export` | Export code | spine session pydantic (models); full bundle is HTTP | POST /api/pipeline-export/documents | export_pydantic (models only) | exportSessionPydantic(session) / exportPipeline |
| `pipeline.validate` | Validation badges | spine session validate | engine-side on run [n/a] | validate_project / validate_pipeline_wiring | session.validation() / toValidationView |
| `testing.new-file` | New test file | add-doc with *_testing.json name [P] | POST /api/docs (name *_testing.json) | add_doc name=foo_testing.json | session.addDocContent({ name: '*_testing.json', … }) |
| `testing.run` | Run test | Ink: press t | POST /api/runs source=testing | run_test | session.runTest(testDocName) |
| `testing.stop` | Stop | no TUI cancel yet [N] | client aborts poll; no dedicated cancel route [P] | no MCP cancel [N] | browser AbortController / run registry [host] |
| `testing.pinpoint` | Isolated error / first diverging step | session tests validates; diffs via MCP [P] | POST /api/testing-evaluate | pinpoint_failure / compare_run_to_test | compareRunToTest / validateTestFile (shared lib) |
| `inference.assign-input` | Assign document to Input slot | spine session assign-input --module --doc | POST /api/runs body.inputDocsByModule | assign_input | session.setInferenceInputDocIds({ [moduleId]: docId }) |
| `inference.start-run` | Run | Ink: press i | POST /api/runs | start_run | session.startRun() |
| `inference.stop` | Stop | no TUI cancel yet [N] | client aborts poll [P] | no MCP cancel [N] | browser AbortController [host] |
| `inference.human-review.approve` | Approve (human review) | GUI pause — TUI has no elicitation [host] | POST /api/runs/:id/client-step | humanReview action fails closed [N] | session humanReview throws — browser CodeHost/pause [host] |
| `inference.human-review.reject` | Reject (human review) | GUI pause [host] | POST /api/runs/:id/client-step (rejected) | humanReview action fails closed [N] | browser pause UI [host] |
| `inference.chatbot.send` | Send (chatbot step) | GUI chatbot pause [host] | POST /api/runs/:id/chatbot-turn | no MCP chatbot turn [N] | browser ChatInput → chatbot-turn [host] |
| `inference.apply-setup` | Apply to run | assign-input per slot; no *_setup.json TUI editor [P] | POST /api/docs + run body | assign_input per module [P] | session.setInferenceInputDocIds |
| `inference.custom-code` | Run custom code (client step) | browser CodeHost [host] | POST /api/runs/:id/client-step | customCode action fails closed [N] | customCode action — lib/custom_code.ts in the browser [host] |
| `documents.upload` | Browse files / drag-drop | session add-doc --file (text only, no OCR/PDF) [P] | POST /api/docs | add_doc (text content) | session.addDoc / addDocContent |
| `documents.remove` | Delete document | CLI remove-doc not wired [N] | DELETE /api/docs/:id | not in Bar A [N] | session.removeDoc(id) |
| `documents.open` | Open document viewer | session docs lists names [P] | GET /api/docs/:id/text | get_project does not return doc bodies [P] | session.docs + docContents |
| `docs.set` | Edit project markdown | Ink: press w | PUT /api/projects/:id documentation | set_docs | session.setDocumentation(text) |
| `quotes.link` | Quote as context / link quotes | spine session link-quotes --quote --doc | quote step in run engine; offsets are local [P] | no MCP quote tool [N] | session.linkQuotes({ quote, sourceText, docId }) |
| `logging.errors-only` | Errors only | Ink: press f | GET /api/runs (filter client-side) | session_action id=logging.errors-only | toLogsView → runs with hasErrors |
| `logging.hydrate` | Load run detail | session pull hydrates; no per-run TUI hydrate [P] | GET /api/runs/:id | session_logs local only [P] | session.hydrateRunDetail(runId) |
| `logging.compare` | Compare runs | no TUI compare [N] | GET /api/runs/:id × 2 | compare_run_to_test (run vs test file) | no session.compareRuns [P] |
| `logging.copy-error` | Copy isolated error | JSON --json on session logs [P] | clipboard is GUI [n/a] | pinpoint_failure.isolatedText | formatTestFailuresForClipboard |
| `jobs.stop` | Stop job | no TUI job hub cancel [N] | abort client poll [P] | no MCP [N] | useCancellableRunRegistry in the browser [host] |
| `jobs.close` | Close jobs hub | TUI has no hub overlay [n/a] | UI chrome [n/a] | UI chrome [n/a] | React overlay state [n/a] |
| `cache.refresh` | Refresh cache | spine session cache (after pull) | GET /api/cache | session_logs.cache [P] | session.setCacheEntries / snapshot.cacheEntries / cacheGet |
| `share.tab.link` | Link | session share lists ids; mint is HTTP [P] | POST /api/shared-links | mint not in MCP [N] | snapshot.shareLinkIds after pull [P] |
| `share.tab.api` | API | session share lists hostedApiIds [P] | POST /api/hosted-apis | mint not in MCP [N] | snapshot.hostedApiIds [P] |
| `share.tab.embed` | Embed | no TUI embed mint [N] | POST /api/shared-links (embed/origin allowlist) | not in MCP [N] | GUI share-embed-form [host] |
| `share.create-link` | Create link | session share lists; mint HTTP/GUI [P] | POST /api/shared-links | Bar B [N] | shareLink action lists ids only [P] |
| `share.deploy-api` | Deploy API | session share lists hosted APIs [P] | POST /api/hosted-apis | Bar B [N] | hostedApi action lists ids only [P] |
| `share.create-embed` | Create website embed | no TUI [N] | POST /api/shared-links (emb_ rows) | Bar B [N] | GUI only [host] |
| `share.marketplace-publish` | Share to marketplace | no TUI mint [N] | POST /api/marketplace | Bar B [N] | GUI / HTTP [host] |
| `share.marketplace-clone` | Clone listing | session import-seed for bundled examples | POST /api/marketplace/:id/clone | import_seed (seeds) / clone_project | session.cloneFromTemplate |
| `share.run-shared` | Run shared link | consumer Run is GUI/HTTP [N] | POST /api/shared-links/:id/run | not in MCP [N] | consumer GUI [host] |
| `earnings.withdraw` | Move to LLM credit | no Stripe/withdraw TUI [host] | POST /api/earnings/withdraw | Bar B [N] | HTTP from GUI [host] |
| `earnings.refresh` | Refresh | spine session earnings | GET /api/earnings | session_action id=earnings.refresh | session.refreshEarnings() |
| `billing.topup` | Top up | Stripe Checkout — no TUI [host] | POST /api/billing/checkout | Bar B [N] | redirectToCheckout in the browser [host] |
| `billing.subscribe` | Subscribe | Stripe Checkout [host] | POST /api/billing/checkout | Bar B [N] | browser Stripe [host] |
| `billing.create-key` | Create key | no TUI key mint [host] | POST /api/billing/keys | Bar B [N] | GUI [host] |
| `billing.refresh` | Refresh billing | spine session billing | GET /api/billing | session_action id=billing.refresh | session.refreshBilling() |
| `settings.sign-out` | Sign out | no OAuth TUI [host] | Supabase auth signOut (not /api/* catalog) | no MCP auth [N] | browser session [host] |
| `settings.invite-member` | Invite teammate | no teams TUI [host] | POST /api/teams/:id/invite | Bar B [N] | GUI [host] |
| `settings.accept-invite` | Accept invite | no teams TUI [host] | POST /api/teams/invites/accept | Bar B [N] | GUI [host] |
| `settings.remove-member` | Remove member | no teams TUI [host] | DELETE /api/teams/:teamId/members/:userId | Bar B [N] | GUI [host] |
| `settings.set-model` | Default model | spine session set-model --model | PUT /api/projects/:id + account prefs | session_action id=settings.set-model | session.setModel(id) |
| `assistant.send` | Send (agent chat) | Ink: press a then type / spine agent ask --message | POST /api/pipeline-assistant (also structure/testing/diagnosis) | ask_agent | askAgent(session, message, { kind }) |
| `assistant.approve` | Approve | Ink: press y | local apply + optional POST /api/runs | session_action id=assistant.approve (pending or proposalJson) | session.applyProposal / applyPendingProposal() |
| `assistant.reject` | Reject | Ink: press d | local only [n/a] | session_action id=assistant.reject | session.rejectPendingProposal() |
| `assistant.new-chat` | New agent | TUI is single pending proposal [P] | POST /api/assistant-chats | no MCP chat store [N] | session.appendChat / setPendingProposal(null) [P] |
| `assistant.select-ui` | Select UI for agent | GUI select-mode overlay [n/a] | pins ride on assistant POST body [n/a] | no MCP UI pins [N] | ui-context-dom in the browser [host] |
| `feedback.submit` | Send feedback | no TUI feedback [N] | POST /api/feedback | not in MCP [N] | GUI [host] |
| `chrome.dialog-close` | Close | Ink: esc / q to quit prompts | UI chrome [n/a] | UI chrome [n/a] | React overlay [n/a] |
| `chrome.copy` | Copy | --json prints to stdout [P] | clipboard is GUI [n/a] | MCP tools return JSON text [P] | navigator.clipboard [n/a] |
| `chrome.pager-prev` | Previous item | Ink: ↑ in run/step lists | UI chrome [n/a] | UI chrome [n/a] | React pager state [n/a] |
| `chrome.pager-next` | Next item | Ink: ↓ in run/step lists | UI chrome [n/a] | UI chrome [n/a] | React pager state [n/a] |
| `auth.sign-in` | Sign in | no OAuth TUI [host] | Supabase auth (cookie) then GET /api/state | use SPINE_API_TOKEN instead [N] | browser auth [host] |
| `auth.sign-up` | Sign up | no OAuth TUI [host] | Supabase signUp | no MCP signup [N] | browser auth [host] |
| `tui.quit` | Quit TUI (no GUI button — Ink q) | Ink: press q | process exit [n/a] | stdio MCP stays up [n/a] | Ink useApp().exit() [n/a] |
