import fixture from "../../e2e/fixtures/static.json";
import type { CaseDto, CaseItem, GameOperationDto, InventoryItemDto, LedgerEntryDto } from "./types";

// This module is reachable only in an explicitly isolated audit build. It never
// uses fetch, tokens, payment providers, or a database. Values are UI fixtures.
const KEY = "casecrow:audit-sandbox:v1";
type Operation = GameOperationDto & { inputInventoryItemIds: string[] };
type State = { balance: string; inventory: InventoryItemDto[]; operations: Operation[]; ledger: LedgerEntryDto[]; nonce: number };
const slugs = ["static", "neon-rush", "phantom", "ignition", "tidal", "overdrive", "sovereign", "dragon", "blacklight", "aurora"];
const catalog: CaseDto[] = slugs.map((slug, index) => ({
  ...fixture, id: `audit-case-${index}`, slug,
  name: slug.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ") + " Case",
  priceMinor: String(10000 + index * 20000), canOpen: true, canBattle: true,
  items: fixture.items as CaseItem[],
}));
function fresh(): State {
  return { balance: "10000000", nonce: 0, ledger: [], operations: [], inventory: fixture.items.slice(0, 16).map((caseItem, index) => ({
    id: `audit-inventory-${index}`, status: "IN_INVENTORY", acquiredAt: new Date().toISOString(), caseItem: caseItem as CaseItem,
  })) };
}
function read(): State { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null") ?? fresh(); } catch { return fresh(); } }
function save(state: State) { sessionStorage.setItem(KEY, JSON.stringify(state)); }
export function resetAuditSandbox() { sessionStorage.removeItem(KEY); location.reload(); }

export async function auditRequest(path: string, options: RequestInit): Promise<unknown> {
  const state = read();
  const input = typeof options.body === "string" ? JSON.parse(options.body) : {};
  const available = state.inventory.filter(item => item.status === "IN_INVENTORY");
  const itemById = (id: string) => {
    const item = available.find(item => item.id === id);
    if (!item) throw new Error("Тестовый предмет уже использован");
    return item;
  };
  const add = (item: CaseItem) => {
    const id = `audit-item-${crypto.randomUUID()}`;
    state.inventory.unshift({ id, status: "IN_INVENTORY", acquiredAt: new Date().toISOString(), caseItem: item });
    return id;
  };
  const operation = (type: Operation["type"], ids: string[], caseId?: string): Operation => {
    const result: Operation = { id: `audit-operation-${++state.nonce}`, type, inputInventoryItemIds: ids, status: "WON", chance: .5, roll: .1, nonce: state.nonce, serverSeedHash: "audit-fixture-no-real-seed", createdAt: new Date().toISOString(), metadata: { caseId } };
    state.operations.unshift(result);
    return result;
  };
  const settle = (value: unknown) => {
    save(state);
    window.dispatchEvent(new Event("casecrow:wallet-updated"));
    window.dispatchEvent(new Event("casecrow:inventory-updated"));
    return value;
  };
  if (path === "/auth/me") return { id: "audit-user", email: "audit@example.test", displayName: "Тестовый игрок", role: "USER" };
  if (path === "/cases") return catalog;
  if (path === "/wallet/me") return { balanceMinor: state.balance };
  if (path === "/wallet/me/ledger") return state.ledger;
  if (path === "/cases/inventory/me") return available;
  if (path === "/games/operations/me") return state.operations;
  if (path === "/games/upgrade-targets") return fixture.items;
  if (path === "/cases/seed/me") return { serverSeedHash: "audit-fixture-no-real-seed", clientSeed: "audit-fixture" };
  if (path === "/cases/open" || path === "/cases/open-batch") {
    const chosen = catalog.find(item => item.id === input.caseId);
    const count = path.endsWith("open-batch") ? input.count : 1;
    if (!chosen || ![1, 3, 5].includes(count)) throw new Error("Неверный тестовый кейс или количество");
    const price = BigInt(chosen.priceMinor) * BigInt(count);
    if (BigInt(state.balance) < price) throw new Error("Недостаточно тестовых средств");
    state.balance = String(BigInt(state.balance) - price);
    const results = Array.from({ length: count }, () => {
      const item = chosen.items[state.nonce++ % 8];
      return { item, inventoryItemId: add(item), openEventId: `audit-open-${state.nonce}`, nonce: state.nonce, roll: .1, serverSeedHash: "audit-fixture-no-real-seed", clientSeed: "audit-fixture" };
    });
    return settle(count === 1 ? results[0] : { results });
  }
  if (path === "/games/contracts/quote" || path === "/games/contracts") {
    const ids: string[] = input.inventoryItemIds ?? [];
    if (new Set(ids).size !== ids.length || ids.length < 3 || ids.length > 10) throw new Error("Выберите от 3 до 10 разных тестовых предметов");
    const selected = ids.map(itemById);
    const total = selected.reduce((sum, value) => sum + BigInt(value.caseItem.valueMinor), 0n);
    const sorted = [...fixture.items].sort((a, b) => Number(BigInt(a.valueMinor) - BigInt(b.valueMinor)));
    const low = sorted[0], high = sorted.find(item => BigInt(item.valueMinor) > total) ?? sorted[sorted.length - 1];
    const highChance = Math.max(0, Math.min(1, Number(total * 9n / 10n - BigInt(low.valueMinor)) / Number(BigInt(high.valueMinor) - BigInt(low.valueMinor))));
    if (path.endsWith("/quote")) return { available: true, inputValueMinor: String(total), expectedReturnMinor: String(total * 9n / 10n), low, high, highChance };
    selected.forEach(item => { item.status = "CONSUMED"; });
    return settle({ operation: operation("CONTRACT", ids), item: high, inventoryItemId: add(high as CaseItem), inputValueMinor: String(total) });
  }
  if (path === "/games/upgrades") {
    const source = itemById(input.inventoryItemId);
    const target = fixture.items.find(item => item.id === input.targetCaseItemId);
    if (!target || BigInt(target.valueMinor) <= BigInt(source.caseItem.valueMinor)) throw new Error("Выберите более дорогую тестовую цель");
    source.status = "CONSUMED";
    add(target as CaseItem);
    return settle({ operation: operation("UPGRADE", [source.id]), won: true, item: target, target, chance: .31 });
  }
  if (path === "/games/battles") {
    const chosen = catalog.find(item => item.id === input.caseId);
    if (!chosen || BigInt(state.balance) < BigInt(chosen.priceMinor)) throw new Error("Недостаточно тестовых средств");
    state.balance = String(BigInt(state.balance) - BigInt(chosen.priceMinor));
    const playerItem = chosen.items[1], botItem = chosen.items[0];
    return settle({ operation: operation("BATTLE", [], chosen.id), won: true, battleCase: chosen, playerItem, botItem, winnings: [add(playerItem), add(botItem)] });
  }
  if (/^\/cases\/inventory\/[^/]+\/sell$/.test(path)) {
    const item = itemById(path.split("/")[3]);
    item.status = "SOLD";
    state.balance = String(BigInt(state.balance) + BigInt(item.caseItem.valueMinor));
    state.ledger.unshift({ id: crypto.randomUUID(), referenceId: item.id, referenceType: "ITEM", amountMinor: item.caseItem.valueMinor, balanceAfterMinor: state.balance, reason: "ITEM_SELL", createdAt: new Date().toISOString() });
    return settle(item);
  }
  const chosen = catalog.find(item => path === `/cases/${item.slug}`);
  if (chosen) return chosen;
  throw new Error("Этот раздел недоступен в тестовом preview. Боевые запросы отключены.");
}
