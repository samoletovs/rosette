"""Validate source-bound design evidence, not aesthetic quality or attestations."""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import struct
import subprocess
from pathlib import Path

EVIDENCE_DIR = Path("docs/design-evidence")
CHECKS = (
    "primary_task", "keyboard", "responsive", "states",
    "accessibility", "performance", "visual_intent",
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def git_bytes(repo: Path, *args: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True,
    )
    return result.stdout


def git(repo: Path, *args: str) -> str:
    return git_bytes(repo, *args).decode("utf-8").strip()


def brief_digest(repo: Path, revision: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("brief revision must be a full 40-character Git commit")
    return hashlib.sha256(git_bytes(repo, "show", f"{revision}:.impeccable.md")).hexdigest()


def require_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be nonempty text")
    text = value.strip()
    if re.search(r"\b(TODO|TBD|pending|placeholder)\b|<[^>]+>", text, re.IGNORECASE):
        raise ValueError(f"{label} still contains a placeholder")
    return text


def require_object(value: object, label: str) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def artifact(repo: Path, value: object) -> Path:
    name = require_text(value, "artifact path")
    path = (repo / name).resolve()
    evidence_root = (repo / EVIDENCE_DIR).resolve()
    if not evidence_root.is_relative_to(repo) or not path.is_relative_to(evidence_root):
        raise ValueError("artifacts must stay inside docs/design-evidence")
    if not path.is_file():
        raise ValueError(f"missing artifact: {name}")
    return path


def verify_artifact(repo: Path, item: dict) -> Path:
    path = artifact(repo, item.get("path"))
    expected = require_text(item.get("sha256"), "artifact sha256")
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if expected != actual:
        raise ValueError(f"artifact changed since review: {item['path']}")
    return path


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as image:
        header = image.read(24)
    if (
        len(header) != 24 or header[:8] != PNG_SIGNATURE
        or header[12:16] != b"IHDR"
    ):
        raise ValueError("rendered captures must be PNG files with dimensions")
    return struct.unpack(">II", header[16:24])


def check_source(repo: Path, source_commit: object) -> None:
    revision = require_text(source_commit, "source_commit")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("source_commit must be a full 40-character Git commit")
    if Path(git(repo, "rev-parse", "--show-toplevel")).resolve() != repo:
        raise ValueError("--repo must be the exact repository root")
    git(repo, "merge-base", "--is-ancestor", revision, "HEAD")
    paths = ("--", ".", ":(exclude)docs/design-evidence/**")
    # A worktree restore can conceal unreviewed index or committed content.
    changes = (
        git(repo, "diff", "--name-only", revision, "HEAD", *paths),
        git(repo, "diff", "--cached", "--name-only", revision, *paths),
        git(repo, "diff", "--name-only", revision, *paths),
    )
    untracked = git(repo, "ls-files", "--others", "--exclude-standard", "-z")
    outside_evidence = [
        name for name in untracked.split("\0")
        if name and not name.startswith("docs/design-evidence/")
    ]
    if any(changes) or outside_evidence:
        raise ValueError(
            "source changed since review; commit and re-review before updating evidence"
        )


def validate(repo: Path, review_path: Path) -> None:
    repo = repo.resolve()
    review_path = artifact(repo, str(review_path.resolve()))
    record = require_object(
        json.loads(review_path.read_text(encoding="utf-8")), "review",
    )
    if type(record.get("version")) is not int or record["version"] != 1:
        raise ValueError("review version must be 1")
    check_source(repo, record.get("source_commit"))
    brief = repo / ".impeccable.md"
    if not brief.is_file() or not brief.resolve().is_relative_to(repo):
        raise ValueError("missing project-root .impeccable.md")
    brief_bytes = brief.read_bytes()
    if not brief_bytes.strip():
        raise ValueError("project brief is empty")
    if record.get("brief_sha256") != brief_digest(repo, record["source_commit"]):
        raise ValueError("project brief changed since approval/review")

    direction = require_object(record.get("direction"), "direction")
    mode = direction.get("mode")
    if mode not in ("new", "reuse"):
        raise ValueError("direction.mode must be new or reuse")
    require_text(direction.get("owner_decision"), "direction.owner_decision")
    selected = require_text(direction.get("selected"), "direction.selected")
    if mode == "new":
        options = direction.get("options")
        if not isinstance(options, list) or len(options) != 2:
            raise ValueError("new directions require exactly two rendered options")
        names: set[str] = set()
        paths: set[Path] = set()
        hashes: set[str] = set()
        for option in options:
            option = require_object(option, "direction option")
            names.add(require_text(option.get("id"), "option id"))
            path = verify_artifact(repo, option)
            png_dimensions(path)
            paths.add(path)
            hashes.add(option["sha256"])
        if len(names) != 2 or len(paths) != 2 or len(hashes) != 2 or selected not in names:
            raise ValueError("options must be distinct and selected must name one")

    author = require_text(record.get("author"), "author").casefold()
    reviewer = require_text(record.get("reviewer"), "reviewer").casefold()
    if author == reviewer:
        raise ValueError("independent review cannot name the implementer as reviewer")
    require_text(record.get("review_notes"), "review_notes")
    if record.get("unresolved_findings") != []:
        raise ValueError("unresolved findings must be an explicit empty list")

    checks = require_object(record.get("checks"), "checks")
    for name in CHECKS:
        result = require_object(checks.get(name), f"checks.{name}")
        if result.get("status") != "pass":
            raise ValueError(f"{name} has not passed")
        require_text(result.get("evidence"), f"checks.{name}.evidence")

    screenshots = record.get("screenshots")
    if not isinstance(screenshots, list) or len(screenshots) != 2:
        raise ValueError("provide one mobile and one desktop PNG screenshot")
    viewports: set[str] = set()
    screenshot_paths: set[Path] = set()
    for screenshot in screenshots:
        screenshot = require_object(screenshot, "screenshot")
        viewport = screenshot.get("viewport")
        if viewport not in ("mobile", "desktop") or viewport in viewports:
            raise ValueError("screenshot viewports must be mobile and desktop")
        viewports.add(viewport)
        path = verify_artifact(repo, screenshot)
        screenshot_paths.add(path)
        width, height = png_dimensions(path)
        valid_width = 320 <= width <= 480 if viewport == "mobile" else width >= 1024
        if not valid_width or height < 320:
            raise ValueError(f"{viewport} screenshot has unsuitable dimensions")
    if len(screenshot_paths) != 2:
        raise ValueError("mobile and desktop screenshots must be distinct files")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--review", type=Path)
    mode.add_argument("--brief-hash", metavar="SOURCE_COMMIT", help="Hash the canonical Git brief")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        if args.brief_hash:
            logging.info("Canonical brief SHA-256: %s", brief_digest(args.repo, args.brief_hash))
            return 0
        review = args.review if args.review.is_absolute() else args.repo / args.review
        validate(args.repo, review)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        logging.error("Design evidence rejected: %s", error)
        return 1
    logging.info(
        "Design evidence complete and source-bound; human quality judgments remain attestations."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
