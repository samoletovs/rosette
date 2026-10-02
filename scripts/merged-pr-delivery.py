"""Resolve bot-merge delivery using trusted GitHub metadata, never PR artifacts."""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

LOG = logging.getLogger(__name__)
SHA = re.compile(r"[0-9a-f]{40}")
MERGERS = {
    "Auto-merge Dependabot PRs": ".github/workflows/dependabot-auto-merge.yml",
    "Auto-merge Copilot PRs": ".github/workflows/copilot-auto-merge.yml",
}


def require(condition: object, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def api(repo: str, path: str) -> dict | list:
    endpoint = f"repos/{repo}" + (f"/{path}" if path else "")
    result = subprocess.run(
        ["gh", "api", endpoint], capture_output=True, text=True,
        encoding="utf-8", timeout=90, check=False,
    )
    require(result.returncode == 0, "GitHub metadata could not be read; no delivery assumed")
    return json.loads(result.stdout)


def repository(repo: str) -> dict:
    data = api(repo, "")
    require(isinstance(data, dict) and data.get("full_name") == repo
            and isinstance(data.get("default_branch"), str), "Repository metadata incomplete")
    return data


def current_source(repo: str, branch: str) -> str:
    data = api(repo, f"branches/{quote(branch, safe='')}")
    require(isinstance(data, dict), "Default branch metadata incomplete")
    sha = data.get("commit", {}).get("sha", "")
    require(SHA.fullmatch(sha), "Default branch revision invalid")
    return sha


def validate_pr(pr: dict, repo: str, branch: str) -> None:
    require(
        pr.get("state") == "closed" and pr.get("merged") is True
        and pr.get("draft") is False
        and pr.get("base", {}).get("ref") == branch
        and pr.get("base", {}).get("repo", {}).get("full_name") == repo
        and (pr.get("head", {}).get("repo") or {}).get("full_name") == repo
        and isinstance(pr.get("number"), int) and pr["number"] > 0
        and SHA.fullmatch(pr.get("merge_commit_sha", "")),
        "Only a confirmed same-repository merge into the default branch can be delivered",
    )


def merged_pr(repo: str, number: int, branch: str) -> dict:
    pr = api(repo, f"pulls/{number}")
    require(isinstance(pr, dict) and pr.get("number") == number, "PR metadata incomplete")
    validate_pr(pr, repo, branch)
    return pr


def resolve(event: dict, name: str, repo: str, ref: str) -> dict[str, str]:
    info = repository(repo)
    branch = info["default_branch"]
    require(event.get("repository", {}).get("full_name") == repo
            and ref == f"refs/heads/{branch}", "Delivery must run from the trusted default branch")
    if name == "workflow_dispatch":
        number = str(event.get("inputs", {}).get("delivery_pr", ""))
        require(number.isdecimal() and int(number) > 0, "A merged PR number is required")
        pr = merged_pr(repo, int(number), branch)
    else:
        require(name == "workflow_run", "Unsupported delivery event")
        incoming = event.get("workflow_run", {})
        require(type(incoming.get("id")) is int, "Missing workflow identity")
        run = api(repo, f"actions/runs/{incoming['id']}")
        require(
            isinstance(run, dict) and run.get("id") == incoming["id"]
            and run.get("name") in MERGERS and run.get("path") == MERGERS[run["name"]]
            and run.get("event") in {"pull_request", "check_suite"}
            and run.get("status") == "completed" and run.get("conclusion") == "success"
            and (run.get("head_repository") or {}).get("full_name") == repo
            and SHA.fullmatch(run.get("head_sha", "")),
            "Completion is not a successful trusted merge workflow",
        )
        associations = run.get("pull_requests", [])
        require(isinstance(associations, list), "PR associations unavailable")
        numbers = {item["number"] for item in associations}
        if not numbers:
            candidates = api(repo, f"commits/{run['head_sha']}/pulls?per_page=100")
            require(isinstance(candidates, list) and len(candidates) < 100,
                    "Commit PR associations incomplete")
            numbers = {item["number"] for item in candidates}
        require(all(type(number) is int and number > 0 for number in numbers), "Invalid PR association")
        eligible = []
        for attempt in range(12):
            eligible, waiting = [], False
            for number in sorted(numbers):
                candidate = api(repo, f"pulls/{number}")
                require(isinstance(candidate, dict), "PR metadata incomplete")
                if (candidate.get("head", {}).get("sha") != run["head_sha"]
                        or candidate.get("base", {}).get("ref") != branch):
                    continue
                if candidate.get("state") == "open":
                    waiting = waiting or candidate.get("auto_merge") is not None
                    continue
                if not candidate.get("merged"):
                    continue
                validate_pr(candidate, repo, branch)
                if (candidate.get("merged_by") or {}).get("login") == "github-actions[bot]":
                    eligible.append(candidate)
            if eligible or not waiting or attempt == 11:
                break
            # Native auto-merge may settle just after the merger's check completes.
            time.sleep(5)
        require(not waiting or eligible, "Native merge is still pending; rerun the delivery completion")
        require(len(eligible) <= 1, "Ambiguous merge association; retry one PR explicitly")
        if not eligible:
            LOG.info("No confirmed bot merge for this completion; no deployment requested")
            return {"source": "", "pr": "", "merge": ""}
        pr = eligible[0]
    source = current_source(repo, branch)
    comparison = api(repo, f"compare/{pr['merge_commit_sha']}...{source}?per_page=1")
    require(isinstance(comparison, dict) and comparison.get("status") in {"ahead", "identical"}
            and comparison.get("merge_base_commit", {}).get("sha") == pr["merge_commit_sha"],
            "Merged revision is not contained in the current default branch")
    LOG.info("Delivering current default revision %s for merged PR #%d", source, pr["number"])
    return {"source": source, "pr": str(pr["number"]), "merge": pr["merge_commit_sha"]}


def cleanup_event(repo: str, number: int, merge: str, directory: Path) -> Path:
    info = repository(repo)
    pr = merged_pr(repo, number, info["default_branch"])
    require(pr["merge_commit_sha"] == merge, "Merge identity changed before preview cleanup")
    payload = {
        "action": "closed", "number": number, "repository": info,
        "pull_request": pr, "sender": pr.get("merged_by"),
    }
    path = directory / f"merged-pr-{number}.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def output(values: dict[str, str]) -> None:
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as stream:
        for key, value in values.items():
            require("\n" not in value and "\r" not in value, "Unsafe output value")
            stream.write(f"{key}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("resolve", "current", "cleanup"))
    parser.add_argument("--source")
    parser.add_argument("--pr", type=int)
    parser.add_argument("--merge")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        repo = os.environ["GITHUB_REPOSITORY"]
        if args.mode == "resolve":
            event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
            output(resolve(event, os.environ["GITHUB_EVENT_NAME"], repo, os.environ["GITHUB_REF"]))
        elif args.mode == "current":
            require(SHA.fullmatch(args.source or ""), "Missing checked source")
            branch = repository(repo)["default_branch"]
            require(current_source(repo, branch) == args.source,
                    "Default branch advanced during validation; refusing an obsolete deployment")
        else:
            require(args.pr and args.pr > 0 and SHA.fullmatch(args.merge or ""), "Missing merge identity")
            path = cleanup_event(repo, args.pr, args.merge, Path(os.environ["GITHUB_WORKSPACE"]))
            # Docker actions mount the workspace here, not at its host-runner path.
            output({"event_path": f"/github/workspace/{path.name}"})
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        LOG.exception("Merged-PR delivery failed; do not assume production or cleanup succeeded")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
