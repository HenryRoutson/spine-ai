#!/usr/bin/env python3
# AI : compare DeepSeek with vs without Spine MCP on pinned *_testing.json benchmarks.
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "combined_full_stack"
MCP = ROOT / "mcp_tool"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "deepseek/deepseek-chat"
MAX_RETRIES = 2


@dataclass
class BenchmarkCase:
    seed_path: str
    test_path: str
    project_name: str
    test_name: str
    pinned_step_count: int
    llm_step_count: int


@dataclass
class ModeResult:
    mode: str
    passed: bool
    summary: dict[str, int]
    step_results: list[dict[str, Any]]
    llm_calls: int = 0
    mcp_calls: int = 0
    latency_ms: int = 0
    cost_estimate_usd: float = 0.0
    error: str | None = None
    first_failure: Any = None


@dataclass
class BenchmarkReport:
    benchmark: BenchmarkCase
    baseline: ModeResult
    mcp: ModeResult


def read_env_key() -> str:
    for path in (ROOT / ".env", APP / ".env.local"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("OPENROUTER_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"')
                if val:
                    return val
    env = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if env:
        return env
    raise RuntimeError("OPENROUTER_API_KEY missing — set in .env or export it")


def extract_json(stdout: str) -> Any:
    lines = [ln for ln in stdout.splitlines() if ln.strip()]
    for line in reversed(lines):
        stripped = line.strip()
        if not stripped.startswith("{") and not stripped.startswith("["):
            continue
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass
    for i, line in enumerate(lines):
        if line.strip().startswith("{"):
            return json.loads("\n".join(lines[i:]))
    raise RuntimeError(f"benchmark bridge returned no JSON: {stdout[:400]}")


def bridge_cmd(*args: str) -> Any:
    env = os.environ.copy()
    env["SPINE_REPO_ROOT"] = str(ROOT)
    env["SPINE_APP_ROOT"] = str(APP)
    proc = subprocess.run(
        ["npx", "tsx", "--tsconfig", "tsconfig.json", "scripts/benchmark_bridge.ts", *args],
        cwd=MCP,
        env=env,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "benchmark bridge failed")
    return extract_json(proc.stdout)


def list_benchmarks(*, runnable_only: bool = True) -> list[BenchmarkCase]:
    data = bridge_cmd("list")
    out: list[BenchmarkCase] = []
    for row in data["benchmarks"]:
        if runnable_only and not row.get("runnable"):
            continue
        out.append(
            BenchmarkCase(
                seed_path=row["seedPath"],
                test_path=row["testPath"],
                project_name=row["projectName"],
                test_name=row["testName"],
                pinned_step_count=row["pinnedStepCount"],
                llm_step_count=row["llmStepCount"],
            )
        )
    return out


def prepare_benchmark(seed_path: str, test_path: str) -> dict[str, Any]:
    return bridge_cmd("prepare", seed_path, test_path)


def score_run(seed_path: str, test_path: str, run: dict[str, Any]) -> dict[str, Any]:
    return bridge_cmd("score", seed_path, test_path, json.dumps(run))


def parse_json_content(text: str) -> Any:
    text = text.strip()
    if not text:
        raise ValueError("empty model response")
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def ssl_context() -> ssl.SSLContext | None:
    try:
        import certifi  # type: ignore[import-untyped]

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def bridge_tool(name: str, arguments: dict[str, Any]) -> Any:
    return bridge_cmd("tool", name, json.dumps(arguments))


class OpenRouterClient:
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        self.api_key = api_key
        self.model = model
        self.total_calls = 0

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        response_json: bool = True,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0,
            "provider": {"allow_fallbacks": False},
        }
        if response_json and not tools:
            body["response_format"] = {"type": "json_object"}
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        req = urllib.request.Request(
            OPENROUTER_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.environ.get("OPENROUTER_SITE_URL", "http://localhost:3000"),
                "X-Title": os.environ.get("OPENROUTER_APP_TITLE", "spine-benchmark"),
            },
            method="POST",
        )
        self.total_calls += 1
        try:
            with urllib.request.urlopen(req, timeout=180, context=ssl_context()) as res:
                payload = json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8")
            raise RuntimeError(f"OpenRouter HTTP {err.code}: {raw[:400]}") from err
        return payload


