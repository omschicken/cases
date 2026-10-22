import { describe, expect, it } from "vitest";
import { publicName } from "../src/leaderboard/leaderboard.service";

describe("publicName", () => {
  it("prefers the display name", () => expect(publicName(" Neo ", "a@b.c")).toBe("Neo"));
  it("never exposes the full email prefix", () => expect(publicName(null, "johnsmith@mail.com")).toBe("jo***"));
});
