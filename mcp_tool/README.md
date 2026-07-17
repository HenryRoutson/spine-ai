# Spine Pinpoint MCP

MCP server that reuses Spine's Testing-tab logic to **pinpoint which pipeline step diverged** from pinned `*_testing.json` outputs. Returns isolated field diffs (expected vs actual) — not full run logs, not cache stats.

Deterministic field compare only today; probabilistic (LLM-checked) fields and benchmarks are intentionally out of scope for now.

## Tools

| Tool | Purpose |
|------|---------|
| `pinpoint_failure` | First diverging step + isolated diff text/JSON + schema validation on actual output |
| `compare_run_to_test` | Full per-step comparison report |
| `validate_test` | Validate a test file against the live pipeline |
| `parse_test` | Parse a `*_testing.json` file |
| `list_project_tests` | List test files in a seed |
| `describe_pipeline_steps` | Per-step pydantic models, JSON schemas, spine I/O types, derived LLM prompts |
| `validate_step_output` | Validate JSON against a step's pydantic / pipeline-state schema |
| `derive_step_prompt` | Build the structured LLM prompt (user prompt + JSON Schema suffix) |
| `validate_pipeline_wiring` | Linear spine I/O validity (`computeInvalid`) |
| `export_pydantic` | Export all pydantic models + generated step signatures |

## Setup (Cursor)

Add to `.cursor/mcp.json` in the repo root:

```json
{
  "mcpServers": {
    "spine-pinpoint": {
      "command": "npm",
      "args": ["run", "start", "--prefix", "mcp_tool"],
      "env": {
        "SPINE_REPO_ROOT": "/absolute/path/to/antler_vc_hackathon",
        "SPINE_APP_ROOT": "/absolute/path/to/antler_vc_hackathon/combined_full_stack"
      }
    }
  }
}
```

Install once:

```bash
npm install --prefix mcp_tool
```

## Example

After a run fails in the app, export or copy the run JSON, then ask the agent:

> Use `pinpoint_failure` with `combined_full_stack/seeds/homework_grader.json`, `combined_full_stack/documents/homework_grader/homework_grader_testing.json`, and the run at `path/to/run.json`.

The response names the first bad step and lists only the fields that differ.

## Development

```bash
npm install --prefix mcp_tool
npm test --prefix mcp_tool
npm run typecheck --prefix mcp_tool
```

## Benchmark (DeepSeek vs Spine MCP)

Compare **DeepSeek alone** vs **DeepSeek + Spine tool logic** (`derive_step_prompt`, `validate_step_output`) on pinned `*_testing.json` benchmarks:

```bash
# list runnable benchmarks (golden expectedOutputs filled)
python3 scripts/benchmark_mcp_deepseek.py --list

# quick run — Batch LLM Example only
python3 scripts/benchmark_mcp_deepseek.py --benchmark batch_llm --limit 1

# full suite (homework grader tests are slow / many LLM calls)
python3 scripts/benchmark_mcp_deepseek.py --output /tmp/spine_bench.json
```

Requires `OPENROUTER_API_KEY` in repo `.env`. Uses `mcp_tool/scripts/benchmark_bridge.ts` for prepare/score (same compare rules as the Testing tab).