def naive_prompt(step: dict[str, Any]) -> str:
    kind = step["kind"]
    label = step["label"]
    payload = json.dumps(step["input"], indent=2)
    if kind == "llm-batch":
        return (
            f'Execute pipeline step "{label}" (batch LLM).\n'
            f"For EACH item in the input list, return one structured JSON object.\n"
            f"Return a JSON array with one result per input item, same order.\n\n"
            f"INPUT LIST:\n{payload}\n"
        )
    return (
        f'Execute pipeline step "{label}".\n'
        f"Return ONLY valid JSON matching the task output.\n\n"
        f"INPUT:\n{payload}\n"
    )


def run_llm_step_baseline(client: OpenRouterClient, step: dict[str, Any]) -> Any:
    prompt = naive_prompt(step)
    resp = client.chat(
        [{"role": "user", "content": prompt}],
        response_json=step["kind"] != "llm-batch",
    )
    msg = resp["choices"][0]["message"]
    content = msg.get("content") or ""
    return parse_json_content(content)


def run_llm_step_mcp(
    client: OpenRouterClient,
    *,
    seed_path: str,
    step: dict[str, Any],
    mcp_calls: list[int],
) -> Any:
    label = step["label"]
    sample_input = json.dumps(step["input"])
    mcp_calls[0] += 1
    derived = bridge_tool(
        "derive_step_prompt",
        {
            "projectSeedPath": seed_path,
            "stepLabel": label,
            "sampleInputJson": sample_input,
        },
    )
    structured_prompt = (
        derived.get("derivedStructuredPrompt")
        if isinstance(derived, dict)
        else str(derived)
    )

    if step["kind"] == "llm-batch":
        items = step["input"] if isinstance(step["input"], list) else [step["input"]]
        rows: list[Any] = []
        for item in items:
            item_prompt = f"{structured_prompt}\n\nITEM:\n{json.dumps(item, indent=2)}"
            rows.append(_mcp_llm_validate_loop(client, mcp_calls, seed_path, label, item_prompt))
        return rows

    user_prompt = structured_prompt or naive_prompt(step)
    return _mcp_llm_validate_loop(client, mcp_calls, seed_path, label, user_prompt)


def _mcp_llm_validate_loop(
    client: OpenRouterClient,
    mcp_calls: list[int],
    seed_path: str,
    label: str,
    prompt: str,
) -> Any:
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
    last_error = "unknown validation error"
    for _attempt in range(MAX_RETRIES + 1):
        resp = client.chat(messages, response_json=True)
        content = resp["choices"][0]["message"].get("content") or ""
        try:
            value = parse_json_content(content)
        except (json.JSONDecodeError, ValueError) as err:
            last_error = str(err)
            messages.append({"role": "assistant", "content": content})
            messages.append(
                {
                    "role": "user",
                    "content": f"Invalid JSON: {err}. Return ONLY valid JSON.",
                }
            )
            continue

        mcp_calls[0] += 1
        validation = bridge_tool(
            "validate_step_output",
            {
                "projectSeedPath": seed_path,
                "stepLabel": label,
                "valueJson": json.dumps(value),
            },
        )
        if isinstance(validation, dict) and validation.get("ok"):
            return value
        last_error = (
            validation.get("error") if isinstance(validation, dict) else str(validation)
        )
        messages.append({"role": "assistant", "content": json.dumps(value)})
        messages.append(
            {
                "role": "user",
                "content": f"Schema validation failed: {last_error}. Fix and return JSON only.",
            }
        )
    raise RuntimeError(f"step {label!r} failed validation after retries: {last_error}")


