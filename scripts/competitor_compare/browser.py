#!/usr/bin/env python3
# AI : Playwright login + live tiled windows + optional recorded browser runs.
from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

from .harness import (
    PlatformName,
    PlatformResult,
    PLATFORM_HOME,
    start_urls,
    storage_state_path,
)
from .drivers import ensure_auth_dir

PROMPT_SELECTORS = (
    "textarea",
    '[contenteditable="true"]',
    "div[role='textbox']",
    "input[type='text']",
)
SUBMIT_NAMES = ("send", "build", "create", "generate", "submit", "go", "start")
SIGNED_IN_HINTS = (
    "projects",
    "workspace",
    "dashboard",
    "agent",
    "apps",
    "editor",
)


def require_playwright() -> Any:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright is not installed. Run:\n"
            "  python3 -m pip install -r scripts/competitor_compare/requirements.txt\n"
            "  python3 -m playwright install chromium"
        ) from exc
    return sync_playwright


def login_platform(platform: PlatformName, *, timeout_seconds: int = 300) -> Path:
    ensure_auth_dir()
    dest = storage_state_path(platform)
    sync_playwright = require_playwright()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto(PLATFORM_HOME[platform], wait_until="domcontentloaded")
        print(f"Log in to {platform} in the opened window.")
        if sys.stdin.isatty():
            input("Press Enter here once you are signed in… ")
        else:
            print(f"No TTY — waiting up to {timeout_seconds}s for a signed-in URL…")
            deadline = time.monotonic() + timeout_seconds
            while time.monotonic() < deadline:
                url = page.url.lower()
                if any(h in url for h in SIGNED_IN_HINTS) and "login" not in url and "signin" not in url:
                    break
                page.wait_for_timeout(1000)
        context.storage_state(path=str(dest))
        browser.close()
    if not dest.exists():
        raise RuntimeError(f"failed to save {platform} session")
    print(f"Saved {platform} session to {dest}")
    return dest


def live_side_by_side(prompt: str, platforms: tuple[PlatformName, ...], *, hold_seconds: int = 0) -> None:
    sync_playwright = require_playwright()
    urls = start_urls(prompt)
    width = 640
    with sync_playwright() as p:
        browsers = []
        pages = []
        for index, platform in enumerate(platforms):
            browser = p.chromium.launch(
                headless=False,
                args=[f"--window-position={index * width},0", f"--window-size={width},1000"],
            )
            state = storage_state_path(platform)
            context = browser.new_context(storage_state=str(state) if state.exists() else None)
            page = context.new_page()
            page.goto(urls[platform], wait_until="domcontentloaded")
            _maybe_fill_prompt(page, prompt)
            browsers.append(browser)
            pages.append(page)
        print("Three windows are open with the same prompt. Close them or Ctrl+C when done.")
        if hold_seconds > 0:
            time.sleep(hold_seconds)
            for browser in browsers:
                browser.close()
            return
        try:
            while True:
                time.sleep(1)
                if all(not b.is_connected() for b in browsers):
                    break
        except KeyboardInterrupt:
            pass
        for browser in browsers:
            try:
                browser.close()
            except Exception:  # noqa: BLE001
                pass


def browser_run(platform: PlatformName, prompt: str, wait_seconds: int, *, out_dir: Path | None = None) -> PlatformResult:
    sync_playwright = require_playwright()
    state = storage_state_path(platform)
    if not state.exists():
        return PlatformResult(
            platform=platform,
            ok=False,
            method="browser",
            skipped=True,
            error=f"missing {state}; run login --platform {platform}",
        )
    urls = start_urls(prompt)
    started = time.monotonic()
    transcript = ""
    editor_url = urls[platform]
    screenshot_written = False
    video_path: Path | None = None
    with sync_playwright() as p:
        context_kwargs: dict[str, Any] = {"storage_state": str(state)}
        if out_dir is not None:
            video_dir = out_dir / platform / "playwright-video"
            video_dir.mkdir(parents=True, exist_ok=True)
            context_kwargs["record_video_dir"] = str(video_dir)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**context_kwargs)
        page = context.new_page()
        page.goto(urls[platform], wait_until="domcontentloaded", timeout=60_000)
        _maybe_fill_prompt(page, prompt)
        _maybe_submit(page)
        page.wait_for_timeout(min(wait_seconds, 15) * 1000)
        deadline = time.monotonic() + wait_seconds
        while time.monotonic() < deadline:
            transcript = _extract_transcript(page)
            if len(transcript) > 80:
                break
            page.wait_for_timeout(3000)
        editor_url = page.url
        if out_dir is not None:
            shot = out_dir / platform / "screenshot.png"
            shot.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(shot), full_page=True)
            screenshot_written = shot.exists()
        page_video = page.video
        context.close()
        browser.close()
        if page_video is not None and out_dir is not None:
            dest = out_dir / platform / "video.webm"
            try:
                page_video.save_as(str(dest))
                video_path = dest
            except Exception:  # noqa: BLE001
                video_path = None
    return PlatformResult(
        platform=platform,
        ok=bool(transcript) or screenshot_written,
        method="browser",
        editor_url=editor_url,
        transcript=transcript or "(browser opened; no assistant text extracted yet)",
        elapsed_ms=int((time.monotonic() - started) * 1000),
        extra={"video": str(video_path) if video_path else None},
    )


def _maybe_fill_prompt(page: Any, prompt: str) -> None:
    for selector in PROMPT_SELECTORS:
        loc = page.locator(selector).first
        try:
            if loc.count() == 0:
                continue
            loc.click(timeout=2000)
            loc.fill(prompt, timeout=3000)
            return
        except Exception:  # noqa: BLE001
            try:
                loc.click(timeout=1000)
                page.keyboard.type(prompt, delay=5)
                return
            except Exception:  # noqa: BLE001
                continue


def _maybe_submit(page: Any) -> None:
    try:
        page.keyboard.press("Enter")
    except Exception:  # noqa: BLE001
        pass
    for name in SUBMIT_NAMES:
        btn = page.get_by_role("button", name=name)
        try:
            if btn.count() > 0:
                btn.first.click(timeout=1500)
                return
        except Exception:  # noqa: BLE001
            continue


def _extract_transcript(page: Any) -> str:
    try:
        return str(page.inner_text("body"))[:12000]
    except Exception:  # noqa: BLE001
        return ""
