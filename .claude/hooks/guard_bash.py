#!/usr/bin/env python3
"""Claude Code PreToolUse hook: block git mutations and rm outside the repo."""

from __future__ import annotations

import json
import os
import shlex
import sys
from typing import Iterable

# AI : deny wins in Claude permissions; this hook covers flag-order / compound-command cases glob rules miss
SEPARATORS = {"&&", "||", ";", "|", "|&", "&"}
WRAPPERS = {
    "sudo",
    "command",
    "builtin",
    "noglob",
    "nohup",
    "nice",
    "time",
    "timeout",
    "stdbuf",
    "xargs",
    "env",
}
GIT_TAKES_ARG = {
    "-C",
    "-c",
    "--git-dir",
    "--work-tree",
    "--namespace",
    "--config-env",
    "--list-cmds",
}
RM_COMMANDS = {"rm", "rmdir", "unlink"}
BRANCH_DELETE_FLAGS = {"-d", "-D", "--delete"}
BRANCH_RENAME_FLAGS = {"-m", "-M", "--move", "--rename"}


def deny(reason: str) -> None:
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        },
        sys.stdout,
    )
    sys.exit(0)


def tokenize(command: str) -> list[str]:
    try:
        return shlex.split(command, posix=True)
    except ValueError:
        return command.split()


def split_segments(tokens: list[str]) -> list[list[str]]:
    segments: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        if token in SEPARATORS:
            if current:
                segments.append(current)
                current = []
            continue
        current.append(token)
    if current:
        segments.append(current)
    return segments


def strip_wrappers(argv: list[str]) -> list[str]:
    i = 0
    while i < len(argv):
        token = argv[i]
        if "=" in token and not token.startswith("-") and token.split("=", 1)[0].isidentifier():
            i += 1
            continue
        if token in WRAPPERS or token.endswith("sudo"):
            i += 1
            if token == "timeout" and i < len(argv):
                i += 1
            continue
        return argv[i:]
    return []


def git_verb_and_rest(argv: list[str]) -> tuple[str | None, list[str]]:
    if not argv or argv[0] != "git":
        return None, []
    i = 1
    while i < len(argv):
        token = argv[i]
        if token == "--":
            rest = argv[i + 1 :]
            return (rest[0] if rest else None), rest[1:]
        if token.startswith("--") and "=" in token:
            i += 1
            continue
        if token in GIT_TAKES_ARG:
            i += 2
            continue
        if token.startswith("-"):
            i += 1
            continue
        return token, argv[i + 1 :]
    return None, []


def flag_set(args: Iterable[str]) -> set[str]:
    flags: set[str] = set()
    for arg in args:
        if arg == "--":
            break
        if arg.startswith("--"):
            flags.add(arg.split("=", 1)[0])
            continue
        if arg.startswith("-") and arg != "-":
            if len(arg) > 2 and not arg.startswith("--"):
                flags.update(f"-{ch}" for ch in arg[1:])
            else:
                flags.add(arg)
    return flags


def project_root() -> str:
    raw = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    return os.path.realpath(os.path.abspath(raw))


def is_inside(path: str, root: str) -> bool:
    resolved = os.path.realpath(os.path.abspath(path))
    try:
        return os.path.commonpath([resolved, root]) == root
    except ValueError:
        return False


def rm_paths(argv: list[str], cwd: str) -> list[str]:
    paths: list[str] = []
    i = 1
    while i < len(argv):
        token = argv[i]
        if token == "--":
            paths.extend(os.path.join(cwd, os.path.expanduser(p)) for p in argv[i + 1 :])
            break
        if token.startswith("-") and token != "-":
            i += 1
            continue
        paths.append(os.path.join(cwd, os.path.expanduser(token)))
        i += 1
    return paths


def check_segment(argv: list[str], cwd: str, root: str) -> str | None:
    argv = strip_wrappers(argv)
    if not argv:
        return None

    verb, rest = git_verb_and_rest(argv)
    if verb == "commit":
        return "Blocked: git commit is not allowed. Stage locally if needed, but do not create commits."
    if verb == "branch":
        flags = flag_set(rest)
        if flags & BRANCH_DELETE_FLAGS:
            return "Blocked: deleting git branches is not allowed."
        if flags & BRANCH_RENAME_FLAGS:
            return "Blocked: renaming git branches is not allowed."
    if verb == "push":
        flags = flag_set(rest)
        if "--delete" in flags or "-d" in flags:
            return "Blocked: deleting remote git branches is not allowed."
        for arg in rest:
            if arg.startswith(":") and arg != ":":
                return "Blocked: deleting remote git branches is not allowed."

    if argv[0] in RM_COMMANDS:
        for path in rm_paths(argv, cwd):
            if not is_inside(path, root):
                return (
                    f"Blocked: deletion outside the project folder is not allowed "
                    f"({path!r} is outside {root!r})."
                )
    return None


def main() -> None:
    payload = json.load(sys.stdin)
    if payload.get("tool_name") != "Bash":
        return
    command = str((payload.get("tool_input") or {}).get("command") or "")
    if not command.strip():
        return
    cwd = str(payload.get("cwd") or os.getcwd())
    root = project_root()
    tokens = tokenize(command)
    for segment in split_segments(tokens):
        reason = check_segment(segment, cwd, root)
        if reason:
            deny(reason)


if __name__ == "__main__":
    main()