def build_run(project_name: str, prepared: dict[str, Any], llm_outputs: list[dict[str, Any]]) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in prepared.get("deterministicSteps", []):
        label = row["label"]
        if label in seen:
            continue
        seen.add(label)
        steps.append(
            {
                "label": label,
                "kind": row.get("kind", "custom-code"),
                "ms": 0,
                "costCents": 0,
                "outputJson": json.dumps(row["output"], indent=2),
            }
        )
    for row in llm_outputs:
        label = row["label"]
        if label in seen:
            continue
        seen.add(label)
        steps.append(
            {
                "label": label,
                "kind": row.get("kind", "llm"),
                "ms": 0,
                "costCents": 0,
                "outputJson": json.dumps(row["output"], indent=2),
            }
        )
    return {
        "id": f"bench_py_{int(time.time() * 1000)}",
        "startedAt": int(time.time() * 1000),
        "status": "ok",
        "totalMs": 0,
        "billedCents": 0,
        "savedCents": 0,
        "model": DEFAULT_MODEL,
        "steps": steps,
        "notes": f"python benchmark — {project_name}",
    }


def run_baseline(
    api_key: str,
    case: BenchmarkCase,
    prepared: dict[str, Any],
    model: str,
) -> ModeResult:
    t0 = time.time()
    client = OpenRouterClient(api_key, model)
    llm_outputs: list[dict[str, Any]] = []
    try:
        for step in prepared.get("llmSteps", []):
            output = run_llm_step_baseline(client, step)
            llm_outputs.append({"label": step["label"], "kind": step["kind"], "output": output})
        run = build_run(case.project_name, prepared, llm_outputs)
        scored = score_run(case.seed_path, case.test_path, run)
        return ModeResult(
            mode="baseline",
            passed=scored["passed"],
            summary=scored["summary"],
            step_results=scored["stepResults"],
            llm_calls=client.total_calls,
            mcp_calls=0,
            latency_ms=int((time.time() - t0) * 1000),
            first_failure=scored.get("firstFailure"),
        )
    except Exception as err:  # noqa: BLE001 — benchmark harness surfaces all failures
        return ModeResult(
            mode="baseline",
            passed=False,
            summary={"passed": 0, "failed": 0, "total": 0},
            step_results=[],
            llm_calls=client.total_calls,
            latency_ms=int((time.time() - t0) * 1000),
            error=str(err),
        )


def run_mcp_mode(
    api_key: str,
    case: BenchmarkCase,
    prepared: dict[str, Any],
    model: str,
) -> ModeResult:
    t0 = time.time()
    client = OpenRouterClient(api_key, model)
    mcp_calls = [0]
    llm_outputs: list[dict[str, Any]] = []
    try:
        for step in prepared.get("llmSteps", []):
            output = run_llm_step_mcp(
                client,
                seed_path=case.seed_path,
                step=step,
                mcp_calls=mcp_calls,
            )
            llm_outputs.append({"label": step["label"], "kind": step["kind"], "output": output})
        run = build_run(case.project_name, prepared, llm_outputs)
        scored = score_run(case.seed_path, case.test_path, run)
        return ModeResult(
            mode="mcp",
            passed=scored["passed"],
            summary=scored["summary"],
            step_results=scored["stepResults"],
            llm_calls=client.total_calls,
            mcp_calls=mcp_calls[0],
            latency_ms=int((time.time() - t0) * 1000),
            first_failure=scored.get("firstFailure"),
        )
    except Exception as err:  # noqa: BLE001
        return ModeResult(
            mode="mcp",
            passed=False,
            summary={"passed": 0, "failed": 0, "total": 0},
            step_results=[],
            llm_calls=client.total_calls,
            mcp_calls=mcp_calls[0],
            latency_ms=int((time.time() - t0) * 1000),
            error=str(err),
        )


def print_summary(reports: list[BenchmarkReport]) -> None:
    print("\n=== DeepSeek vs DeepSeek+Spine MCP ===\n")
    print(f"{'Benchmark':<42} {'Baseline':<18} {'+MCP':<18} {'Δ steps'}")
    print("-" * 90)
    for r in reports:
        b = r.baseline
        m = r.mcp
        b_label = "PASS" if b.passed else "FAIL"
        m_label = "PASS" if m.passed else "FAIL"
        if b.error:
            b_label = f"ERR ({b.error[:20]}…)"
        if m.error:
            m_label = f"ERR ({m.error[:20]}…)"
        b_steps = f"{b.summary.get('passed', 0)}/{b.summary.get('total', 0)}"
        m_steps = f"{m.summary.get('passed', 0)}/{m.summary.get('total', 0)}"
        delta = m.summary.get("passed", 0) - b.summary.get("passed", 0)
        name = f"{r.benchmark.project_name} · {r.benchmark.test_name}"[:41]
        print(f"{name:<42} {b_label} ({b_steps}){'':<4} {m_label} ({m_steps}){'':<4} {delta:+d}")
    print()


