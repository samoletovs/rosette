import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/azure-static-web-apps-nice-water-04d37a403.yml", import.meta.url), "utf8");
const quality = workflow.split("  quality:")[1].split("  build_and_deploy_job:")[0];

describe("source-bound design evidence workflow", () => {
  it("fetches the full history and validates the PR source head, not a synthetic merge", () => {
    expect(quality).toContain("fetch-depth: 0");
    expect(quality).toContain("ref: ${{ github.event.pull_request.head.sha || github.sha }}");
  });
  it("runs source ancestry enforcement only on pull requests, not after squash on main", () => {
    expect(quality).toMatch(/name: Require source-bound evidence for UI changes\s+if: github\.event_name == 'pull_request'/);
    expect(quality).toContain("DESIGN_BASE_SHA: ${{ github.event.pull_request.base.sha }}");
    expect(quality).toContain('python scripts/check-design-pr.py --repo . --base "$DESIGN_BASE_SHA"');
  });
  it("reruns the PR gate when only its evidence receipt is updated", () => {
    const pullRequestTrigger = workflow.split("  pull_request:")[1].split("\n#")[0];
    expect(pullRequestTrigger).not.toContain("paths-ignore");
  });
  it("executes missing/stale evidence regression tests rather than silently skipping them", () => {
    expect(quality).toContain("run: python tests/test_design_gate.py");
    expect(quality).not.toContain("continue-on-error");
  });
  it("labels a manual build artifact with the exact served source revision", () => {
    expect(quality).toContain('printf \'%s\\n\' "$GITHUB_SHA" > dist/source-revision.txt');
    expect(quality).toContain("name: rosette-preview-${{ github.sha }}");
    expect(quality).toContain("steps.validation_build.outcome == 'success'");
  });
});
