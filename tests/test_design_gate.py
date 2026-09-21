"""Offline regression tests for the actual PR design-gate entry point."""
from __future__ import annotations

import hashlib
import json
import shutil
import struct
import subprocess
import sys
import unittest
import uuid
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / ".test-artifacts" / "design-gate"
CHECKS = ("primary_task", "keyboard", "responsive", "states", "accessibility", "performance", "visual_intent")


def fixture_png(width: int, height: int) -> bytes:
    """Generate test-only images, never product/browser evidence."""
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress((b"\0" + b"\xff\xfd\xf8" * width) * height))
        + chunk(b"IEND", b"")
    )


class DesignGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = FIXTURES / uuid.uuid4().hex
        self.repo.mkdir(parents=True)
        self.git("init", "-q")
        self.git("config", "user.name", "Design gate fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.autocrlf", "false")
        self.write(".impeccable.md", "Approved test-only direction A.\n")
        self.write("src/App.tsx", "export const label = 'Before';\n")
        for name in ("design-gate.py", "check-design-pr.py"):
            self.write(f"scripts/{name}", (ROOT / "scripts" / name).read_text(encoding="utf-8"))
        self.base = self.commit("base")

    def tearDown(self) -> None:
        # Git's object files can be read-only on Windows.
        def writable(function: object, path: str, error: object) -> None:
            Path(path).chmod(0o700)
            if callable(function):
                function(path)
        shutil.rmtree(self.repo, onerror=writable)

    def git(self, *arguments: str) -> str:
        return subprocess.run(
            ["git", "-C", str(self.repo), *arguments],
            check=True, capture_output=True, text=True,
        ).stdout.strip()

    def write(self, name: str, text: str) -> None:
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")

    def commit(self, message: str) -> str:
        self.git("add", ".")
        self.git("commit", "-qm", message)
        return self.git("rev-parse", "HEAD")

    def ui_commit(self) -> str:
        self.write("src/App.tsx", "export const label = 'Changed UI';\n")
        return self.commit("UI change")

    def receipt(self, source: str) -> Path:
        directory = self.repo / "docs/design-evidence/fixture"
        directory.mkdir(parents=True)
        screenshots = []
        for viewport, width in (("mobile", 390), ("desktop", 1440)):
            path = directory / f"{viewport}.png"
            path.write_bytes(fixture_png(width, 600))
            screenshots.append({
                "viewport": viewport, "path": path.relative_to(self.repo).as_posix(),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            })
        canonical = subprocess.run(
            ["git", "-C", str(self.repo), "show", f"{source}:.impeccable.md"],
            check=True, capture_output=True,
        ).stdout
        record = {
            "version": 1, "source_commit": source,
            "brief_sha256": hashlib.sha256(canonical).hexdigest(),
            "direction": {"mode": "reuse", "selected": "A", "owner_decision": "Test-only prior approval"},
            "author": "fixture implementer", "reviewer": "fixture independent reviewer",
            "review_notes": "Synthetic unit-test receipt; not product review.",
            "unresolved_findings": [],
            "checks": {name: {"status": "pass", "evidence": "Unit-test contract fixture"} for name in CHECKS},
            "screenshots": screenshots,
        }
        path = directory / "review.json"
        path.write_text(json.dumps(record), encoding="utf-8")
        return path

    def run_gate(self, base: str | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(self.repo / "scripts/check-design-pr.py"), "--repo", str(self.repo), "--base", base or self.base],
            capture_output=True, text=True, check=False,
        )

    def test_ui_change_without_receipt_is_blocked(self) -> None:
        self.ui_commit()
        result = self.run_gate()
        self.assertEqual(result.returncode, 1)
        self.assertIn("Missing", result.stderr)

    def test_backend_only_change_needs_no_visual_receipt(self) -> None:
        self.write("api/src/example.ts", "export const backend = true;\n")
        self.commit("backend only")
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("No product UI paths changed", result.stderr)

    def test_evidence_only_commit_preserves_source_binding(self) -> None:
        source = self.ui_commit()
        self.receipt(source)
        self.commit("evidence only")
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_later_committed_ui_change_invalidates_receipt(self) -> None:
        source = self.ui_commit()
        self.receipt(source)
        self.commit("evidence")
        self.write("src/App.tsx", "export const label = 'Not reviewed';\n")
        self.commit("unreviewed edit")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1)
        self.assertIn("source changed since review", result.stderr)

    def test_staged_change_cannot_hide_behind_restored_worktree(self) -> None:
        source = self.ui_commit()
        self.receipt(source)
        self.write("src/App.tsx", "export const label = 'Staged edit';\n")
        self.git("add", "src/App.tsx")
        self.write("src/App.tsx", "export const label = 'Changed UI';\n")
        self.assertEqual(self.run_gate().returncode, 1)

    def test_modified_artifact_invalidates_receipt(self) -> None:
        source = self.ui_commit()
        self.receipt(source)
        image = self.repo / "docs/design-evidence/fixture/mobile.png"
        image.write_bytes(fixture_png(400, 600))
        result = self.run_gate()
        self.assertEqual(result.returncode, 1)
        self.assertIn("artifact changed", result.stderr)

    def test_missing_history_fails_visibly_instead_of_skipping(self) -> None:
        self.ui_commit()
        result = self.run_gate("f" * 40)
        self.assertEqual(result.returncode, 1)
        self.assertIn("Cannot determine/validate UI changes", result.stderr)

    def test_deleted_ui_file_is_still_a_ui_change(self) -> None:
        (self.repo / "src/App.tsx").unlink()
        self.commit("delete UI")
        self.assertEqual(self.run_gate().returncode, 1)


if __name__ == "__main__":
    unittest.main()
