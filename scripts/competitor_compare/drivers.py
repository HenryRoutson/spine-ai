#!/usr/bin/env python3
# AI : Spine vibe driver only — other platforms were removed; cloud cannot test them.
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .harness import (
    AUTH_DIR,
    ROOT,
    PlatformName,
    PlatformResult,
    env_get,
    load_env,
    mask_secret,
    start_urls,
)


def ensure_auth_dir() -> Path:
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    return AUTH_DIR

JsonDict = dict[str, Any]


@dataclass(frozen=True)
class CredentialStatus:
    platform: PlatformName
    ready: bool
    method: str
    hint: str


def credential_status(env: dict[str, str] | None = None) -> list[CredentialStatus]:
    env = env if env is not None else load_env()
    return [_spine_status(env)]


def _live_openrouter_key(env: dict[str, str]) -> str:
    key = env_get(env, "OPENROUTER_API_KEY")
    if not key or "placeholder" in key or key.startswith("sk-or-local"):
        return ""
    return key


def _spine_status(env: dict[str, str]) -> CredentialStatus:
    key = _live_openrouter_key(env)
    if key:
        return CredentialStatus("spine", True, "openrouter", f"OPENROUTER_API_KEY {mask_secret(key)}")
    cli = ROOT / "combined_full_stack" / "scripts" / "spine-cli.ts"
    if not cli.exists():
        return CredentialStatus("spine", False, "none", "combined_full_stack/scripts/spine-cli.ts missing")
    return CredentialStatus(
        "spine",
        False,
        "cli",
        "spine vibe needs a real OPENROUTER_API_KEY (not the local placeholder)",
    )


def _elapsed(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def run_platform(
    platform: PlatformName,
    prompt: str,
    *,
    wait_seconds: int,
    env: dict[str, str] | None = None,
    dry_run: bool = False,
    browser_runner: Callable[..., PlatformResult] | None = None,
    project_name: str = "",
) -> PlatformResult:
    env = env if env is not None else load_env()
    started = time.monotonic()
    if platform != "spine":
        return PlatformResult(
            platform="spine",
            ok=False,
            method="none",
            skipped=True,
            error="only spine is supported",
            elapsed_ms=_elapsed(started),
        )
    if dry_run:
        urls = start_urls(prompt)
        return PlatformResult(
            platform="spine",
            ok=True,
            method="dry-run",
            skipped=False,
            editor_url=urls["spine"],
            transcript="[dry-run] would send the prompt via spine vibe",
            elapsed_ms=_elapsed(started),
        )
    _ = browser_runner
    result = _run_spine(prompt, wait_seconds, env, project_name)
    result.elapsed_ms = _elapsed(started)
    return result


def _run_spine(prompt: str, wait_seconds: int, env: dict[str, str], project_name: str) -> PlatformResult:
    import os
    import subprocess
    import tempfile

    cli = ROOT / "combined_full_stack" / "scripts" / "spine-cli.ts"
    if not cli.exists():
        return PlatformResult("spine", False, "none", skipped=True, error="spine-cli.ts missing")
    if not _live_openrouter_key(env):
        status = _spine_status(env)
        return PlatformResult("spine", False, status.method, skipped=True, error=status.hint)

    app = ROOT / "combined_full_stack"
    run_env = os.environ.copy()
    for key, value in env.items():
        if value:
            run_env[key] = value
    timeout = max(90, wait_seconds + 30)

    def spine(*args: str) -> JsonDict:
        cmd = ["npx", "tsx", "scripts/spine-cli.ts", *args, "--json"]
        proc = subprocess.run(
            cmd,
            cwd=app,
            env=run_env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        payload = _parse_cli_json(proc.stdout) if proc.stdout.strip() else {}
        if proc.returncode != 0 and not payload:
            err = (proc.stderr or proc.stdout or f"exit {proc.returncode}").strip()
            raise RuntimeError(err[:800])
        if not isinstance(payload, dict):
            raise RuntimeError(f"spine CLI returned non-object JSON: {payload!r}")
        payload["_exit"] = proc.returncode
        payload["_stderr"] = (proc.stderr or "").strip()[-400:]
        return payload

    with tempfile.TemporaryDirectory(prefix="spine-compare-") as tmp:
        session_path = str(Path(tmp) / "session.json")
        created = spine("session", "add-project", "--open", "--session", session_path)
        if project_name:
            spine("session", "rename", "--name", project_name, "--session", session_path)
        asked = spine(
            "agent",
            "ask",
            "--message",
            prompt,
            "--assistant",
            "vibe",
            "--apply",
            "--session",
            session_path,
        )
        mermaid = spine("session", "mermaid", "--session", session_path)
        pipeline = spine("session", "pipeline", "--session", session_path)

    data = asked.get("data") if isinstance(asked.get("data"), dict) else {}
    issues = asked.get("issues") if isinstance(asked.get("issues"), list) else []
    error_text = "; ".join(
        str(i.get("message")) for i in issues if isinstance(i, dict) and i.get("level") == "error" and i.get("message")
    )
    ok = bool(asked.get("ok")) and not error_text
    return PlatformResult(
        platform="spine",
        ok=ok,
        method="vibe",
        editor_url="spine-cli agent ask --assistant vibe",
        transcript=_spine_transcript(asked, mermaid, pipeline),
        error=error_text or None,
        extra={
            "changed": data.get("changed") if isinstance(data, dict) else [],
            "applied": data.get("applied") if isinstance(data, dict) else False,
            "invalidCount": data.get("invalidCount") if isinstance(data, dict) else None,
            "add_project": (created.get("data") or {}).get("project") if isinstance(created.get("data"), dict) else None,
        },
    )


def _parse_cli_json(stdout: str) -> JsonDict:
    import json

    text = stdout.strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError(f"spine CLI stdout is not JSON: {text[:300]}") from None
        parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("spine CLI JSON is not an object")
    return parsed


def _spine_transcript(asked: JsonDict, mermaid: JsonDict, pipeline: JsonDict) -> str:
    import json

    parts: list[str] = []
    data = asked.get("data") if isinstance(asked.get("data"), dict) else {}
    human = data.get("human") if isinstance(data, dict) else None
    message = data.get("message") if isinstance(data, dict) else None
    if isinstance(human, str) and human.strip():
        parts.append(human.strip())
    elif isinstance(message, str) and message.strip():
        parts.append(message.strip())
    issues = asked.get("issues") if isinstance(asked.get("issues"), list) else []
    for issue in issues:
        if isinstance(issue, dict) and issue.get("message"):
            parts.append(f"[{issue.get('level')}] {issue.get('where')}: {issue.get('message')}")
    chart = (mermaid.get("data") or {}).get("mermaid") if isinstance(mermaid.get("data"), dict) else None
    if isinstance(chart, str) and chart.strip():
        parts.append("## mermaid\n" + chart.strip())
    pipe = (pipeline.get("data") or {}).get("pipeline") if isinstance(pipeline.get("data"), dict) else None
    if pipe:
        parts.append("## pipeline\n" + json.dumps(pipe, indent=2)[:8000])
    return "\n\n".join(parts) or "(no vibe output)"
