#!/usr/bin/env python3
# AI : JSON HTTP + a small Streamable-HTTP MCP client for Replit / Base44 tokens.
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin

JsonDict = dict[str, Any]
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


class HttpError(RuntimeError):
    def __init__(self, status: int, body: str, url: str):
        super().__init__(f"HTTP {status} {url}: {body[:400]}")
        self.status = status
        self.body = body
        self.url = url


def json_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: JsonDict | None = None,
    query: dict[str, str] | None = None,
    timeout: int = 60,
    _hops: int = 0,
) -> tuple[Any, dict[str, str]]:
    if query:
        url = url + ("&" if "?" in url else "?") + urlencode(query)
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Accept", "application/json, text/event-stream")
    req.add_header("User-Agent", BROWSER_UA)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            parsed = _parse_body(raw, resp_headers.get("content-type", ""))
            return parsed, resp_headers
    except urllib.error.HTTPError as exc:
        loc = exc.headers.get("Location")
        if exc.code in {301, 302, 307, 308} and loc:
            nxt = urljoin(url, loc)
            if nxt != url and _hops < 3:
                return json_request(method, nxt, headers=headers, body=body, timeout=timeout, _hops=_hops + 1)
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        raise HttpError(exc.code, raw, url) from exc


def _parse_body(raw: str, content_type: str) -> Any:
    stripped = raw.strip()
    if not stripped:
        return None
    if "text/event-stream" in content_type or stripped.startswith("event:") or stripped.startswith("data:"):
        events = parse_sse_json(stripped)
        return events[-1] if events else None
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return {"raw": stripped}


def parse_sse_json(raw: str) -> list[Any]:
    events: list[Any] = []
    data_lines: list[str] = []
    for line in raw.splitlines():
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
            continue
        if line == "" and data_lines:
            blob = "\n".join(data_lines)
            data_lines = []
            try:
                events.append(json.loads(blob))
            except json.JSONDecodeError:
                events.append({"raw": blob})
    if data_lines:
        blob = "\n".join(data_lines)
        try:
            events.append(json.loads(blob))
        except json.JSONDecodeError:
            events.append({"raw": blob})
    return events


def download_url(url: str, dest: Path, timeout: int = 30) -> bool:
    if not url.startswith("http"):
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, method="GET")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            dest.write_bytes(resp.read())
        return dest.exists() and dest.stat().st_size > 0
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def jsonrpc(method: str, params: JsonDict | None, req_id: int) -> JsonDict:
    payload: JsonDict = {"jsonrpc": "2.0", "method": method, "id": req_id}
    if params is not None:
        payload["params"] = params
    return payload


@dataclass
class McpSession:
    url: str
    headers: dict[str, str]
    session_id: str | None = None
    _next_id: int = 1

    def call(self, method: str, params: JsonDict | None = None, *, timeout: int = 90) -> Any:
        req_id = self._next_id
        self._next_id += 1
        body, headers = json_request(
            "POST",
            self.url,
            headers=self._headers(),
            body=jsonrpc(method, params, req_id),
            timeout=timeout,
        )
        sid = headers.get("mcp-session-id")
        if sid:
            self.session_id = sid
        if isinstance(body, dict) and body.get("error"):
            raise RuntimeError(f"MCP {method} error: {body['error']}")
        if isinstance(body, dict) and "result" in body:
            return body["result"]
        return body

    def notify(self, method: str, params: JsonDict | None = None, *, timeout: int = 30) -> None:
        try:
            json_request(
                "POST",
                self.url,
                headers=self._headers(),
                body={"jsonrpc": "2.0", "method": method, **({"params": params} if params else {})},
                timeout=timeout,
            )
        except HttpError:
            # AI : some servers 202/204-equivalent via empty or non-JSON; ignore notify failures.
            return

    def _headers(self) -> dict[str, str]:
        headers = dict(self.headers)
        headers.setdefault("MCP-Protocol-Version", "2025-03-26")
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        return headers


def mcp_connect(url: str, token: str, *, extra_headers: dict[str, str] | None = None) -> McpSession:
    headers = {
        "Authorization": f"Bearer {token}",
        **(extra_headers or {}),
    }
    session = McpSession(url=url, headers=headers)
    session.call(
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "spine-competitor-compare", "version": "0.1"},
        },
    )
    session.notify("notifications/initialized")
    return session


PROMPT_ARG_NAMES = (
    "appDescription",
    "description",
    "prompt",
    "message",
    "initial_message",
    "text",
    "query",
)


def pick_tool(tools: list[JsonDict], names: tuple[str, ...]) -> JsonDict | None:
    by_name = {str(t.get("name", "")): t for t in tools}
    for name in names:
        if name in by_name:
            return by_name[name]
    return None


def tool_arguments(tool: JsonDict, prompt: str, extra: JsonDict | None = None) -> JsonDict:
    schema = tool.get("inputSchema") or tool.get("input_schema") or {}
    props: JsonDict = schema.get("properties") or {}
    required = list(schema.get("required") or [])
    args: JsonDict = dict(extra or {})
    prompt_key = None
    for name in PROMPT_ARG_NAMES:
        if name in props:
            prompt_key = name
            break
    if prompt_key is None and required:
        prompt_key = required[0]
    if prompt_key:
        args[prompt_key] = prompt
    for key in required:
        if key in args:
            continue
        spec = props.get(key) or {}
        if "default" in spec:
            args[key] = spec["default"]
            continue
        enum = spec.get("enum")
        if isinstance(enum, list) and enum:
            args[key] = enum[0]
    return args
