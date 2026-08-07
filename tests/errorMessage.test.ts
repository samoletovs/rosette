import { describe, expect, it } from "vitest";
import { buildDetailedErrorMessage } from "../api/src/utils/errorMessage";

describe("buildDetailedErrorMessage", () => {
  it("includes context and a sanitized timeout hint", () => {
    const result = buildDetailedErrorMessage("calculate", new Error("OpenAI timeout"), "Calculation failed");
    expect(result).toBe("calculate: Calculation failed (upstream request timed out)");
  });

  it("omits hint when error message matches fallback", () => {
    const result = buildDetailedErrorMessage("upload", new Error("Upload failed"), "Upload failed");
    expect(result).toBe("upload: Upload failed");
  });

  it("returns context and fallback for non-Error values", () => {
    const result = buildDetailedErrorMessage("analyze", "unknown failure", "Analysis failed");
    expect(result).toBe("analyze: Analysis failed");
  });

  it("uses generic sanitized hint for unexpected errors", () => {
    const result = buildDetailedErrorMessage("feedback-submit", new Error("Storage account foo had issue"), "Failed to submit feedback");
    expect(result).toBe("feedback-submit: Failed to submit feedback (unexpected internal error)");
  });
});
