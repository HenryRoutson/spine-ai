#!/usr/bin/env python3
# AI : API / MCP drivers. Browser fallback lives in browser.py so Playwright stays optional.
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

_browser_lock = threading.Lock()

from .harness import (
    AUTH_DIR,
    ROOT,
    PlatformName,
    PlatformResult,
    env_get,
    load_env,
    mask_secret,
    start_urls,
    storage_state_path,
)
from .http_util import HttpError, json_request, mcp_connect, pick_tool, tool_arguments

JsonDict = dict[str, Any]

LOVABLE_API = "https://api.lovable.dev"
REPLIT_MCP = "https://replit-mcp.com/server/mcp"
BASE44_MCP = "https://app.base44.com/mcp/"
BASE44_API = "https://app.base44.com/api"


@dataclass(frozen=True)
class CredentialStatus:
    platform: PlatformName
    ready: bool
    method: str
    hint: str


def _has_storage(platform: PlatformName) -> bool:
    path = storage_state_path(platform)
    return path.exists() and path.stat().st_size > 2


def credential_status(env: dict[str, str] | None = None) -> list[CredentialStatus]:
    env = env if env is not None else load_env()
    return [
        _lovable_status(env),
        _replit_status(env),
        _base44_status(env),
        _spine_status(env),
    ]


def _lovable_status(env: dict[str, str]) -> CredentialStatus:
    key = env_get(env, "LOVABLE_API_KEY", "LOVABLE_API_TOKEN")
    if key:
        return CredentialStatus("lovable", True, "api_key", f"LOVABLE_API_KEY {mask_secret(key)}")
    if _has_storage("lovable"):
        return CredentialStatus("lovable", True, "storage_state", str(storage_state_path("lovable")))
    return CredentialStatus(
        "lovable",
        False,
        "none",
        "docs/competitor_compare_keys.md — official Lovable API is Build-with-URL; REST lov_… key is not on that page",
    )


def _replit_status(env: dict[str, str]) -> CredentialStatus:
    token = env_get(env, "REPLIT_MCP_ACCESS_TOKEN", "REPLIT_API_TOKEN", "REPLIT_TOKEN")
    if token:
        return CredentialStatus("replit", True, "mcp_token", f"REPLIT token {mask_secret(token)}")
    if _has_storage("replit"):
        return CredentialStatus("replit", True, "storage_state", str(storage_state_path("replit")))
    return CredentialStatus(
        "replit",
        False,
        "none",
        "docs/competitor_compare_keys.md — official Replit Agent API is MCP OAuth, no static key",
    )


def _base44_status(env: dict[str, str]) -> CredentialStatus:
    # AI : this eval uses BASE44_API_KEY only — no access token, CLI auth file, or browser cookies.
    key = env_get(env, "BASE44_API_KEY")
    if key:
        return CredentialStatus("base44", True, "api_key", f"BASE44_API_KEY {mask_secret(key)}")
    return CredentialStatus(
        "base44",
        False,
        "none",
        "set Cloud secret BASE44_API_KEY (Settings → Preferences → API Key) and start a new agent",
    )


def _live_openrouter_key(env: dict[str, str]) -> str:
    # AI : skip .env placeholders so a Cloud OPENROUTER_KEY still counts as live.
    for name in ("OPENROUTER_API_KEY", "OPENROUTER_KEY"):
        key = env.get(name, "").strip()
        if not key or "placeholder" in key or key.startswith("sk-or-local"):
            continue
        return key
    return ""


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
    if dry_run:
        urls = start_urls(prompt)
        return PlatformResult(
            platform=platform,
            ok=True,
            method="dry-run",
            skipped=False,
            editor_url=urls[platform],
            transcript=f"[dry-run] would send the prompt via {platform} using saved credentials",
            elapsed_ms=_elapsed(started),
        )
    try:
        if platform == "lovable":
            result = _run_lovable(prompt, wait_seconds, env, browser_runner, project_name)
        elif platform == "replit":
            result = _run_replit(prompt, wait_seconds, env, browser_runner, project_name)
        elif platform == "base44":
            result = _run_base44(prompt, wait_seconds, env, browser_runner, project_name)
        elif platform == "spine":
            result = _run_spine(prompt, wait_seconds, env, project_name)
        else:
            raise ValueError(f"unknown platform {platform}")
        result.elapsed_ms = _elapsed(started)
        return result
    except Exception as exc:  # noqa: BLE001 — surface any driver failure into the compare folder
        return PlatformResult(
            platform=platform,
            ok=False,
            method="error",
            error=str(exc),
            elapsed_ms=_elapsed(started),
        )


