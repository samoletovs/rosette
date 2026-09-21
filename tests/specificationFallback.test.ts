import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecificationFallback } from "../src/components/SpecificationFallback";

describe("unavailable specification formatting", () => {
  it("announces the formatting failure and preserves the original text without executing HTML", () => {
    const description = "## Original specification\n\nĀ ē ī ū & <script>synthetic</script>";
    const html = renderToStaticMarkup(createElement(SpecificationFallback, { children: description }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Formatted specification couldn’t load.");
    expect(html).toContain("Your results and downloads are still available");
    expect(html).toContain("## Original specification\n\nĀ ē ī ū &amp; &lt;script&gt;synthetic&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('aria-label="Plain-text specification"');
  });

  it("does not invent specification content when the response contained none", () => {
    const html = renderToStaticMarkup(createElement(SpecificationFallback, { children: "" }));
    expect(html).toContain("No specification text was returned.");
    expect(html).toContain("Formatted specification couldn’t load.");
  });
});
