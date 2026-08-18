// AI : Pipeline forks — grep "TODO (allow-pipeline-non-linear-fork)" / "DONE (allow-pipeline-non-linear-fork)".
//
// Decision: in-pipeline forks (series-parallel), not saved-component sub-pipelines
//   and not an open node canvas (TODO.txt React Flow / XYFlow stays deferred).
//
// Why not "save as separate linear pipelines":
//   One task is one project. Testing, cache, export, marketplace, and the assistant
//   all assume one modules[] + one state. Splitting into child projects means hop
//   between editors, dual I/O contracts, and no shared run. Reusable components can
//   still land later as ModuleKind.PipelineRef — orthogonal to topology.
//
// Why not an open DAG canvas:
//   Builder stays insert-slot + inspector. Combine already groups a side-feed without
//   free edges. Fork is the same idea: a boxed segment with linear lanes.
//   Graphs we allow: series-parallel (linear chains, nested fork/join). No cycles,
//   no drag-wires, no skip-edges as the authoring model. Assemble/merge still read
//   label-keyed state at the join (existing escape hatch).
//
// Parallel vs Fork:
//   Parallel stays: N author-time LLM calls on the same spine, join into one product.
//   Fork is when a branch needs its own steps (assert, webhook, transform, llm-batch,
//   nested combine) or mixed kinds. Do not force Parallel users through Fork.
//
// Data model (keep Project.modules as the outer spine):
//   ModuleKind.Fork
//   forkBranches: { id, label, modules: PipelineModule[] }[]   // each lane is linear
//   forkJoin: "product" | "assemble" | "merge"
//   assembleBindings / mergePolicy reused when join needs them
//   Unique module ids + labels across the whole tree (state keys stay global).
//   flattenPipelineModules(project) for logs, cache, fingerprints, live UI.
//
// Spine I/O:
//   Fork.in = previous spine. Each branch[0].in = fork.in. Adjacent matching inside
//   a lane reuses computeInvalid on that lane with a synthetic predecessor.
//   Join out becomes the next spine. Product join = auto sm_fork_<id> like Parallel.
//
// UI (on rails):
//   New PipelineSegment kind "fork": dashed box like combine.
//   Inside: 2..N columns, each a mini linear canvas (insert + / move / remove).
//   Fork header: add/remove branch (min 2, cap 4). Join row at the bottom of the box.
//   No free positioning. Width grows; horizontal scroll if needed. max-w-xl stays
//   for purely linear pipelines.
//   v1 UI: one fork nesting level. Data model may nest; inspector says "flatten first".
//
// Run:
//   runLinearStepsFrom stays. Fork → Promise.all(lane runners) sharing ctx.outputs /
//   state, isolated prevModuleId per lane, then join. Pause (human-review / chatbot)
//   in a lane pauses the whole run; checkpoint stores branchId + index.
//
// Export:
//   orchestrator emits Promise.all of lane IIFEs, then join — same IR in ts/py/go/rs.
//
// Assistant:
//   Drop "strictly linear". Prefer a single spine when one chain suffices; Fork when
//   independent sub-pipelines share an input and must run before a join.
//
// Out of v1: conditional router (run one lane), multi-sink (no join / multiple Output),
//   nested fork UI, PipelineRef components, React Flow.
export {}

// AI : TODO (allow-pipeline-non-linear-fork) — stage A model: ModuleKind.Fork + forkBranches + forkJoin;
// AI :   factory; flattenPipelineModules; seed zod; MODULE_META; USER_ADDABLE. Linear projects unchanged.
// AI : TODO (allow-pipeline-non-linear-fork) — stage A validity: computeInvalid walks tree; lane I/O + join
// AI :   product; unique labels/ids.
// AI : TODO (allow-pipeline-non-linear-fork) — stage B run: execForkStep + Promise.all lanes; cache/fingerprint
// AI :   via flatten; live steps tree. Pause: checkpoint branchId for human-review/chatbot in a lane.
// AI : TODO (allow-pipeline-non-linear-fork) — stage C canvas: segment kind fork; column lanes; insert slots;
// AI :   no open canvas. Builder insert/move/remove scoped to lane. Testing align: fork row, N columns.
// AI : TODO (allow-pipeline-non-linear-fork) — stage D export: orchestrator Promise.all + join; mermaid
// AI :   subgraphs. Assistant prompt + schema materialize nested modules.
// AI : TODO (allow-pipeline-non-linear-fork) — stage E hosts: CLI workspace_edits, MCP, toPipelineView tree,
// AI :   Ink list with indent.
// AI : TODO (allow-pipeline-non-linear-fork) — stage F seeds: contract_diligence_fork, invoice_triage_fork,
// AI :   lead_notify_fork (+ docs/tests).
// AI : TODO (allow-pipeline-non-linear-fork) — later: router (one lane), sinks join, nested fork UI,
// AI :   optional Parallel-as-Fork sugar.

// ---------------------------------------------------------------------------
// Example pipelines to seed in fork-stage-F (author against the Fork model).
// Linear workarounds today: Parallel (LLM-only, instant join) or serialize
// independent work onto the spine (wrong types, extra latency, extra cost).
// ---------------------------------------------------------------------------

// Example 1 — Contract diligence fan-out (legal / underwriting)
//   Need: same filings → independent extractors (different schemas, quotes, asserts)
//   then one memo. Parallel cannot hold per-branch assert/quote/transform.
//
//   Input(pdf) → DocToText → ParseCompany
//     Fork "Diligence lanes"
//       lane Risks:    LLM(RiskFinding[]) → Assert → Quote
//       lane People:   LLM(KeyPerson[]) → Transform(normalize titles)
//       lane Covenants: LLM(Covenant[])
//     Join product { risks, people, covenants }
//   → LLM(DiligenceMemo) → Output

// Example 2 — Invoice triage (finance ops)
//   Need: mixed kinds on lanes (LLM + webhook + catalog select), then human review.
//
//   Input(pdf) → ParseInvoice
//     Fork "Triage"
//       lane GL:     LLM(GlCode)
//       lane Fraud:  Webhook(policy API) → Assert
//       lane Vendor: ExampleSelect against vendor catalog
//     Join assemble → HumanReview → Output

// Example 3 — Lead notify (multi-consumer; v1 uses product join as stand-in)
//   Need: one parsed lead consumed by two side effects plus a saved record.
//   v1: fork then assemble { crm, slack, record }. later-sinks drops the dummy join.
//
//   Input(json) → LLM(ParsedLead)
//     Fork "Notify"
//       lane CRM:   Webhook(CRM)
//       lane Slack: Webhook(Slack)
//       lane Save:  Transform(LeadRecord)
//     Join product → Output(LeadRecord)

// Example 4 — Why feedback_router is NOT a fork
//   Classify then one llm-batch is map over a list, not graph topology. Keep linear.
//   fork-later-router is for "run billing playbook XOR legal playbook", not map-reduce.
