import { describe, expect, it, vi } from "vitest";
import { PublicReadCache } from "./publicReadCache";
describe("public read cache", () => {
  it("deduplicates pending reads and exposes the catalog on return navigation", async () => {
    const cache = new PublicReadCache();
    let resolve!: (value: string[]) => void;
    const read = vi.fn(() => new Promise<string[]>(done => { resolve = done; }));
    const first = cache.get("/cases", read), second = cache.get("/cases", read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(cache.peek("/cases")).toBeUndefined();
    resolve(["real-case"]);
    expect(await first).toEqual(await second);
    expect(cache.peek("/cases")).toEqual(["real-case"]);
  });
  it("expires prices and retries failed reads", async () => {
    let now = 0;
    const cache = new PublicReadCache(() => now, 100);
    const read = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce([1]).mockResolvedValueOnce([2]);
    await expect(cache.get("/cases", read)).rejects.toThrow("offline");
    expect(await cache.get("/cases", read)).toEqual([1]);
    now = 101;
    expect(cache.peek("/cases")).toBeUndefined();
    expect(await cache.get("/cases", read)).toEqual([2]);
  });
  it("never caches balances, inventory, quotes, or live case details", async () => {
    const cache = new PublicReadCache();
    for (const path of ["/wallet/me", "/cases/inventory/me", "/games/contracts/quote", "/cases/static"]) {
      const read = vi.fn().mockResolvedValue("fresh");
      await cache.get(path, read); await cache.get(path, read);
      expect(read).toHaveBeenCalledTimes(2);
      expect(cache.peek(path)).toBeUndefined();
    }
  });
});
