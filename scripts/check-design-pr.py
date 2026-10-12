"""Require fresh design evidence for UI changes in a pull request."""
from __future__ import annotations

import argparse
import json
import logging
import re
import subprocess
import sys
from pathlib import Path

UI_FILES = {
    "index.html", ".impeccable.md",
    "vite.config.ts", "tsconfig.json", "scripts/design-gate.py",
    "scripts/check-design-pr.py",
}
DEPENDENCY_FIELDS = {
    "dependencies", "devDependencies", "optionalDependencies",
    "peerDependencies", "peerDependenciesMeta", "overrides", "resolutions",
}


def package_metadata_changed(repo: Path, base: str) -> bool:
    """Return whether package.json changed beyond dependency declarations."""
    documents = []
    for revision in (base, "HEAD"):
        result = subprocess.run(
            ["git", "-C", str(repo), "show", f"{revision}:package.json"],
            check=False, capture_output=True, text=True,
        )
        if result.returncode:
            return True
        document = json.loads(result.stdout)
        for field in DEPENDENCY_FIELDS:
            document.pop(field, None)
        documents.append(document)
    return documents[0] != documents[1]


def changed_ui_paths(repo: Path, base: str) -> list[str]:
    if not re.fullmatch(r"[0-9a-f]{40}", base):
        raise ValueError("--base must be the full pull-request base commit")
    result = subprocess.run(
        ["git", "-C", str(repo), "diff", "--name-only", "--no-renames", "-z", f"{base}...HEAD"],
        check=True, capture_output=True,
    )
    changed = [name for name in result.stdout.decode("utf-8").split("\0") if name]
    relevant = [
        name for name in changed
        if name.startswith(("src/", "public/")) or name in UI_FILES
    ]
    if "package.json" in changed and package_metadata_changed(repo, base):
        relevant.append("package.json")
    return relevant


def check(repo: Path, base: str) -> int:
    relevant = changed_ui_paths(repo, base)
    if not relevant:
        logging.info("No product UI paths changed; design evidence is not required.")
        return 0
    logging.info("Product UI changes require source-bound evidence: %s", ", ".join(relevant))
    receipts = sorted((repo / "docs/design-evidence").glob("**/review.json"))
    if not receipts:
        logging.error("Missing docs/design-evidence/<feature>/review.json for UI changes.")
        return 1
    for receipt in receipts:
        result = subprocess.run(
            [sys.executable, str(repo / "scripts/design-gate.py"), "--repo", str(repo), "--review", str(receipt)],
            capture_output=True, text=True, check=False,
        )
        if result.returncode == 0:
            logging.info("Accepted source-bound receipt: %s", receipt.relative_to(repo))
            return 0
        logging.error("%s: %s", receipt.relative_to(repo), result.stderr.strip())
    logging.error("No current receipt passed. Commit source, verify, and obtain independent review.")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--base", required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        return check(args.repo.resolve(), args.base)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        logging.error("Cannot determine/validate UI changes: %s", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
