import { describe, expect, it } from "vitest";
import { matchesCaseTheme } from "../src/prices/case-theme";

describe("strict collection finishes", () => {
  it("rejects similar colours and different finishes", () => {
    expect(matchesCaseTheme("fade", "★ Bayonet | Marble Fade (Factory New)")).toBe(false);
    expect(matchesCaseTheme("ruby-crystal", "MP9 | Ruby Poison Dart (Factory New)")).toBe(false);
    expect(matchesCaseTheme("sapphire-crystal", "★ Bayonet | Doppler (Factory New)")).toBe(false);
    expect(matchesCaseTheme("doppler", "★ Bayonet | Gamma Doppler (Phase 1) (Factory New)")).toBe(false);
  });
  it("requires explicit phase identity", () => {
    for (const phase of ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Ruby", "Sapphire", "Black Pearl"]) {
      expect(matchesCaseTheme("doppler", `★ Bayonet | Doppler (${phase}) (Factory New)`)).toBe(true);
      expect(matchesCaseTheme("ruby-crystal", `★ Bayonet | Doppler (${phase}) (Factory New)`)).toBe(phase === "Ruby");
      expect(matchesCaseTheme("sapphire-crystal", `★ Bayonet | Doppler (${phase}) (Factory New)`)).toBe(phase === "Sapphire");
    }
    expect(matchesCaseTheme("fade", "MP7 | Fade (Field-Tested)")).toBe(true);
    expect(matchesCaseTheme("static", "Any existing item")).toBe(true);
  });
});
