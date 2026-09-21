import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const icon = readFileSync(new URL("../public/rosette.svg", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("approved Rosette identity", () => {
  it("serves the original Rosette mark instead of a scaffold favicon", () => {
    expect(html).toContain('href="/rosette.svg"');
    expect(html).not.toContain("vite.svg");
    for (const geometry of [
      'viewBox="0 0 36 36"',
      'x="3" y="3" width="30" height="30" rx="9"',
      'cx="18" cy="18" r="9"',
      'd="M14 16v4m8-4v4M18 8v3m0 14v3"',
    ]) {
      expect(icon).toContain(geometry);
      expect(app).toContain(geometry);
    }
  });

  it("preserves the existing document title and responsive metadata", () => {
    expect(html).toContain("<title>rosette — Electric Socket Planner</title>");
    expect(html).toContain('<meta charset="UTF-8"');
    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1.0"');
  });
});
