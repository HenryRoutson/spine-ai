#!/usr/bin/env python3
# AI : shared types, env loading, prompt library, run folders, and the compare.html viewer.
from __future__ import annotations

import html
import json
import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent.parent
PACKAGE = Path(__file__).resolve().parent
PROMPTS_FILE = PACKAGE / "prompts.md"
RUNS_DIR = ROOT / "competitor_runs"
AUTH_DIR = ROOT / ".competitor_compare" / "auth"
ENV_FILE = ROOT / ".env"

PlatformName = Literal["lovable", "replit", "base44"]
PLATFORMS: tuple[PlatformName, ...] = ("lovable", "replit", "base44")

PLATFORM_HOME: dict[PlatformName, str] = {
    "lovable": "https://lovable.dev/",
    "replit": "https://replit.com/",
    "base44": "https://app.base44.com/",
}


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def mask_secret(value: str) -> str:
    if len(value) <= 8:
        return "***"
    return f"{value[:4]}…{value[-4:]}"


def read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, raw = stripped.split("=", 1)
        value = raw.strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = value[1:-1]
        values[key.strip()] = value
    return values


def load_env() -> dict[str, str]:
    # AI : file first, process env wins so Cloud Agent secrets override a local .env.
    merged = read_env_file(ENV_FILE)
    for key, value in os.environ.items():
        if value != "":
            merged[key] = value
    return merged


def env_get(env: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = env.get(key, "").strip()
        if value:
            return value
    return ""


def storage_state_path(platform: PlatformName) -> Path:
    return AUTH_DIR / f"{platform}.json"


@dataclass(frozen=True)
class PromptSpec:
    prompt_id: str
    text: str


def parse_prompts_markdown(text: str) -> list[PromptSpec]:
    prompts: list[PromptSpec] = []
    current_id: str | None = None
    body: list[str] = []
    for line in text.splitlines():
        if line.startswith("# "):
            if current_id is not None:
                prompts.append(PromptSpec(current_id, "\n".join(body).strip()))
            current_id = line[2:].strip()
            body = []
            continue
        if current_id is not None:
            body.append(line)
    if current_id is not None:
        prompts.append(PromptSpec(current_id, "\n".join(body).strip()))
    return [p for p in prompts if p.prompt_id and p.text]


def load_prompt_library(path: Path = PROMPTS_FILE) -> list[PromptSpec]:
    if not path.exists():
        return []
    return parse_prompts_markdown(path.read_text(encoding="utf-8"))


def resolve_prompt(
    *,
    prompt: str | None,
    prompt_id: str | None,
    prompt_file: Path | None,
    library: list[PromptSpec] | None = None,
) -> PromptSpec:
    if prompt and prompt.strip():
        return PromptSpec("custom", prompt.strip())
    if prompt_file is not None:
        text = prompt_file.read_text(encoding="utf-8").strip()
        if not text:
            raise ValueError(f"prompt file is empty: {prompt_file}")
        return PromptSpec(prompt_file.stem, text)
    specs = library if library is not None else load_prompt_library()
    if not specs:
        raise ValueError(f"no prompts in {PROMPTS_FILE}")
    if prompt_id:
        for spec in specs:
            if spec.prompt_id == prompt_id:
                return spec
        known = ", ".join(s.prompt_id for s in specs)
        raise ValueError(f"unknown prompt-id {prompt_id!r}; known: {known}")
    return specs[0]


def lovable_autosubmit_url(prompt: str) -> str:
    return f"https://lovable.dev/?autosubmit=true#prompt={quote(prompt, safe='')}"


def replit_agent_url(prompt: str) -> str:
    return f"https://replit.com/?tab=agent#prompt={quote(prompt, safe='')}"


def base44_start_url(prompt: str) -> str:
    return f"https://app.base44.com/?prompt={quote(prompt, safe='')}"


def start_urls(prompt: str) -> dict[PlatformName, str]:
    return {
        "lovable": lovable_autosubmit_url(prompt),
        "replit": replit_agent_url(prompt),
        "base44": base44_start_url(prompt),
    }


@dataclass
class PlatformResult:
    platform: PlatformName
    ok: bool
    method: str
    skipped: bool = False
    editor_url: str | None = None
    preview_url: str | None = None
    screenshot_url: str | None = None
    transcript: str = ""
    error: str | None = None
    elapsed_ms: int = 0
    extra: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


def new_run_dir(prompt: PromptSpec, runs_dir: Path | None = None) -> Path:
    slug = re.sub(r"[^a-z0-9]+", "-", prompt.prompt_id.lower()).strip("-") or "prompt"
    base = runs_dir if runs_dir is not None else RUNS_DIR
    path = base / f"{utc_stamp()}_{slug}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_run_files(
    run_dir: Path,
    prompt: PromptSpec,
    results: list[PlatformResult],
    *,
    start_url_map: dict[PlatformName, str],
) -> Path:
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "prompt.md").write_text(prompt.text + "\n", encoding="utf-8")
    for result in results:
        platform_dir = run_dir / result.platform
        platform_dir.mkdir(parents=True, exist_ok=True)
        (platform_dir / "result.json").write_text(
            json.dumps(result.to_json(), indent=2) + "\n", encoding="utf-8"
        )
        (platform_dir / "transcript.md").write_text(
            (result.transcript or result.error or "").rstrip() + "\n", encoding="utf-8"
        )
        if result.editor_url:
            (platform_dir / "editor_url.txt").write_text(result.editor_url + "\n", encoding="utf-8")
        if result.preview_url:
            (platform_dir / "preview_url.txt").write_text(result.preview_url + "\n", encoding="utf-8")
    manifest = {
        "prompt_id": prompt.prompt_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "start_urls": start_url_map,
        "results": [r.to_json() for r in results],
    }
    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    compare_path = run_dir / "compare.html"
    compare_path.write_text(
        render_compare_html(prompt, results, start_url_map, run_dir=run_dir),
        encoding="utf-8",
    )
    return compare_path


