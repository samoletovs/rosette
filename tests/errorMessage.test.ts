import { describe, expect, it } from "vitest";
import { buildDetailedErrorMessage } from "../api/src/utils/errorMessage";

describe("buildDetailedErrorMessage", () => {
  it("includes context, fallback, and error details", () => {
    const result = buildDetailedErrorMessage("calculate", new Error("OpenAI timeout"), "Calculation failed");
    expect(result).toBe("calculate: Calculation failed (OpenAI timeout)");
  });

  it("omits duplicate details when message matches fallback", () => {
    const result = buildDetailedErrorMessage("upload", new Error("Upload failed"), "Upload failed");
    expect(result).toBe("upload: Upload failed");
  });

  it("returns context and fallback for non-Error values", () => {
    const result = buildDetailedErrorMessage("analyze", "unknown failure", "Analysis failed");
    expect(result).toBe("analyze: Analysis failed");
  });
});
