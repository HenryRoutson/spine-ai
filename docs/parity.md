# Spine surface parity — API, CLI, GUI

Spine is one product with three human/agent surfaces. They must not grow separate domain models. Conversion always goes through a **headless session** (`SpineSession`) plus **actions-as-data** and **ViewModels**. Pixels, argv, and HTTP are adapters.

This document is the map of what is already the same, how you convert between surfaces, and remaining host gaps (Node `CodeHost`, Stripe TUI, thin `useStore`).

Code roots:

| Layer | Path |
|---|---|
| Domain types | `combined_full_stack/lib/types.ts` → `lib/server/types.ts` |
| Headless session | `combined_full_stack/lib/core/` |
| HTTP API | `combined_full_stack/app/api/` + `lib/api-routes.ts` |
| GUI store | `combined_full_stack/lib/store.tsx` (`useStore`) |
| CLI | `combined_full_stack/lib/cli/` + `scripts/spine-cli.ts` |
| Ink TUI | `combined_full_stack/lib/cli/ink/` |
| Pinpoint MCP | `mcp_tool/` (Testing-tab logic only — not a full third store) |

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

## 2. The three surfaces

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

CLI today **does not** speak this HTTP surface except where it imports server libs in-process (`proposePipelineChange`, seed load). It does not `fetch /api/state`.

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
        ├─ Ink pixels            ├─ MCP tools (planned)
        └─ --json data           └─ HTTP body (planned)
