#!/usr/bin/env python3
# AI : one-command local hosting — Supabase + env + npm + seeds + dev servers.
from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "combined_full_stack"
SUPABASE_DIR = APP_DIR / "supabase"
ENV_FILE = ROOT / ".env"
ENV_TEMPLATE = ROOT / ".env.template"
APP_ENV_LOCAL = APP_DIR / ".env.local"
LOCAL_TEST_EMAIL = "dev-spine-ai-dev-testing-account@local.dev"
LOCAL_TEST_PASSWORD = "local-dev-password-3950"
SEED_USER_ENV = "SEED_USER_ID"
OPENROUTER_ENV = "OPENROUTER_API_KEY"


@dataclass(frozen=True)
class ServiceUrl:
    name: str
    url: str


SERVICE_URLS = (
    ServiceUrl("App", "http://localhost:3000"),
    ServiceUrl("Landing page", "http://localhost:4000"),
    ServiceUrl("Ops dashboard", "http://localhost:5050"),
    ServiceUrl("Supabase API", "http://127.0.0.1:54321"),
    ServiceUrl("Supabase Studio", "http://127.0.0.1:54323"),
    ServiceUrl("Inbucket (email)", "http://127.0.0.1:54324"),
)


class SetupError(RuntimeError):
    pass


def log(msg: str) -> None:
    print(f"[setup] {msg}", flush=True)


def run(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    capture: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    display = " ".join(cmd)
    log(f"$ {display}")
    merged = os.environ.copy()
    if env:
        merged.update(env)
    proc = subprocess.run(
        cmd,
        cwd=str(cwd or ROOT),
        text=True,
        capture_output=capture,
        env=merged,
    )
    if check and proc.returncode != 0:
        stderr = proc.stderr.strip() if proc.stderr else ""
        stdout = proc.stdout.strip() if proc.stdout else ""
        detail = stderr or stdout or f"exit {proc.returncode}"
        raise SetupError(f"command failed: {display}\n{detail}")
    return proc


def which(name: str) -> str | None:
    return shutil.which(name)


def supabase_cmd() -> list[str]:
    if which("supabase"):
        return ["supabase"]
    return ["npx", "--yes", "supabase"]


def docker_ok() -> bool:
    if not which("docker"):
        return False
    try:
        run(["docker", "info"], capture=True)
        return True
    except (SetupError, FileNotFoundError, OSError):
        return False


def node_ok() -> bool:
    return which("node") is not None and which("npm") is not None


def read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, raw = stripped.split("=", 1)
        key = key.strip()
        value = raw.strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = value[1:-1]
        values[key] = value
    return values


def write_env_file(path: Path, values: dict[str, str]) -> None:
    lines: list[str] = []
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                lines.append(line)
                continue
            key = stripped.split("=", 1)[0].strip()
            if key in values:
                lines.append(f'{key}="{values[key]}"')
                del values[key]
            else:
                lines.append(line)
    else:
        if ENV_TEMPLATE.exists():
            lines = ENV_TEMPLATE.read_text(encoding="utf-8").splitlines()
        else:
            lines = []
    for key in sorted(values):
        lines.append(f'{key}="{values[key]}"')
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def upsert_env(path: Path, updates: dict[str, str]) -> None:
    current = read_env_file(path)
    current.update(updates)
    write_env_file(path, current)


def random_hex(n_bytes: int = 32) -> str:
    return secrets.token_hex(n_bytes)


def ensure_env_bootstrap() -> None:
    if not ENV_FILE.exists():
        if ENV_TEMPLATE.exists():
            shutil.copy(ENV_TEMPLATE, ENV_FILE)
            log(f"created {ENV_FILE.name} from template")
        else:
            ENV_FILE.write_text("", encoding="utf-8")
            log(f"created empty {ENV_FILE.name}")

    updates: dict[str, str] = {}
    current = read_env_file(ENV_FILE)

    if not current.get("DASHBOARD_ACCESS_KEY"):
        updates["DASHBOARD_ACCESS_KEY"] = random_hex()
    if not current.get("LANDING_DEMO_IP_SALT"):
        updates["LANDING_DEMO_IP_SALT"] = random_hex()
    if not current.get("LANDING_DEMO_PROXY_SECRET"):
        updates["LANDING_DEMO_PROXY_SECRET"] = random_hex()
    if not current.get("NEXT_PUBLIC_STRIPE_ENABLED"):
        updates["NEXT_PUBLIC_STRIPE_ENABLED"] = "false"

    if updates:
        upsert_env(ENV_FILE, updates)
        log(f"wrote generated secrets to {ENV_FILE.name}")

    app_local_updates = {"RATE_LIMIT_BACKEND": "memory"}
    upsert_env(APP_ENV_LOCAL, app_local_updates)
    log(f"set RATE_LIMIT_BACKEND=memory in {APP_ENV_LOCAL.relative_to(ROOT)}")


def parse_supabase_status(stdout: str) -> dict[str, str]:
    try:
        data = json.loads(stdout)
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items()}
    except json.JSONDecodeError:
        pass

    parsed: dict[str, str] = {}
    for line in stdout.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        parsed[key.strip()] = value.strip()
    return parsed


