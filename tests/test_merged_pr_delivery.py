"""Synthetic GitHub metadata; no repository, cloud or secret access."""
from __future__ import annotations

import copy
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("merged_pr_delivery", ROOT / "scripts" / "merged-pr-delivery.py")
assert SPEC and SPEC.loader
delivery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(delivery)
REPO = "example/project"
HEAD, MERGE, CURRENT = "a" * 40, "b" * 40, "c" * 40


def pr() -> dict:
    return {
        "number": 7, "state": "closed", "merged": True, "draft": False,
        "merge_commit_sha": MERGE, "merged_by": {"login": "github-actions[bot]"},
        "base": {"ref": "main", "repo": {"full_name": REPO}},
        "head": {"sha": HEAD, "ref": "dependabot/example", "repo": {"full_name": REPO}},
    }


class TestMergedPRDelivery(unittest.TestCase):
    def setUp(self) -> None:
        self.info = {"full_name": REPO, "default_branch": "main"}
        self.run = {
            "id": 23, "name": "Auto-merge Dependabot PRs",
            "path": ".github/workflows/dependabot-auto-merge.yml",
            "event": "pull_request", "status": "completed", "conclusion": "success",
            "head_sha": HEAD, "head_repository": {"full_name": REPO}, "pull_requests": [],
        }
        self.pr = pr()
        self.calls = []
        self.event = {"repository": {"full_name": REPO}, "workflow_run": {"id": 23}}

    def api(self, repo: str, path: str) -> dict | list:
        self.assertEqual(repo, REPO)
        self.calls.append(path)
        if path == "":
            return self.info
        if path == "actions/runs/23":
            return self.run
        if path == f"commits/{HEAD}/pulls?per_page=100":
            return [{"number": 7}]
        if path == "pulls/7":
            return copy.deepcopy(self.pr)
        if path == "branches/main":
            return {"commit": {"sha": CURRENT}}
        if path == f"compare/{MERGE}...{CURRENT}?per_page=1":
            return {"status": "ahead", "merge_base_commit": {"sha": MERGE}}
        self.fail(f"Unexpected API path: {path}")

    def resolve(self) -> dict[str, str]:
        with patch.object(delivery, "api", side_effect=self.api), patch.object(delivery.time, "sleep"):
            return delivery.resolve(self.event, "workflow_run", REPO, "refs/heads/main")

    def test_repository_endpoint_has_no_trailing_slash(self) -> None:
        with patch.object(delivery.subprocess, "run", return_value=subprocess.CompletedProcess(
            [], 0, stdout=json.dumps(self.info),
        )) as run:
            self.assertEqual(delivery.repository(REPO), self.info)
        self.assertEqual(run.call_args.args[0], ["gh", "api", f"repos/{REPO}"])

    def test_bot_merge_delivers_current_default_not_the_untrusted_head(self) -> None:
        self.assertEqual(self.resolve(), {"source": CURRENT, "pr": "7", "merge": MERGE})
        self.assertIn(f"compare/{MERGE}...{CURRENT}?per_page=1", self.calls)

    def test_empty_workflow_pr_list_is_resolved_by_commit_association(self) -> None:
        self.resolve()
        self.assertIn(f"commits/{HEAD}/pulls?per_page=100", self.calls)

    def test_explicit_association_also_requires_exact_head(self) -> None:
        self.run["pull_requests"] = [{"number": 7}]
        self.pr["head"]["sha"] = "d" * 40
        self.assertEqual(self.resolve()["source"], "")

    def test_unmerged_or_human_merged_pr_never_deploys_from_completion(self) -> None:
        for change in ({"state": "open", "merged": False}, {"merged": False},
                       {"merged_by": {"login": "human"}}):
            self.pr = {**pr(), **change}
            self.assertEqual(self.resolve()["pr"], "")
        self.assertNotIn("branches/main", self.calls)

    def test_native_merge_settles_after_the_merger_check_finishes(self) -> None:
        original = self.api
        reads = 0

        def api(repo: str, path: str) -> dict | list:
            nonlocal reads
            if path == "pulls/7":
                reads += 1
                if reads == 1:
                    return {**pr(), "state": "open", "merged": False, "auto_merge": {"merge_method": "squash"}}
            return original(repo, path)

        with patch.object(delivery, "api", side_effect=api), patch.object(delivery.time, "sleep") as wait:
            self.assertEqual(delivery.resolve(self.event, "workflow_run", REPO, "refs/heads/main")["pr"], "7")
        self.assertEqual(reads, 2)
        wait.assert_called_once_with(5)

    def test_unconfirmed_native_merge_is_bounded_and_not_a_silent_noop(self) -> None:
        self.pr.update(state="open", merged=False, auto_merge={"merge_method": "squash"})
        with patch.object(delivery, "api", side_effect=self.api), \
                patch.object(delivery.time, "sleep") as wait, \
                self.assertRaisesRegex(ValueError, "still pending"):
            delivery.resolve(self.event, "workflow_run", REPO, "refs/heads/main")
        self.assertEqual(self.calls.count("pulls/7"), 12)
        self.assertEqual(wait.call_count, 11)

    def test_forged_workflow_failure_or_foreign_repository_cannot_authorize(self) -> None:
        for key, value in (("path", ".github/workflows/untrusted.yml"), ("conclusion", "failure"),
                           ("status", "in_progress"), ("event", "push"),
                           ("head_repository", {"full_name": "foreign/repo"})):
            with self.subTest(key=key):
                original = self.run[key]
                self.run[key] = value
                with self.assertRaises(ValueError):
                    self.resolve()
                self.run[key] = original

    def test_fork_wrong_base_or_draft_merge_is_rejected(self) -> None:
        for change in ({"head": {"sha": HEAD, "repo": {"full_name": "foreign/repo"}}},
                       {"draft": True}, {"merge_commit_sha": "not-a-sha"}):
            self.pr = {**pr(), **change}
            with self.assertRaises(ValueError):
                self.resolve()

    def test_unrelated_base_is_a_noop_not_a_production_deploy(self) -> None:
        self.pr["base"]["ref"] = "release"
        self.assertEqual(self.resolve()["source"], "")

    def test_manual_recovery_requires_default_branch_and_actual_merged_pr(self) -> None:
        event = {"repository": {"full_name": REPO}, "inputs": {"delivery_pr": "7"}}
        with patch.object(delivery, "api", side_effect=self.api):
            self.assertEqual(delivery.resolve(event, "workflow_dispatch", REPO, "refs/heads/main")["source"], CURRENT)
            with self.assertRaises(ValueError):
                delivery.resolve(event, "workflow_dispatch", REPO, "refs/heads/untrusted")
            self.pr["merged"] = False
            with self.assertRaises(ValueError):
                delivery.resolve(event, "workflow_dispatch", REPO, "refs/heads/main")

    def test_missing_or_truncated_associations_fail_closed(self) -> None:
        self.run["pull_requests"] = None
        with self.assertRaises(ValueError):
            self.resolve()
        self.run["pull_requests"] = []
        with patch.object(delivery, "api", side_effect=lambda repo, path: (
            [{"number": 7}] * 100 if path.startswith("commits/") else self.api(repo, path)
        )), self.assertRaises(ValueError):
            delivery.resolve(self.event, "workflow_run", REPO, "refs/heads/main")

    def test_merge_must_be_an_ancestor_of_the_current_default(self) -> None:
        with patch.object(delivery, "api", side_effect=lambda repo, path: (
            {"status": "diverged"} if path.startswith("compare/") else self.api(repo, path)
        )), self.assertRaises(ValueError):
            delivery.resolve(self.event, "workflow_run", REPO, "refs/heads/main")

    def test_cleanup_payload_is_rebuilt_from_confirmed_metadata_not_run_artifacts(self) -> None:
        self.pr.update(id=1234, title="Synthetic capture", user={"login": "dependabot[bot]"})
        with tempfile.TemporaryDirectory() as directory, patch.object(delivery, "api", side_effect=self.api):
            path = delivery.cleanup_event(REPO, 7, MERGE, Path(directory))
            event = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(event["action"], "closed")
            self.assertEqual(event["number"], 7)
            self.assertTrue(event["pull_request"]["merged"])
            self.assertEqual(event["repository"], self.info)
            self.assertEqual(event["pull_request"], self.pr)
            self.assertEqual(event["sender"], self.pr["merged_by"])
            with self.assertRaises(ValueError):
                delivery.cleanup_event(REPO, 7, HEAD, Path(directory))

    def test_stale_production_revision_fails_visibly_before_upload(self) -> None:
        with patch.dict(os.environ, {"GITHUB_REPOSITORY": REPO}), \
                patch("sys.argv", ["merged-pr-delivery.py", "current", "--source", MERGE]), \
                patch.object(delivery, "api", side_effect=self.api), \
                self.assertLogs(delivery.LOG, level="ERROR") as logs:
            self.assertEqual(delivery.main(), 1)
        self.assertIn("obsolete deployment", "\n".join(logs.output))

    def test_cleanup_output_uses_the_docker_workspace_mount(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "outputs"
            with patch.dict(os.environ, {
                "GITHUB_REPOSITORY": REPO, "GITHUB_WORKSPACE": directory,
                "GITHUB_OUTPUT": str(output),
            }), patch("sys.argv", [
                "merged-pr-delivery.py", "cleanup", "--pr", "7", "--merge", MERGE,
            ]), patch.object(delivery, "api", side_effect=self.api):
                self.assertEqual(delivery.main(), 0)
            self.assertEqual(output.read_text(encoding="utf-8"),
                             "event_path=/github/workspace/merged-pr-7.json\n")
            self.assertTrue((Path(directory) / "merged-pr-7.json").is_file())

    def test_current_default_revision_passes_without_mutations(self) -> None:
        with patch.dict(os.environ, {"GITHUB_REPOSITORY": REPO}), \
                patch("sys.argv", ["merged-pr-delivery.py", "current", "--source", CURRENT]), \
                patch.object(delivery, "api", side_effect=self.api):
            self.assertEqual(delivery.main(), 0)
        self.assertEqual(self.calls, ["", "branches/main"])

    def test_workflow_preserves_validation_only_dispatch_and_pins_delivery(self) -> None:
        template = ROOT / "workflow-templates" / "swa-deploy.yml"
        paths = [template] if template.is_file() else [
            path for path in (ROOT / ".github" / "workflows").glob("*.yml")
            if path.name in {"ci-cd.yml", "azure-static-web-apps-nice-water-04d37a403.yml"}
        ]
        self.assertTrue(paths)
        for path in paths:
            text = path.read_text(encoding="utf-8")
            with self.subTest(workflow=path.name):
                for required in (
                    'workflows: ["Auto-merge Dependabot PRs", "Auto-merge Copilot PRs"]',
                    "python scripts/merged-pr-delivery.py resolve",
                    "source: ${{ steps.delivery.outputs.source || github.sha }}",
                    "ref: ${{ needs.quality.outputs.source }}",
                    "python scripts/merged-pr-delivery.py current",
                    "python scripts/merged-pr-delivery.py cleanup",
                    "GITHUB_EVENT_PATH: ${{ steps.cleanup.outputs.event_path }}",
                    "github.event_name == 'workflow_dispatch' && !inputs.delivery_pr",
                    "needs.quality.outputs.pr",
                ):
                    self.assertIn(required, text)
                for forbidden in ("workflow_run.head_sha }}", "workflow_run.head_branch }}",
                                  "download-artifact@", "schedule:", "--admin"):
                    self.assertNotIn(forbidden, text)


if __name__ == "__main__":
    unittest.main()
