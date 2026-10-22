import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditRequest } from "./auditSandbox";
import type { CaseDto, InventoryItemDto, OpenCaseResult } from "./types";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Sandbox must never use the network"); }));
});
const post = (path: string, body: unknown) => auditRequest(path, { method: "POST", body: JSON.stringify(body) });
describe("isolated audit fixtures", () => {
  for (const count of [1, 3, 5]) it(`opens exactly ${count} test items and updates the test balance`, async () => {
    const catalog = await auditRequest("/cases", {}) as CaseDto[];
    const before = await auditRequest("/cases/inventory/me", {}) as InventoryItemDto[];
    const output = await post(count === 1 ? "/cases/open" : "/cases/open-batch", { caseId: catalog[0].id, count }) as OpenCaseResult | { results: OpenCaseResult[] };
    expect("results" in output ? output.results.length : 1).toBe(count);
    expect((await auditRequest("/cases/inventory/me", {}) as InventoryItemDto[]).length).toBe(before.length + count);
    expect(await auditRequest("/wallet/me", {})).toEqual({ balanceMinor: String(10000000 - count * 10000) });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("quotes the exact selection and prevents consumed-item reuse", async () => {
    const inventory = await auditRequest("/cases/inventory/me", {}) as InventoryItemDto[];
    const input = { inventoryItemIds: inventory.slice(0, 3).map(item => item.id) };
    const quote = await post("/games/contracts/quote", input) as { inputValueMinor: string };
    expect(quote.inputValueMinor).toBe(String(inventory.slice(0, 3).reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n)));
    await post("/games/contracts", input);
    await expect(post("/games/contracts", input)).rejects.toThrow("уже использован");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed on unsupported requests instead of forwarding them", async () => {
    await expect(post("/payments/create", { amount: 100 })).rejects.toThrow("Боевые запросы отключены");
    expect(fetch).not.toHaveBeenCalled();
  });
});
