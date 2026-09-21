import { describe, expect, it } from "vitest";
import { MAX_PLAN_BYTES, validatePlanFile } from "../src/planFile";

describe("floor-plan file validation", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "application/pdf"])("retains support for %s plans", (type) => {
    expect(validatePlanFile({ type, size: MAX_PLAN_BYTES })).toBeNull();
  });
  it("rejects files exceeding the advertised size instead of starting analysis", () => {
    expect(validatePlanFile({ type: "image/png", size: MAX_PLAN_BYTES + 1 })).toContain("10 MB");
  });
  it("rejects empty files with a recovery instruction", () => {
    expect(validatePlanFile({ type: "image/png", size: 0 })).toContain("Choose a floor plan");
  });
  it("rejects an unsupported drag-and-drop file", () => {
    expect(validatePlanFile({ type: "text/html", size: 120 })).toContain("PNG, JPEG, WebP or PDF");
  });
});
