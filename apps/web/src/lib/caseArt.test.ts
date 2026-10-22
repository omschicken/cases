import { describe, expect, it } from "vitest";
import { APPROVED_CASE_SLUGS, CASE_ART_BY_SLUG, caseVersionLabel, resolveCaseArt } from "./caseArt";

const activeSlugs = [
  "static", "neon-rush", "phantom", "ignition", "tidal", "overdrive",
  "sovereign", "dragon", "blacklight", "aurora", "blacklight-case-v4",
  "ignition-case-v4", "sovereign-case-v3", "overdrive-case-v3", "static-case-v3",
] as const;

describe("approved CaseCrow case art", () => {
  it("maps every active catalog slug to an approved bundled asset", () => {
    expect(APPROVED_CASE_SLUGS).toHaveLength(15);
    for (const slug of activeSlugs) {
      expect(resolveCaseArt(slug)).toBe(CASE_ART_BY_SLUG[slug]);
      expect(resolveCaseArt(slug)).toMatch(/case_\d{2}\.webp$/);
    }
  });

  it("never replaces an unknown API case with unrelated approved art", () => {
    expect(resolveCaseArt("future-case", "/future.webp")).toBe("/future.webp");
  });

  it("labels only versioned catalog records", () => {
    expect(caseVersionLabel("static-case-v3")).toBe("V3");
    expect(caseVersionLabel("ignition-case-v4")).toBe("V4");
    expect(caseVersionLabel("static")).toBeNull();
  });
});
