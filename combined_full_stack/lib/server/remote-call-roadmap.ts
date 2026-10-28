// AI : Shared remote-call runner (maybe) — grep "TODO (remote-call" for open work.
//
// Plan (do NOT collapse ModuleKind.Llm into webhook / generic API):
//   - Product kinds stay separate: llm / llm-batch / parallel / webhook / n8n.
//   - Optional internal runner shares cardinality + coerce only:
//       callRemote({ mode: "once" | "map" | "all" }) → adapter → materialize + validate
//   - Adapters differ: llmStructured | fetchWebhook | n8nExecute.
//   - LLM-only stays on the LLM adapter: prompt/schema, model catalog, cost ledger,
//     browser defer, jsonMode / parse retries.
//   - n8n stays catalogued remote node exec (see n8n-roadmap) — not webhook body POST.
//
// AI : TODO (remote-call-maybe-runner) — maybe? extract shared once|map|all orchestration used by
// AI :   llm, llm-batch, parallel (and later n8n); leave ModuleKind surfaces unchanged
// AI : TODO (remote-call-maybe-cardinality) — maybe? one cardinality helper (once / map-list /
// AI :   fixed parallel branches) so Promise.all / batch fan-out is not re-copied per step
// AI : TODO (remote-call-maybe-coerce) — maybe? share response coerce path dig + materialize
// AI :   between webhook and other adapters (LLM keeps schema-in-prompt path)
// AI : TODO (remote-call-maybe-budget) — maybe? shared sub-progress hook; cost caps remain
// AI :   LLM/parallel-adapter-only (webhook usually skips)
// AI : TODO (remote-call-not-unify-kinds) — do NOT merge llm into webhook/API Response kind;
// AI :   kitchen-sink prompt+model+jsonMode+cost+URL is worse than two families
// AI : DONE (media-view-D-job) — generate poll/ingest is webhook, not this maybe-runner and not a RemoteJob kind.

export {};
