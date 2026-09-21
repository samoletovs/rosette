import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/azure-static-web-apps-nice-water-04d37a403.yml", import.meta.url), "utf8");
const quality = workflow.split("  quality:")[1].split("  build_and_deploy_job:")[0];
const deployment = workflow.split("  build_and_deploy_job:")[1].split("  close_pull_request_job:")[0];

function checkoutRef(job: string): string | undefined {
  const checkout = job.split("- uses: actions/checkout@v5")[1]?.split(/\r?\n {6}- /)[0];
  return checkout?.match(/^\s*ref:\s*(.+)$/m)?.[1];
}

describe("source-bound design evidence workflow", () => {
  it("tests and deploys the same event commit, including synthetic PR merges", () => {
    expect(quality).toContain("fetch-depth: 0");
    expect(checkoutRef(quality)).toBe("${{ github.sha }}");
    expect(checkoutRef(deployment)).toBe(checkoutRef(quality));
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