def supabase_status() -> dict[str, str]:
    proc = run(
        [*supabase_cmd(), "status", "-o", "json"],
        cwd=SUPABASE_DIR,
        capture=True,
        check=False,
    )
    if proc.returncode != 0:
        raise SetupError(
            "Supabase is not running. Run: python3 scripts/setup_local.py supabase"
        )
    return parse_supabase_status(proc.stdout)


def sync_env_from_supabase(status: dict[str, str]) -> None:
    api_url = status.get("API_URL") or status.get("api_url") or "http://127.0.0.1:54321"
    anon_key = status.get("ANON_KEY") or status.get("anon_key") or ""
    service_key = status.get("SERVICE_ROLE_KEY") or status.get("service_role_key") or ""
    if not anon_key or not service_key:
        raise SetupError("supabase status missing anon/service keys")

    upsert_env(
        ENV_FILE,
        {
            "SUPABASE_URL": api_url,
            "NEXT_PUBLIC_SUPABASE_URL": api_url,
            "SUPABASE_ANON_KEY": anon_key,
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": anon_key,
            "SUPABASE_SERVICE_ROLE_KEY": service_key,
        },
    )
    log(f"synced Supabase keys into {ENV_FILE.name}")


def wait_for_url(url: str, *, timeout_sec: float = 120.0) -> None:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as res:
                if res.status < 500:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2)
    raise SetupError(f"timed out waiting for {url}")


def supabase_start(*, reset_db: bool = False) -> None:
    if not docker_ok():
        raise SetupError(
            "Docker is not running. Start Docker Desktop / dockerd, then rerun."
        )

    run([*supabase_cmd(), "start"], cwd=SUPABASE_DIR)
    if reset_db:
        run([*supabase_cmd(), "db", "reset", "--yes"], cwd=SUPABASE_DIR)
    status = supabase_status()
    sync_env_from_supabase(status)
    wait_for_url(f"{status.get('API_URL', 'http://127.0.0.1:54321')}/rest/v1/")
    log("local Supabase is up")


def supabase_stop() -> None:
    run([*supabase_cmd(), "stop"], cwd=SUPABASE_DIR, check=False)


def install_deps() -> None:
    run(["npm", "install"], cwd=ROOT)
    run(["npm", "install"], cwd=APP_DIR)
    run(["npm", "install"], cwd=ROOT / "landing_page")
    run(["npm", "install"], cwd=ROOT / "dashboard")
    run(["npm", "run", "sync:shared"], cwd=ROOT)
    log("npm dependencies installed")


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    body: dict[str, object] | None = None,
) -> tuple[int, dict[str, object]]:
    payload = None
    req_headers = dict(headers)
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return err.code, parsed


def find_user_by_email(api_url: str, service_key: str, email: str) -> str | None:
    url = f"{api_url.rstrip('/')}/auth/v1/admin/users?email={urllib.parse.quote(email)}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }
    status, data = http_json("GET", url, headers=headers)
    if status >= 400:
        raise SetupError(f"list users failed ({status}): {data}")
    users = data.get("users")
    if isinstance(users, list) and users:
        user_id = users[0].get("id")
        return str(user_id) if user_id else None
    return None


def create_local_test_user(api_url: str, service_key: str) -> str:
    existing = find_user_by_email(api_url, service_key, LOCAL_TEST_EMAIL)
    if existing:
        log(f"reusing test user {existing}")
        return existing

    url = f"{api_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }
    status, data = http_json(
        "POST",
        url,
        headers=headers,
        body={
            "email": LOCAL_TEST_EMAIL,
            "password": LOCAL_TEST_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"local_dev": True},
        },
    )
    if status >= 400:
        raise SetupError(f"create test user failed ({status}): {data}")
    user_id = data.get("id")
    if not user_id:
        raise SetupError(f"create test user returned no id: {data}")
    user_id_str = str(user_id)
    log(f"created test user {user_id_str} ({LOCAL_TEST_EMAIL})")
    return user_id_str


def sync_seeds(user_id: str) -> None:
    env = read_env_file(ENV_FILE)
    env[SEED_USER_ENV] = user_id
    run(
        ["npm", "run", "sync-seeds", "--", f"--user-id={user_id}"],
        cwd=APP_DIR,
        env=env,
    )
    upsert_env(ENV_FILE, {SEED_USER_ENV: user_id})
    log("seed projects synced")


def openrouter_ready() -> bool:
    env = read_env_file(ENV_FILE)
    key = env.get(OPENROUTER_ENV, "").strip()
    return bool(key)


def check_openrouter() -> None:
    if not openrouter_ready():
        log(
            f"skip OpenRouter check — set {OPENROUTER_ENV} in {ENV_FILE.name} "
            "before running the app"
        )
        return
    run(["npm", "run", "check-openrouter"], cwd=APP_DIR)


