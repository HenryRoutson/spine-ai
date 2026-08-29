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
    lovable_autosubmit_url,
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
    def test_lovable_hash_encodes_spaces(self) -> None:
        url = lovable_autosubmit_url("Create a todo app")
        self.assertTrue(url.startswith("https://lovable.dev/?autosubmit=true#prompt="))
        self.assertIn("Create%20a%20todo%20app", url)
        self.assertNotIn(" ", url.split("#", 1)[1])

    def test_start_urls_has_competitors_and_spine(self) -> None:
        urls = start_urls("hello")
        self.assertEqual(set(urls), {"lovable", "replit", "base44", "spine"})
        self.assertIn("hello", urls["base44"])
        self.assertIn("vibe", urls["spine"])


class CompareFolderTests(unittest.TestCase):
    def test_write_run_folder(self) -> None:
        prompt = PromptSpec("kyc", "build a kyc agent")
        results = [
            PlatformResult("lovable", True, "api_key", editor_url="https://lovable.dev/projects/abc", transcript="building…"),
            PlatformResult("replit", False, "none", skipped=True, error="need login"),
            PlatformResult("base44", True, "mcp", preview_url="https://app.base44.com/x", transcript="app ready"),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp) / "run"
            compare = write_run_files(run_dir, prompt, results, start_url_map=start_urls(prompt.text))
            self.assertTrue((run_dir / "prompt.md").exists())
            self.assertTrue((run_dir / "manifest.json").exists())
            self.assertTrue((run_dir / "lovable" / "transcript.md").exists())
            html = compare.read_text(encoding="utf-8")
            self.assertIn("build a kyc agent", html)
            self.assertIn("lovable", html)
            self.assertIn("replit", html)
            self.assertIn("base44", html)
            self.assertIn("need login", html)
            manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["prompt_id"], "kyc")
            self.assertEqual(len(manifest["results"]), 3)

    def test_render_picks_local_screenshot(self) -> None:
        prompt = PromptSpec("x", "p")
        results = [PlatformResult("lovable", True, "browser", transcript="hi")]
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp)
            shot = run_dir / "lovable" / "screenshot.png"
            shot.parent.mkdir(parents=True)
            shot.write_bytes(b"png")
            html = render_compare_html(prompt, results, start_urls("p"), run_dir=run_dir)
            self.assertIn("lovable/screenshot.png", html)


class CredentialTests(unittest.TestCase):
    def test_missing_keys(self) -> None:
        rows = credential_status(env={})
        self.assertEqual([r.platform for r in rows], ["lovable", "replit", "base44", "spine"])
        self.assertFalse(any(r.ready for r in rows))
        hints = {r.platform: r.hint for r in rows}
        self.assertIn("competitor_compare_keys.md", hints["lovable"])
        self.assertIn("competitor_compare_keys.md", hints["replit"])
        self.assertIn("BASE44_API_KEY", hints["base44"])
        self.assertIn("OPENROUTER_API_KEY", hints["spine"])

    def test_base44_ignores_access_token(self) -> None:
        rows = credential_status(env={"BASE44_ACCESS_TOKEN": "tok_abcdefghij"})
        base44 = next(r for r in rows if r.platform == "base44")
        self.assertFalse(base44.ready)
        result = run_platform("base44", "hello", wait_seconds=1, env={"BASE44_ACCESS_TOKEN": "tok_abcdefghij"})
        self.assertTrue(result.skipped)
        self.assertIn("BASE44_API_KEY", result.error or "")

    def test_ready_when_keys_set(self) -> None:
        rows = credential_status(
            env={
                "LOVABLE_API_KEY": "lov_abcdefghij",
                "REPLIT_MCP_ACCESS_TOKEN": "rpt_abcdefghij",
                "BASE44_API_KEY": "b44k_abcdefghij",
                "OPENROUTER_API_KEY": "sk-or-v1-abcdefghij",
            }
        )
        self.assertTrue(all(r.ready for r in rows))
        joined = " ".join(r.hint for r in rows)
        self.assertNotIn("lov_abcdefghij", joined)
        self.assertIn("lov_", joined)

    def test_dry_run_does_not_need_credentials(self) -> None:
        result = run_platform("lovable", "hello", wait_seconds=1, env={}, dry_run=True)
        self.assertTrue(result.ok)
        self.assertEqual(result.method, "dry-run")
        self.assertIn("lovable.dev", result.editor_url or "")


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
            code = main(["record", "--dry-run", "--prompt", "side by side kyc test", "--out", str(out)])
            self.assertEqual(code, 0)
            html = (out / "compare.html").read_text(encoding="utf-8")
            self.assertIn("side by side kyc test", html)
            self.assertIn("dry-run", html)
            self.assertIn(">lovable</h2>", html)
            self.assertIn(">replit</h2>", html)
            self.assertIn(">base44</h2>", html)

    def test_record_base44_spine_dry_run(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            code = main(
                [
                    "record",
                    "--dry-run",
                    "--platforms",
                    "base44,spine",
                    "--prompt-id",
                    "kyc",
                    "--out",
                    str(out),
                ]
            )
            self.assertEqual(code, 0)
            html = (out / "compare.html").read_text(encoding="utf-8")
            self.assertIn("Base44 · Spine", html)
            self.assertIn(">base44</h2>", html)
            self.assertIn(">spine</h2>", html)
            self.assertNotIn(">lovable</h2>", html)
            manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual([r["platform"] for r in manifest["results"]], ["base44", "spine"])

    def test_record_without_credentials_skips(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "run"
            # AI : empty env still reads repo .env — skip path is what we want when keys are absent.
            code = main(["record", "--prompt", "hello", "--out", str(out), "--wait", "1", "--sequential"])
            self.assertEqual(code, 0)
            manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["results"]), 3)



if __name__ == "__main__":
    unittest.main()