```

### 3.1 Snapshot → pixels (GUI and TUI)

Renderers must not re-derive validity. They call ViewModels:

| ViewModel | GUI | CLI / TUI |
|---|---|---|
| `toPipelineView` | Pipeline list | `session pipeline`, TUI `build` |
| `toValidationView` | Red badges | `session validate` |
| `toDocsView` | Docs tab (partial) | `session docs`, TUI `docs` |
| `toTestingView` | Testing sidebar names | `session tests` list, TUI `tests` |
| `toAgentView` | (GUI uses chat components) | `agent history`, TUI `agent` |
| `toLogsView` | (GUI uses full Logging) | `session logs`, TUI `logs` |
| `toQuoteView` | Quote chips | `session link-quotes` |
| `toMermaidView` | Pipeline mermaid | `session mermaid` |
| `toSessionSummary` | — | `session list/snapshot` |

Ink `WorkspaceView` is presentational: only ViewModels + prompt state. `SpineTui` dispatches `session.*` on keys — same names as `useStore`.

### 3.2 Actions as data

`lib/core/actions.ts` — `id` is the React method name. Intended to feed CLI flags, MCP tools, and HTTP without new identifiers.

Registered today: `addProject`, `renameProject`, `deleteProject`, `openProject`, `setDocumentation`, `validate`, `linkQuotes`, `ingestProject`, `applyProposal`, `askAgent` (stub: remote, throws if `run()`).

### 3.3 Ports

| Port | GUI | CLI |
|---|---|---|
| `PersistPort` | Debounced PUT project + GET state | `createFilePersist` → `.spine-session.json` |
| `EgressPort` | `fetch` to `/api/*` | unset, or `createThrowingEgress()` when `--offline` |
| `RealtimePort` | `useTeamRealtime` / `createSupabaseRealtimePort` | `attachRealtime` exists; CLI never connects Supabase |

`--offline` injects throwing egress. Local commands must not touch it. `agent ask` is remote and is blocked.

### 3.4 Agent conversion (the important round-trip)

```
GUI Vibe/Build dock
  POST /api/pipeline-assistant  ──┐
                                  │  proposePipelineChange(project, message, history)
CLI  spine agent ask              │  (lib/server/pipeline_assistant.ts)
  in-process import  ─────────────┘
                                  │
                                  ▼
                         PipelineAssistantProposal
                                  │
                    toProjectProposal()  (CLI)
                    applyProposal()      (GUI project-assistant.tsx
                                          and SpineSession.applyProposal)
                                  │
                         SessionSnapshot / StoreState
```

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

`mcp_tool` still wraps Testing-tab functions on **seed paths + run JSON**. Bar A also reads `.spine-session.json`: `get_project`, `validate_project`, `apply_project_changes`, `start_run` / `run_test` (HTTP), `session_logs`.

---

## 5. Capability matrix

Legend: **Y** = same capability, **P** = partial (list/validate/stub), **N** = missing. GUI is the reference.

| Capability | GUI | HTTP API | CLI session/TUI | MCP pinpoint |
|---|---|---|---|---|
| List/select/rename/delete/clone projects | Y | Y | Y | P (`get_project`) |
| Blank project | Y | Y | Y | N |
| Clone built-in seeds | Y (`cloneFromTemplate`) | Y templates | Y (`import-seed` / ingest) | seed path in |
| Structure field CRUD, aliases, pydantic | Y | via project PUT | Y (`add-field` / `add-alias` / `pydantic`) | pydantic export + session validate |
| Structure assistant | Y | Y | Y (`agent structure`) | N |
| Pipeline add step | Y | via PUT | Y (`add-step`) | N |
| Pipeline per-step fields / reorder / export | Y | Y export | Y (`patch-step` / `move-step` / `pydantic`) | `describe_pipeline_steps` |
| Docs markdown | Y (edit/preview/split) | Y | P (set text / preview slice) | N |
| Documents upload, OCR, PDF, labels | Y | Y | P (text `add-doc` / `--file`) | N |
| Link quotes (local offsets) | Y | server step + local `findQuote` | Y | N |
| Validate pipeline / structures | Y | implicit on run | Y | Y |
| Testing file validate | Y | — | Y | Y |
| Testing **run** + diffs + LLM judge | Y | Y runs + `testing-evaluate` | P (`run-test` HTTP; diffs via pinpoint MCP) | P pinpoint vs run JSON |
| Inference `startRun` + input assignment | Y | Y | Y (`assign-input` / `start-run`) | Y `start_run` |
| Custom code (browser host) | Y | pause + client-step | N (no Node `CodeHost`; action registered) | N |
| Human review / chatbot pauses | Y | Y | N (action registered; GUI pause) | N |
| Logging traces / notes / Langfuse | Y | Y | Y (ViewModel: notes, test, langfuse, steps) | P `session_logs` |
| Cache inspect | Y | Y | Y (local snapshot / pull) | P `session_logs` |
| Share / marketplace / hosted APIs | Y | Y | P (list ids; mint is HTTP/GUI) | N |
| Earnings / billing / Stripe / keys | Y | Y | P (HTTP refresh; no Stripe TUI) | N |
| Settings / sign-in / teams | Y | Y | P (model / saveError; no OAuth) | N |
| Consumer Run mode | Y | shared-link APIs | N | N |
| Vibe / project agent propose+apply | Y | Y | Y (`agent ask/apply`) | Y `apply_project_changes` |
| Agent streaming + observe tools + billing | Y | Y | P (no stream/store/catalog) | N |
| Structure / testing / diagnosis agents | Y | Y | Y | N |
| Execute `proposedActions` runs | Y | Y | Y (`--run` + `SPINE_API_URL`) | via `start_run` |
| Supabase persist | Y | Y | P (JSON file + `pull`/`push`) | session file |
| Realtime overlay | Y | DB + channel | P (TUI attaches when Supabase env set) | N |
| Strategies / A-B | Y | `/api/abtest` | P (`setStrategies` on session) | N |
| `--offline` local-only | N/A | N/A | Y | N/A |

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

| Concept | GUI | CLI | API |
|---|---|---|---|
| Create project | `addProject` | `session add-project` | `POST /api/projects` |
| Open | `setActiveProjectId` / `openProject` | `session open` | `GET /api/state?projectId=` |
| Patch graph | `applyProjectChanges` | `add-model` / `add-step` / agent apply | `PUT /api/projects/:id` |
| Docs markdown | `setDocumentation` | `session set-docs` | same PUT |
| Validate | badges | `session validate` | (engine) |
| Quotes | quote UI | `session link-quotes` | quote step in run |
| Agent ask | Vibe send | `agent ask --message` | `POST /api/pipeline-assistant` |
| Agent approve | Approve button | `agent apply` | local + optional run |
| Tabs | `AppWindowId` | `TUI_TABS` | n/a |

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

### 8.4 MCP (Bar A vs Bar B)

**Bar A (replace Vibe)** — session tools exist:

- [x] `get_project` / `validate_project` from session file.
- [x] `apply_project_changes` matching `ProjectProposal`.
- [x] `start_run` / `run_test` (HTTP).
- [x] Test docs, runs, cache as `session_logs`.

**Bar B (whole app)** — not started: marketplace mint, hosted API create, Node custom-code, human-review pause, Stripe.

Pinpoint MCP remains the Testing-tab specialist; Bar A is the session/Vibe path.

### 8.5 GUI using core (convergence)

- [x] Overlay is shared (`overlayOptimisticProjects`). Method names on `useStore` match `SpineSession`.
- [ ] Thin `useStore` so every mutation goes through `SpineSession` (React still owns hydration/debounce/billing caches).
- [ ] React pipeline/docs panels consuming `toPipelineView` / `toDocsView` so CLI and GUI cannot drift.

---

## 9. How to verify parity

```bash
cd combined_full_stack
npm test -- lib/core lib/cli          # session, overlay, CLI, Ink renderToString
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
| Agent propose | both | `lib/server/pipeline_assistant.ts` |
| Agent apply | both | `session.applyProposal` / `project-assistant.tsx` |
| Test validate | GUI+CLI+MCP | `lib/testing-files.ts` |
