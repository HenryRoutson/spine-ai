#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from competitor_compare.cli import main
from competitor_compare.drivers import credential_status, run_platform
from competitor_compare.harness import (
    PlatformResult,
    PromptSpec,
    parse_prompts_markdown,
    render_compare_html,
    resolve_prompt,
    start_urls,
    write_run_files,
)
from competitor_compare.http_util import parse_sse_json, tool_arguments


class PromptTests(unittest.TestCase):
    def test_parse_library(self) -> None:
        md = "# kyc\nhello world\n\n# tax\nreduce tax\n"
        specs = parse_prompts_markdown(md)
        self.assertEqual([s.prompt_id for s in specs], ["kyc", "tax"])
        self.assertEqual(specs[0].text, "hello world")

    def test_resolve_inline_prompt(self) -> None:
        spec = resolve_prompt(prompt="Build a todo app", prompt_id=None, prompt_file=None, library=[])
        self.assertEqual(spec.prompt_id, "custom")
        self.assertIn("todo", spec.text)

    def test_resolve_id(self) -> None:
        library = [PromptSpec("kyc", "legal rules"), PromptSpec("tax", "tax")]
        spec = resolve_prompt(prompt=None, prompt_id="tax", prompt_file=None, library=library)
        self.assertEqual(spec.text, "tax")

    def test_builtin_kyc_exists(self) -> None:
        spec = resolve_prompt(prompt=None, prompt_id="kyc", prompt_file=None)
        self.assertIn("know your customer", spec.text.lower())


class UrlTests(unittest.TestCase):
    def test_start_urls_is_spine_only(self) -> None:
        urls = start_urls("hello")
        self.assertEqual(set(urls), {"spine"})
        self.assertIn("vibe", urls["spine"])


class CompareFolderTests(unittest.TestCase):
    def test_write_run_folder(self) -> None:
        prompt = PromptSpec("kyc", "build a kyc agent")
        results = [PlatformResult("spine", True, "vibe", editor_url="spine-cli agent ask --assistant vibe", transcript="ok")]
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp) / "run"
            compare = write_run_files(run_dir, prompt, results, start_url_map=start_urls(prompt.text))
            self.assertTrue((run_dir / "prompt.md").exists())
            self.assertTrue((run_dir / "manifest.json").exists())
            self.assertTrue((run_dir / "spine" / "transcript.md").exists())
            html = compare.read_text(encoding="utf-8")
            self.assertIn("build a kyc agent", html)
            self.assertIn("spine", html)
            self.assertNotIn("base44", html)
            self.assertNotIn("lovable", html)
            manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["prompt_id"], "kyc")
            self.assertEqual(len(manifest["results"]), 1)

    def test_render_picks_local_screenshot(self) -> None:
        prompt = PromptSpec("x", "p")
        results = [PlatformResult("spine", True, "vibe", transcript="hi")]
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp)
            shot = run_dir / "spine" / "screenshot.png"
            shot.parent.mkdir(parents=True)
            shot.write_bytes(b"png")
            html = render_compare_html(prompt, results, start_urls("p"), run_dir=run_dir)
            self.assertIn("spine/screenshot.png", html)


class CredentialTests(unittest.TestCase):
    def test_missing_keys(self) -> None:
        rows = credential_status(env={})
        self.assertEqual([r.platform for r in rows], ["spine"])
        self.assertFalse(any(r.ready for r in rows))
        self.assertIn("OPENROUTER_API_KEY", rows[0].hint)

    def test_ready_when_openrouter_set(self) -> None:
        rows = credential_status(env={"OPENROUTER_API_KEY": "sk-or-v1-abcdefghij"})
        self.assertTrue(all(r.ready for r in rows))
        self.assertNotIn("sk-or-v1-abcdefghij", rows[0].hint)

    def test_dry_run_does_not_need_credentials(self) -> None:
        result = run_platform("spine", "hello", wait_seconds=1, env={}, dry_run=True)
        self.assertTrue(result.ok)
        self.assertEqual(result.method, "dry-run")
        self.assertIn("vibe", result.editor_url or "")


class McpHelperTests(unittest.TestCase):
    def test_sse_parse(self) -> None:
        raw = 'event: message\ndata: {"jsonrpc":"2.0","result":{"ok":true}}\n\n'
        events = parse_sse_json(raw)
        self.assertEqual(events[0]["result"]["ok"], True)

    def test_tool_arguments_prefers_app_description(self) -> None:
        tool = {
            "name": "create_app_from_prompt",
            "inputSchema": {
                "type": "object",
                "required": ["appDescription", "app_stack"],
                "properties": {
                    "appDescription": {"type": "string"},
                    "app_stack": {"type": "string", "enum": ["react_website", "mobile_app"]},
                },
            },
        }
        args = tool_arguments(tool, "Build a CRM", {"app_stack": "react_website"})
        self.assertEqual(args["appDescription"], "Build a CRM")
        self.assertEqual(args["app_stack"], "react_website")


class CliSmokeTests(unittest.TestCase):
    def test_prompts_and_urls_and_dry_run(self) -> None:
        self.assertEqual(main(["prompts"]), 0)
        self.assertEqual(main(["urls", "--prompt", "hello world"]), 0)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            code = main(["record", "--dry-run", "--prompt", "spine vibe kyc test", "--out", str(out)])
            self.assertEqual(code, 0)
            html = (out / "compare.html").read_text(encoding="utf-8")
            self.assertIn("spine vibe kyc test", html)
            self.assertIn("dry-run", html)
            self.assertIn(">spine</h2>", html)
            self.assertNotIn(">lovable</h2>", html)
            self.assertNotIn(">base44</h2>", html)

    def test_record_without_credentials_skips(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            code = main(["record", "--prompt", "hello", "--out", str(out), "--wait", "1", "--sequential"])
            self.assertEqual(code, 0)
            manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["results"]), 1)
            self.assertEqual(manifest["results"][0]["platform"], "spine")


if __name__ == "__main__":
    unittest.main()
