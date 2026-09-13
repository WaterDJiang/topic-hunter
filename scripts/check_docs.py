#!/usr/bin/env python3
"""Validate the M0 document graph and the two root agent instruction files."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "specs/INDEX.md",
    "doc/INDEX.md",
    "doc/ref/INDEX.md",
    "doc/design/INDEX.md",
    "doc/plan/INDEX.md",
    "doc/log/INDEX.md",
)
LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def main() -> int:
    errors: list[str] = []
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            errors.append(f"missing: {name}")

    ignored = {".git", "node_modules", ".output", "dist", "coverage", ".venv"}
    markdown_files = sorted(
        file for file in ROOT.rglob("*.md") if not (set(file.relative_to(ROOT).parts) & ignored)
    )
    if not markdown_files:
        errors.append("no Markdown files found")

    for file in markdown_files:
        relative = file.relative_to(ROOT)
        content = file.read_text(encoding="utf-8")
        for target in LINK.findall(content):
            if target.startswith(("https://", "http://", "mailto:", "#")):
                continue
            local = target.split("#", 1)[0]
            if local and not (file.parent / local).exists():
                errors.append(f"broken link: {relative} -> {target}")

    for name in ("AGENTS.md", "CLAUDE.md"):
        path = ROOT / name
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8")
        lines = content.splitlines()
        if len(lines) >= 200:
            errors.append(f"{name}: {len(lines)} lines, expected <200")
        if lines and lines[0].strip() == "---":
            errors.append(f"{name}: frontmatter is forbidden")
        if content.count("```") % 2:
            errors.append(f"{name}: unbalanced code fences")
        if "<!--" in content:
            errors.append(f"{name}: HTML comments are forbidden")
        if name == "AGENTS.md" and "@import" in content:
            errors.append("AGENTS.md: @import is forbidden")

    if errors:
        for error in errors:
            print(f"FAIL {error}")
        return 1

    print(f"PASS: {len(markdown_files)} Markdown files, local links and Harness syntax")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