def _elapsed(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _run_lovable(
    prompt: str,
    wait_seconds: int,
    env: dict[str, str],
    browser_runner: Callable[..., PlatformResult] | None,
    project_name: str,
) -> PlatformResult:
    key = env_get(env, "LOVABLE_API_KEY", "LOVABLE_API_TOKEN")
    if key:
        return lovable_api(prompt, wait_seconds, key, env_get(env, "LOVABLE_WORKSPACE_ID"), project_name)
    if _has_storage("lovable") and browser_runner:
        with _browser_lock:
            return browser_runner("lovable", prompt, wait_seconds)
    status = _lovable_status(env)
    return PlatformResult("lovable", False, status.method, skipped=True, error=status.hint)


def _run_replit(
    prompt: str,
    wait_seconds: int,
    env: dict[str, str],
    browser_runner: Callable[..., PlatformResult] | None,
    project_name: str,
) -> PlatformResult:
    token = env_get(env, "REPLIT_MCP_ACCESS_TOKEN", "REPLIT_API_TOKEN", "REPLIT_TOKEN")
    if token:
        return mcp_create(
            platform="replit",
            url=REPLIT_MCP,
            token=token,
            prompt=prompt,
            wait_seconds=wait_seconds,
            tool_names=("create_app_from_prompt", "create_app", "createApp"),
            extra_args={"app_stack": env_get(env, "REPLIT_APP_STACK") or "react_website", "userSpecifiedAppName": project_name or "spine-compare"},
        )
    if _has_storage("replit") and browser_runner:
        with _browser_lock:
            return browser_runner("replit", prompt, wait_seconds)
    status = _replit_status(env)
    return PlatformResult("replit", False, status.method, skipped=True, error=status.hint)


def _run_base44(
    prompt: str,
    wait_seconds: int,
    env: dict[str, str],
    browser_runner: Callable[..., PlatformResult] | None,
    project_name: str,
) -> PlatformResult:
    # AI : eval path is BASE44_API_KEY only — ignore access tokens, CLI auth, and browser cookies.
    del browser_runner
    key = env_get(env, "BASE44_API_KEY")
    if key:
        extra: JsonDict = {}
        if project_name:
            extra["name"] = project_name
        try:
            return mcp_create(
                platform="base44",
                url=BASE44_MCP,
                token=key,
                prompt=prompt,
                wait_seconds=wait_seconds,
                tool_names=("create_base44_app", "create_app", "createApp"),
                extra_args=extra,
            )
        except HttpError as exc:
            # AI : MCP is OAuth; the stored account key still works on REST as api_key.
            if exc.status in {401, 403}:
                return _base44_rest_create(prompt, key, project_name, mcp_error=str(exc))
            raise
    status = _base44_status(env)
    return PlatformResult("base44", False, status.method, skipped=True, error=status.hint)


def _base44_rest_create(prompt: str, key: str, project_name: str, *, mcp_error: str) -> PlatformResult:
    name = (project_name or "spine-compare")[:80]
    created, _ = json_request(
        "POST",
        f"{BASE44_API}/apps",
        headers={"api_key": key},
        body={
            "name": name,
            "user_description": prompt[:4000],
            "is_managed_source_code": False,
            "public_settings": "public_without_login",
        },
        timeout=60,
    )
    if not isinstance(created, dict) or not created.get("id"):
        raise RuntimeError(f"Base44 REST create missing id: {created!r}")
    app_id = str(created["id"])
    slug = str(created.get("slug") or app_id)
    editor_url = f"https://app.base44.com/apps/{app_id}"
    transcript = (
        "REST created a blank Base44 app (CLI-style POST /api/apps). "
        "Vibe chat did not run: MCP https://app.base44.com/mcp/ is OAuth-only "
        f"and rejected BASE44_API_KEY ({mcp_error[:240]})."
    )
    return PlatformResult(
        platform="base44",
        ok=False,
        method="rest_scaffold",
        editor_url=editor_url,
        preview_url=None,
        transcript=transcript,
        error="Base44 vibe MCP needs OAuth; API key only scaffolds a blank app",
        extra={"app_id": app_id, "slug": slug, "name": created.get("name")},
    )


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
    run_env["OPENROUTER_API_KEY"] = _live_openrouter_key(env)
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


def lovable_headers(api_key: str) -> dict[str, str]:
    return {
        "Lovable-API-Key": api_key,
        "X-Client-Source": "sdk",
        "Accept": "application/json",
    }


def lovable_api(
    prompt: str,
    wait_seconds: int,
    api_key: str,
    workspace_id: str,
    project_name: str,
) -> PlatformResult:
    headers = lovable_headers(api_key)
    if not workspace_id:
        workspaces, _ = json_request("GET", f"{LOVABLE_API}/v1/workspaces", headers=headers, timeout=30)
        items = _list_from(workspaces, "data", "workspaces")
        if not items:
            raise RuntimeError("Lovable returned no workspaces for this API key")
        workspace_id = str(items[0].get("id") or items[0].get("workspace_id") or "")
        if not workspace_id:
            raise RuntimeError(f"Lovable workspace list missing id: {items[0]!r}")
    name = project_name or f"spine-compare-{int(time.time())}"
    created, _ = json_request(
        "POST",
        f"{LOVABLE_API}/v1/projects",
        headers=headers,
        body={
            "workspace_id": workspace_id,
            "description": prompt[:500],
            "display_name": name,
            "initial_message": prompt,
        },
        timeout=60,
    )
    if not isinstance(created, dict):
        raise RuntimeError(f"unexpected Lovable create response: {created!r}")
    project_id = str(created.get("id") or "")
    if not project_id:
        raise RuntimeError(f"Lovable create missing project id: {created!r}")
    message_id = str(created.get("message_id") or "")
    editor_url = f"https://lovable.dev/projects/{project_id}"
    preview_url = f"https://id-preview--{project_id}.lovable.app"
    transcript = _wait_lovable_messages(headers, project_id, message_id, wait_seconds)
    project, _ = json_request("GET", f"{LOVABLE_API}/v1/projects/{project_id}", headers=headers, timeout=30)
    screenshot = None
    if isinstance(project, dict):
        screenshot = project.get("latest_screenshot_url") or project.get("embed_url")
        if project.get("url"):
            preview_url = str(project["url"])
        if project.get("embed_url"):
            preview_url = str(project["embed_url"])
    return PlatformResult(
        platform="lovable",
        ok=True,
        method="api_key",
        editor_url=editor_url,
        preview_url=preview_url,
        screenshot_url=str(screenshot) if screenshot else None,
        transcript=transcript or "(no assistant text yet — build still running)",
        extra={"project_id": project_id, "workspace_id": workspace_id, "message_id": message_id},
    )


def _wait_lovable_messages(headers: dict[str, str], project_id: str, message_id: str, wait_seconds: int) -> str:
    deadline = time.monotonic() + max(wait_seconds, 5)
    chunks: list[str] = []
    while time.monotonic() < deadline:
        remaining = max(1, int(deadline - time.monotonic()))
        wait = str(min(30, remaining)) + "s"
        try:
            if message_id:
                body, _ = json_request(
                    "GET",
                    f"{LOVABLE_API}/v1/messages/{message_id}",
                    headers=headers,
                    query={"project_id": project_id, "wait": wait},
                    timeout=min(45, remaining + 5),
                )
                text = _message_text(body)
                if text:
                    chunks.append(text)
                status = _message_status(body)
                if status in {"completed", "stopped", "error", "awaiting_input"}:
                    break
            else:
                body, _ = json_request(
                    "GET",
                    f"{LOVABLE_API}/v1/messages",
                    headers=headers,
                    query={"project_id": project_id, "limit": "20"},
                    timeout=30,
                )
                text = _join_messages(body)
                if text:
                    chunks.append(text)
                    break
        except HttpError as exc:
            chunks.append(f"[poll HTTP {exc.status}] {exc.body[:200]}")
            if exc.status in {401, 403}:
                break
        time.sleep(2)
    return "\n\n".join(dict.fromkeys(chunks))


def _message_text(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    for key in ("content", "text", "summary", "message"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    inner = body.get("message")
    if isinstance(inner, dict):
        return _message_text(inner)
    return ""


def _message_status(body: Any) -> str:
    if isinstance(body, dict):
        return str(body.get("status") or "")
    return ""


def _join_messages(body: Any) -> str:
    items = _list_from(body, "messages", "data")
    parts: list[str] = []
    for item in items:
        role = str(item.get("role") or item.get("author") or "")
        text = _message_text(item)
        if text:
            parts.append(f"{role}: {text}" if role else text)
    return "\n\n".join(parts)


def _list_from(body: Any, *keys: str) -> list[JsonDict]:
    if isinstance(body, list):
        return [x for x in body if isinstance(x, dict)]
    if not isinstance(body, dict):
        return []
    for key in keys:
        value = body.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]
    return []


def mcp_create(
    *,
    platform: PlatformName,
    url: str,
    token: str,
    prompt: str,
    wait_seconds: int,
    tool_names: tuple[str, ...],
    extra_args: JsonDict,
) -> PlatformResult:
    session = mcp_connect(url, token)
    listed = session.call("tools/list", timeout=30)
    tools = _list_from(listed, "tools")
    tool = pick_tool(tools, tool_names)
    if tool is None:
        names = [str(t.get("name")) for t in tools]
        raise RuntimeError(f"{platform} MCP has no create tool {tool_names}; got {names}")
    args = tool_arguments(tool, prompt, extra_args)
    created = session.call("tools/call", {"name": tool["name"], "arguments": args}, timeout=max(60, wait_seconds))
    text = _mcp_text(created)
    urls = _urls_from(created)
    preview = urls.get("preview") or urls.get("replUrl") or urls.get("preview_url")
    editor = urls.get("editor") or urls.get("replUrl") or urls.get("url") or urls.get("editor_url")
    extra: JsonDict = {"tool": tool["name"], "arguments_keys": sorted(args.keys())}
    if isinstance(created, dict):
        extra["raw_keys"] = sorted(created.keys())
    # AI : poll get_app_status / ask_question when those tools exist.
    status_tool = pick_tool(tools, ("get_app_status", "ask_question", "get_app_preview_url"))
    if status_tool and wait_seconds > 5:
        follow = _mcp_poll(session, status_tool, created, wait_seconds)
        if follow:
            text = (text + "\n\n" + follow).strip()
            more = _urls_from_text(follow)
            preview = preview or more.get("preview")
            editor = editor or more.get("editor")
    return PlatformResult(
        platform=platform,
        ok=True,
        method="mcp",
        editor_url=editor,
        preview_url=preview,
        transcript=text or json_pretty(created),
        extra=extra,
    )


def _mcp_poll(session: Any, tool: JsonDict, created: Any, wait_seconds: int) -> str:
    ids = _ids_from(created)
    if not ids:
        return ""
    deadline = time.monotonic() + wait_seconds
    last = ""
    while time.monotonic() < deadline:
        args: JsonDict = {}
        props = (tool.get("inputSchema") or {}).get("properties") or {}
        for key, value in ids.items():
            if key in props:
                args[key] = value
        if not args:
            first = next(iter((tool.get("inputSchema") or {}).get("required") or props.keys()), None)
            if first:
                args[first] = next(iter(ids.values()))
        try:
            body = session.call("tools/call", {"name": tool["name"], "arguments": args}, timeout=45)
            last = _mcp_text(body) or last
            if any(word in last.lower() for word in ("complete", "ready", "published", "preview")):
                return last
        except Exception:  # noqa: BLE001
            break
        time.sleep(8)
    return last


def _mcp_text(body: Any) -> str:
    if isinstance(body, str):
        return body
    if not isinstance(body, dict):
        return ""
    content = body.get("content")
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") in {None, "text"}:
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts).strip()
    if isinstance(content, str):
        return content
    return _message_text(body)


def _urls_from(body: Any) -> dict[str, str]:
    found: dict[str, str] = {}
    if isinstance(body, dict):
        structured = body.get("structuredContent") or body.get("structured_content") or {}
        blob: JsonDict = dict(body)
        if isinstance(structured, dict):
            blob.update(structured)
        for key in ("preview_url", "previewUrl", "replUrl", "editor_url", "url", "app_url"):
            value = blob.get(key)
            if isinstance(value, str) and value.startswith("http"):
                found[key] = value
                if "preview" in key.lower():
                    found["preview"] = value
                if "editor" in key.lower() or "repl" in key.lower():
                    found["editor"] = value
        found.update(_urls_from_text(_mcp_text(body)))
    return found


def _urls_from_text(text: str) -> dict[str, str]:
    import re

    found: dict[str, str] = {}
    for match in re.findall(r"https?://[^\s)>\"]+", text):
        url = match.rstrip(".,")
        if "preview" in url:
            found.setdefault("preview", url)
        else:
            found.setdefault("editor", url)
    return found


def _ids_from(body: Any) -> dict[str, str]:
    found: dict[str, str] = {}
    if not isinstance(body, dict):
        return found
    structured = body.get("structuredContent") or body.get("structured_content") or {}
    blob: JsonDict = dict(body)
    if isinstance(structured, dict):
        blob.update(structured)
    for key in ("replId", "repl_id", "app_id", "appId", "project_id", "projectId", "id"):
        value = blob.get(key)
        if isinstance(value, str) and value:
            found[key] = value
    return found


def json_pretty(value: Any) -> str:
    import json

    try:
        return json.dumps(value, indent=2)
    except TypeError:
        return str(value)


def ensure_auth_dir() -> Path:
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    return AUTH_DIR