def to_json(reports: list[BenchmarkReport]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in reports:
        out.append(
            {
                "benchmark": r.benchmark.__dict__,
                "baseline": r.baseline.__dict__,
                "mcp": r.mcp.__dict__,
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare DeepSeek with vs without Spine MCP on *_testing.json benchmarks.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List runnable benchmarks (golden expectedOutputs filled) and exit",
    )
    parser.add_argument(
        "--benchmark",
        action="append",
        dest="benchmarks",
        help="Run only matching seed or test name substring (repeatable)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max benchmarks to run (0 = all runnable)",
    )
    parser.add_argument(
        "--mode",
        choices=("both", "baseline", "mcp"),
        default="both",
        help="Which agent modes to run",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write JSON report to this path",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"OpenRouter model slug (default: {DEFAULT_MODEL})",
    )
    args = parser.parse_args()

    cases = list_benchmarks(runnable_only=True)
    if args.benchmarks:
        needles = [n.lower() for n in args.benchmarks]
        cases = [
            c
            for c in cases
            if any(
                n in c.seed_path.lower()
                or n in c.test_path.lower()
                or n in c.project_name.lower()
                or n in c.test_name.lower()
                for n in needles
            )
        ]
    if args.limit > 0:
        cases = cases[: args.limit]

    if args.list:
        for c in cases:
            print(
                f"{c.project_name:30} {c.test_name:40} "
                f"pinned={c.pinned_step_count} llm={c.llm_step_count}"
            )
        print(f"\n{runnable_only_count()} runnable of {total_test_count()} total test files")
        return 0

    if not cases:
        print("No runnable benchmarks — fill expectedOutputs in *_testing.json first.", file=sys.stderr)
        return 1

    api_key = read_env_key()
    model = args.model

    reports: list[BenchmarkReport] = []
    for case in cases:
        print(f"\n→ {case.project_name} / {case.test_name}", flush=True)
        prepared = prepare_benchmark(case.seed_path, case.test_path)
        if not prepared.get("llmSteps"):
            print("  skip — no LLM steps on path", flush=True)
            continue

        baseline = ModeResult("baseline", False, {}, [])
        mcp_result = ModeResult("mcp", False, {}, [])

        if args.mode in ("both", "baseline"):
            print("  baseline (DeepSeek only)…", flush=True)
            baseline = run_baseline(api_key, case, prepared, model)
            print(
                f"    {'PASS' if baseline.passed else 'FAIL'} "
                f"{baseline.summary.get('passed', 0)}/{baseline.summary.get('total', 0)} "
                f"llm_calls={baseline.llm_calls} {baseline.latency_ms}ms",
                flush=True,
            )

        if args.mode in ("both", "mcp"):
            print("  mcp (DeepSeek + Spine tools)…", flush=True)
            mcp_result = run_mcp_mode(api_key, case, prepared, model)
            print(
                f"    {'PASS' if mcp_result.passed else 'FAIL'} "
                f"{mcp_result.summary.get('passed', 0)}/{mcp_result.summary.get('total', 0)} "
                f"llm_calls={mcp_result.llm_calls} mcp_calls={mcp_result.mcp_calls} "
                f"{mcp_result.latency_ms}ms",
                flush=True,
            )

        reports.append(BenchmarkReport(case, baseline, mcp_result))

    print_summary(reports)
    if args.output:
        args.output.write_text(json.dumps(to_json(reports), indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.output}")

    any_pass = any(r.mcp.passed or r.baseline.passed for r in reports)
    return 0 if reports and any_pass else 1 if reports else 1


def runnable_only_count() -> int:
    return len(list_benchmarks(runnable_only=True))


def total_test_count() -> int:
    return len(list_benchmarks(runnable_only=False))


if __name__ == "__main__":
    raise SystemExit(main())
