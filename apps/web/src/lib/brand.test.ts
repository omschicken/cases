import { describe, expect, it } from "vitest";
import { PUBLIC_BRAND } from "./brand";

describe("public brand foundation", () => {
  it("uses the approved CaseCrow spelling", () => {
    expect(PUBLIC_BRAND.name).toBe("CaseCrow");
    expect(PUBLIC_BRAND.logotype).toBe("casecrow");
    expect(PUBLIC_BRAND.title).toMatch(/^CaseCrow/);
  });

  it("does not expose the retired public brand", () => {
    expect(JSON.stringify(PUBLIC_BRAND)).not.toMatch(/dropzone/i);
  });
});