def _rel_if_exists(run_dir: Path, *parts: str) -> str | None:
    path = run_dir.joinpath(*parts)
    if path.exists():
        return "/".join(parts)
    return None


def render_compare_html(
    prompt: PromptSpec,
    results: list[PlatformResult],
    start_url_map: dict[PlatformName, str],
    *,
    run_dir: Path | None = None,
) -> str:
    by_name = {r.platform: r for r in results}
    columns: list[str] = []
    for name in PLATFORMS:
        result = by_name.get(name) or PlatformResult(name, False, "missing", skipped=True)
        screenshot = None
        video = None
        if run_dir is not None:
            screenshot = (
                _rel_if_exists(run_dir, name, "screenshot.png")
                or _rel_if_exists(run_dir, name, "screenshot.jpg")
                or _rel_if_exists(run_dir, name, "screenshot.webp")
            )
            video = _rel_if_exists(run_dir, name, "video.webm")
        status = "ok" if result.ok else ("skipped" if result.skipped else "error")
        media = ""
        if screenshot:
            media += f'<img class="shot" src="{html.escape(screenshot)}" alt="{name} screenshot" />'
        elif result.screenshot_url:
            media += f'<img class="shot" src="{html.escape(result.screenshot_url)}" alt="{name} screenshot" />'
        if video:
            media += f'<video class="shot" src="{html.escape(video)}" controls></video>'
        links: list[str] = []
        if result.editor_url:
            links.append(f'<a href="{html.escape(result.editor_url)}">editor</a>')
        if result.preview_url:
            links.append(f'<a href="{html.escape(result.preview_url)}">preview</a>')
        start = start_url_map.get(name)
        if start:
            links.append(f'<a href="{html.escape(start)}">start url</a>')
        body = result.transcript or result.error or "(no output yet)"
        columns.append(
            f"""
<section class="col {status}">
  <header>
    <h2>{html.escape(name)}</h2>
    <p class="meta">{html.escape(result.method)} · {status} · {result.elapsed_ms}ms</p>
    <p class="links">{" · ".join(links) if links else "no links"}</p>
  </header>
  {media}
  <pre>{html.escape(body)}</pre>
</section>
"""
        )
    cols = "\n".join(columns)
    prompt_html = html.escape(prompt.text)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Compare {html.escape(prompt.prompt_id)}</title>
  <style>
    :root {{ color-scheme: dark; }}
    body {{ margin: 0; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; background: #0f1115; color: #e8eaed; }}
    h1 {{ margin: 0 0 8px; font-size: 18px; }}
    .wrap {{ padding: 16px 20px 24px; }}
    .prompt {{ white-space: pre-wrap; background: #1a1d24; border: 1px solid #2a2f3a; border-radius: 10px; padding: 12px 14px; margin: 0 0 16px; }}
    .grid {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }}
    .col {{ background: #161920; border: 1px solid #2a2f3a; border-radius: 12px; min-width: 0; overflow: hidden; }}
    .col.ok {{ border-color: #2e7d4f; }}
    .col.error {{ border-color: #8a3b3b; }}
    .col.skipped {{ border-color: #5a5f6a; }}
    .col header {{ padding: 12px 14px 8px; border-bottom: 1px solid #2a2f3a; }}
    .col h2 {{ margin: 0; text-transform: capitalize; }}
    .meta, .links {{ margin: 4px 0 0; color: #9aa3b2; font-size: 12px; }}
    .links a {{ color: #8ab4ff; }}
    pre {{ margin: 0; padding: 12px 14px; white-space: pre-wrap; overflow: auto; max-height: 70vh; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }}
    img.shot, video.shot {{ display: block; width: 100%; background: #0b0d11; }}
    @media (max-width: 1100px) {{ .grid {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Lovable · Replit · Base44 — {html.escape(prompt.prompt_id)}</h1>
    <div class="prompt">{prompt_html}</div>
    <div class="grid">
      {cols}
    </div>
  </div>
</body>
</html>
"""


def attach_local_media(run_dir: Path, results: list[PlatformResult], start_url_map: dict[PlatformName, str], prompt: PromptSpec) -> Path:
    # AI : rewrite compare.html after drivers drop screenshots/videos on disk.
    return write_run_files(run_dir, prompt, results, start_url_map=start_url_map)


def list_runs(runs_dir: Path | None = None) -> list[Path]:
    base = runs_dir if runs_dir is not None else RUNS_DIR
    if not base.exists():
        return []
    return sorted(
        [p for p in base.iterdir() if p.is_dir() and (p / "compare.html").exists()],
        reverse=True,
    )
