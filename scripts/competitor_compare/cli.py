#!/usr/bin/env python3
"""Run Spine vibe on a prompt and write a result folder.

Examples:
  python3 scripts/competitor_compare.py check
  python3 scripts/competitor_compare.py urls --prompt-id kyc
  python3 scripts/competitor_compare.py record --prompt-id kyc
  python3 scripts/competitor_compare.py serve
"""
from __future__ import annotations

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .drivers import credential_status, run_platform
from .harness import (
    ALL_PLATFORMS,
    PLATFORMS,
    PlatformName,
    PlatformResult,
    PromptSpec,
    ROOT,
    RUNS_DIR,
    list_runs,
    load_env,
    load_prompt_library,
    new_run_dir,
    resolve_prompt,
    start_urls,
    write_run_files,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="show which platforms have credentials")
    sub.add_parser("prompts", help="list built-in prompt ids")
    sub.add_parser("list", help="list recorded run folders")

    urls = sub.add_parser("urls", help="print start URLs for the same prompt")
    _add_prompt_flags(urls)

    record = sub.add_parser("record", help="send the prompt to Spine vibe and write a run folder")
    _add_prompt_flags(record)
    record.add_argument("--platforms", default="spine", help="spine only")
    record.add_argument("--wait", type=int, default=180, help="seconds to wait for a first response")
    record.add_argument("--name", default="", help="project name prefix on the platforms")
    record.add_argument("--dry-run", action="store_true", help="write the folder without calling APIs")
    record.add_argument("--sequential", action="store_true", help="run platforms one after another")
    record.add_argument("--out", default="", help="run folder (default competitor_runs/<timestamp>_<id>)")

    serve = sub.add_parser("serve", help="serve the latest (or given) compare.html")
    serve.add_argument("run_dir", nargs="?", default="")
    serve.add_argument("--port", type=int, default=8765)
    return parser


def _add_prompt_flags(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--prompt", default="", help="prompt text")
    parser.add_argument("--prompt-id", default="", help="id from scripts/competitor_compare/prompts.md")
    parser.add_argument("--prompt-file", default="", help="path to a prompt text file")


def _prompt_from(args: argparse.Namespace) -> PromptSpec:
    prompt_file = Path(args.prompt_file).expanduser() if args.prompt_file else None
    return resolve_prompt(
        prompt=args.prompt or None,
        prompt_id=args.prompt_id or None,
        prompt_file=prompt_file,
    )


def _platforms(raw: str) -> tuple[PlatformName, ...]:
    if raw.strip() in {"", "all"}:
        return PLATFORMS
    picked: list[PlatformName] = []
    for part in raw.split(","):
        name = part.strip().lower()
        if name not in ALL_PLATFORMS:
            raise SystemExit(f"unknown platform {part!r}; expected {', '.join(ALL_PLATFORMS)}")
        picked.append(name)  # type: ignore[arg-type]
    return tuple(picked)


def cmd_check() -> int:
    rows = credential_status()
    width = max(len(r.platform) for r in rows)
    ready_n = 0
    for row in rows:
        flag = "READY" if row.ready else "NEED "
        print(f"{row.platform:<{width}}  {flag}  {row.method:<14}  {row.hint}")
        ready_n += int(row.ready)
    print()
    if ready_n == 0:
        print("No credentials yet. See docs/competitor_compare_keys.md")
        print("  Cloud: add OPENROUTER_API_KEY, then start a new agent.")
        return 1
    print("Spine vibe ready — python3 scripts/competitor_compare.py record --prompt-id kyc")
    return 0


def cmd_prompts() -> int:
    for spec in load_prompt_library():
        preview = spec.text.splitlines()[0][:80]
        print(f"{spec.prompt_id:12}  {preview}")
    return 0


def cmd_list() -> int:
    runs = list_runs()
    if not runs:
        print(f"no runs in {RUNS_DIR}")
        return 0
    for path in runs:
        print(path)
    return 0


def cmd_urls(args: argparse.Namespace) -> int:
    prompt = _prompt_from(args)
    for name, url in start_urls(prompt.text).items():
        print(f"{name:8}  {url}")
    return 0


def cmd_record(args: argparse.Namespace) -> int:
    prompt = _prompt_from(args)
    platforms = _platforms(args.platforms)
    env = load_env()
    run_dir = Path(args.out).expanduser().resolve() if args.out else new_run_dir(prompt)
    run_dir.mkdir(parents=True, exist_ok=True)
    urls = start_urls(prompt.text)
    print(f"run dir: {run_dir}")
    browser_runner = None if args.dry_run else _browser_runner(run_dir)
    project_name = args.name.strip() or f"spine-compare-{run_dir.name}"

    def work(platform: PlatformName) -> PlatformResult:
        print(f"→ {platform}")
        return run_platform(
            platform,
            prompt.text,
            wait_seconds=args.wait,
            env=env,
            dry_run=args.dry_run,
            browser_runner=browser_runner,
            project_name=project_name,
        )

    results: list[PlatformResult] = []
    if args.sequential or args.dry_run:
        results = [work(p) for p in platforms]
    else:
        with ThreadPoolExecutor(max_workers=len(platforms)) as pool:
            futs = {pool.submit(work, p): p for p in platforms}
            by_name: dict[str, PlatformResult] = {}
            for fut in as_completed(futs):
                result = fut.result()
                by_name[result.platform] = result
                flag = "ok" if result.ok else ("skip" if result.skipped else "fail")
                print(f"← {result.platform} {flag}")
            results = [by_name[p] for p in platforms if p in by_name]
    _save_remote_screenshots(run_dir, results)
    compare = write_run_files(run_dir, prompt, results, start_url_map=urls)
    print(f"compare: {compare}")
    print(f"serve:   python3 scripts/competitor_compare.py serve {run_dir}")
    failed = [r for r in results if not r.ok and not r.skipped]
    skipped = [r for r in results if r.skipped]
    if skipped:
        print("skipped: " + ", ".join(f"{r.platform} ({r.error})" for r in skipped))
    return 1 if failed else 0


def _save_remote_screenshots(run_dir: Path, results: list[PlatformResult]) -> None:
    from .http_util import download_url

    for result in results:
        if not result.screenshot_url:
            continue
        dest = run_dir / result.platform / "screenshot.png"
        if dest.exists():
            continue
        download_url(result.screenshot_url, dest)


def _browser_runner(run_dir: Path):
    def run(platform: PlatformName, prompt: str, wait_seconds: int) -> PlatformResult:
        from .browser import browser_run

        return browser_run(platform, prompt, wait_seconds, out_dir=run_dir)

    return run


def cmd_serve(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir) if args.run_dir else None
    if run_dir is None:
        runs = list_runs()
        if not runs:
            raise SystemExit("no recorded runs yet — python3 scripts/competitor_compare.py record --dry-run --prompt-id kyc")
        run_dir = runs[0]
    run_dir = run_dir.resolve()
    if not (run_dir / "compare.html").exists():
        raise SystemExit(f"no compare.html in {run_dir}")

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(run_dir), **kw)

        def log_message(self, fmt: str, *log_args: object) -> None:
            sys.stderr.write("%s\n" % (fmt % log_args))

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"http://127.0.0.1:{args.port}/compare.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
    finally:
        server.server_close()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    commands = {
        "check": lambda: cmd_check(),
        "prompts": lambda: cmd_prompts(),
        "list": lambda: cmd_list(),
        "urls": lambda: cmd_urls(args),
        "record": lambda: cmd_record(args),
        "serve": lambda: cmd_serve(args),
    }
    return commands[args.cmd]()


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT / "scripts"))
    raise SystemExit(main())