def print_service_table(extra: dict[str, str] | None = None) -> None:
    print("\nServices:")
    print("| Service | URL |")
    print("|---|---|")
    for svc in SERVICE_URLS:
        print(f"| {svc.name} | {svc.url} |")
    if extra:
        for key, value in extra.items():
            print(f"| {key} | {value} |")
    print()


def cmd_check(_: argparse.Namespace) -> None:
    issues: list[str] = []
    if not node_ok():
        issues.append("Node.js/npm missing")
    if not which("python3"):
        issues.append("python3 missing")
    if not docker_ok():
        issues.append("Docker not running")
    if not which("supabase") and not which("npx"):
        issues.append("supabase CLI and npx both unavailable")
    if issues:
        raise SetupError("prerequisites failed:\n- " + "\n- ".join(issues))
    log("prerequisites ok")


def cmd_env(_: argparse.Namespace) -> None:
    ensure_env_bootstrap()
    try:
        sync_env_from_supabase(supabase_status())
    except SetupError:
        log("Supabase not running — env template/secrets ready; run `supabase` next")


def cmd_supabase(args: argparse.Namespace) -> None:
    ensure_env_bootstrap()
    supabase_start(reset_db=args.reset)


def cmd_deps(_: argparse.Namespace) -> None:
    install_deps()


def cmd_seeds(_: argparse.Namespace) -> None:
    ensure_env_bootstrap()
    status = supabase_status()
    api_url = status.get("API_URL", "http://127.0.0.1:54321")
    service_key = status.get("SERVICE_ROLE_KEY", "")
    if not service_key:
        raise SetupError("missing service role key — run `supabase` first")
    user_id = create_local_test_user(api_url, service_key)
    sync_seeds(user_id)


def cmd_dev(_: argparse.Namespace) -> None:
    if not openrouter_ready():
        raise SetupError(
            f"{OPENROUTER_ENV} is required for the main app. "
            f"Add it to {ENV_FILE.name} or export it, then rerun."
        )
    print_service_table(
        {
            "Test login email": LOCAL_TEST_EMAIL,
            "Test login password": LOCAL_TEST_PASSWORD,
        }
    )
    run(["npm", "run", "dev:all"], cwd=ROOT)


def cmd_stop(_: argparse.Namespace) -> None:
    supabase_stop()
    log("supabase stopped")


def cmd_reset(_: argparse.Namespace) -> None:
    ensure_env_bootstrap()
    supabase_start(reset_db=True)
    cmd_seeds(argparse.Namespace())


def cmd_all(args: argparse.Namespace) -> None:
    cmd_check(args)
    ensure_env_bootstrap()
    install_deps()
    supabase_start(reset_db=args.reset)
    status = supabase_status()
    api_url = status.get("API_URL", "http://127.0.0.1:54321")
    service_key = status.get("SERVICE_ROLE_KEY", "")
    user_id = create_local_test_user(api_url, service_key)
    sync_seeds(user_id)
    check_openrouter()
    print_service_table(
        {
            "Test login email": LOCAL_TEST_EMAIL,
            "Test login password": LOCAL_TEST_PASSWORD,
        }
    )
    if args.start_dev:
        if not openrouter_ready():
            raise SetupError(
                f"{OPENROUTER_ENV} missing — setup finished but dev servers not started. "
                f"Add the key to {ENV_FILE.name}, then: python3 scripts/setup_local.py dev"
            )
        run(["npm", "run", "dev:all"], cwd=ROOT)
    else:
        log("setup complete — start apps with: python3 scripts/setup_local.py dev")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Host locally with Supabase — automated setup (Python, minimal steps).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="verify Docker, Node, Supabase CLI")

    sub.add_parser("env", help="bootstrap .env + local app overrides")

    sup = sub.add_parser("supabase", help="start local Supabase and apply migrations")
    sup.add_argument(
        "--reset",
        action="store_true",
        help="run supabase db reset (migrations + seed.sql)",
    )

    sub.add_parser("deps", help="npm install all apps + sync shared code")
    sub.add_parser("seeds", help="create local test user + sync example projects")
    sub.add_parser("dev", help="start app + landing + dashboard")
    sub.add_parser("stop", help="stop local Supabase")
    sub.add_parser("reset", help="db reset + re-seed")

    all_cmd = sub.add_parser("all", help="full local hosting setup")
    all_cmd.add_argument(
        "--reset",
        action="store_true",
        help="reset database before seeding",
    )
    all_cmd.add_argument(
        "--start-dev",
        action="store_true",
        help="also launch npm run dev:all (needs OPENROUTER_API_KEY)",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    handlers: dict[str, Callable[[argparse.Namespace], None]] = {
        "check": cmd_check,
        "env": cmd_env,
        "supabase": cmd_supabase,
        "deps": cmd_deps,
        "seeds": cmd_seeds,
        "dev": cmd_dev,
        "stop": cmd_stop,
        "reset": cmd_reset,
        "all": cmd_all,
    }
    try:
        handlers[args.command](args)
    except SetupError as err:
        print(f"[setup] ERROR: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
