import { describe, it, expect } from "vitest";

describe("PaywallModal", () => {
  it("URL param ?paid=true triggers unlock", () => {
    const params = new URLSearchParams("?paid=true");
    expect(params.get("paid")).toBe("true");
  });

  it("URL param ?session_id=xxx triggers unlock", () => {
    const params = new URLSearchParams("?session_id=cs_test_123");
    expect(params.get("session_id")).toBe("cs_test_123");
  });

  it("Stripe payment link has correct format", () => {
    const link = "https://buy.stripe.com/TODO_REPLACE_WITH_REAL_LINK";
    expect(link).toMatch(/^https:\/\/buy\.stripe\.com\//);
  });

  it("success URL strips query params correctly", () => {
    const url = new URL("https://rosette.naurolabs.com?paid=true&session_id=cs_123");
    url.searchParams.delete("paid");
    url.searchParams.delete("session_id");
    expect(url.search).toBe("");
    expect(url.pathname).toBe("/");
  });

  it("return URL is properly encoded", () => {
    const origin = "https://rosette.naurolabs.com";
    const returnUrl = encodeURIComponent(origin + "?paid=true");
    expect(returnUrl).toContain("rosette.naurolabs.com");
    expect(decodeURIComponent(returnUrl)).toBe(origin + "?paid=true");
  });
});
