// AI : Windmill as the established execution IR — grep "TODO (windmill" for open work; mark DONE when a stage ships.
//
// Spine = Windmill + extras (keep these; do not replace with generic Windmill Apps/agents):
//   - derived prompts from Zod structures
//   - quote click-to-highlight in source documents
//   - Lovable-style vibe coding
//   - shared SQL + Zod/Pydantic from one StructureModel
//   - LLM tests: deterministic exact vs probabilistic LLM-check
//
// Windmill owns: OpenFlow graph, sandboxed bun/python workers, JSON Schema forms, human-review suspend.
//
// AI : DONE (windmill-A-schema) — StructureModel → JSON Schema via Zod; x-spine-deterministic / quote / sql-table
// AI : DONE (windmill-B-openflow) — compileProjectToOpenFlow (llm → aiagent output_schema, batch → forloopflow)
// AI : DONE (windmill-C-sandbox) — n8n + custom-code/transform preview on Windmill when windmillExecute + WINDMILL_* set
// AI : DONE (windmill-D-export) — {slug}_flow.json + schema.json in the pipeline zip; Structures JSON Schema tab
//
export {}
