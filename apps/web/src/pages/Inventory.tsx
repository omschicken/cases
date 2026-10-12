import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_RANK, rarityColor } from "../lib/rarity";
import type { InventoryItemDto, ItemRarity } from "../lib/types";

type SortMode = "newest" | "value-desc" | "value-asc";

export function InventoryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | "all">("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<InventoryItemDto[]>("/cases/inventory/me");
      setItems(data);
      setError(null);
    } catch {
      setError(t("inventory.couldNotLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const availableRarities = useMemo(() => {
    const present = new Set(items.map((item) => item.caseItem.rarity));
    return RARITY_RANK.filter((rarity) => present.has(rarity));
  }, [items]);
  useEffect(() => {
    if (rarityFilter !== "all" && !availableRarities.includes(rarityFilter)) setRarityFilter("all");
  }, [availableRarities, rarityFilter]);

  const visibleItems = useMemo(() => {
    const filtered = rarityFilter === "all" ? items : items.filter((item) => item.caseItem.rarity === rarityFilter);
    return [...filtered].sort((a, b) => {
      if (sort === "value-desc") return Number(BigInt(b.caseItem.valueMinor) - BigInt(a.caseItem.valueMinor));
      if (sort === "value-asc") return Number(BigInt(a.caseItem.valueMinor) - BigInt(b.caseItem.valueMinor));
      return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
    });
  }, [items, rarityFilter, sort]);

  async function sell(id: string) {
    if (sellingId) return;
    setSellingId(id);
    setError(null);
    try {
      await api.post(`/cases/inventory/${id}/sell`);
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("inventory.couldNotSell"));
    } finally {
      setSellingId(null);
    }
  }

  return (
    <div className="inventory-page">
      <div className="inventory-heading">
        <div>
          <p className="section-kicker">{t("inventory.kicker", { defaultValue: "YOUR LOADOUT" })}</p>
          <h1>{t("inventory.title")}</h1>
          <p className="section-intro">{t("inventory.intro", { defaultValue: "Your opened items. Choose a rarity or sort by value." })}</p>
        </div>
        <div className="inventory-controls">
          <label><span>{t("inventory.filter", { defaultValue: "Rarity" })}</span><select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as ItemRarity | "all")}>
            <option value="all">{t("inventory.all", { defaultValue: "All" })}</option>
            {availableRarities.map((rarity) => <option key={rarity} value={rarity}>{t(`rarity.${rarity}`, { defaultValue: rarity })}</option>)}
          </select></label>
          <label><span>{t("inventory.sort", { defaultValue: "Sort" })}</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="newest">{t("inventory.newest", { defaultValue: "Newest" })}</option>
            <option value="value-desc">{t("inventory.valueDesc", { defaultValue: "Highest value" })}</option>
            <option value="value-asc">{t("inventory.valueAsc", { defaultValue: "Lowest value" })}</option>
          </select></label>
        </div>
      </div>
      {error && <div className="catalog-notice" role="alert"><span>{error}</span><button className="catalog-retry" type="button" onClick={() => void load()}>{t("common.retry")}</button></div>}
      {loading && <div className="item-grid" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div className="item-card case-card-skeleton" key={index} aria-hidden="true" />)}</div>}
      {!loading && items.length === 0 && !error && <div className="inventory-empty"><span className="inventory-empty-icon" aria-hidden="true">◇</span><h2>{t("inventory.emptyTitle", { defaultValue: "Your collection starts here" })}</h2><p>{t("inventory.noItemsYet")}</p><Link to="/#collections" className="open-button">{t("inventory.exploreCases", { defaultValue: "Explore cases" })}</Link></div>}
      {!loading && items.length > 0 && visibleItems.length === 0 && <p className="hint">{t("inventory.noFilteredItems", { defaultValue: "No items match this filter." })}</p>}
      {!loading && visibleItems.length > 0 && <div className="item-grid inventory-grid">{visibleItems.map((inv) => <article className="item-card inventory-card" key={inv.id} style={{ "--rarity-color": rarityColor(inv.caseItem.rarity) } as CSSProperties}>
        <span className="inventory-card-rarity">{t(`rarity.${inv.caseItem.rarity}`, { defaultValue: inv.caseItem.rarity })}</span>
        <img src={inv.caseItem.imageUrl} alt={inv.caseItem.name} loading="lazy" />
        <h2>{inv.caseItem.name}</h2>
        <p className="value">{formatMinor(inv.caseItem.valueMinor, inv.caseItem.currency)}</p>
        {confirmId === inv.id ? <div className="inventory-sell-confirm"><p>{t("inventory.confirmSell", { price: formatMinor(inv.caseItem.valueMinor, inv.caseItem.currency), defaultValue: "Sell this item for {{price}}?" })}</p><div><button type="button" onClick={() => void sell(inv.id)} disabled={sellingId === inv.id}>{sellingId === inv.id ? t("inventory.selling") : t("inventory.confirm", { defaultValue: "Confirm sale" })}</button><button type="button" className="inventory-cancel" onClick={() => setConfirmId(null)} disabled={sellingId === inv.id}>{t("inventory.cancel", { defaultValue: "Cancel" })}</button></div></div> : <button type="button" onClick={() => setConfirmId(inv.id)} disabled={sellingId !== null}>{t("inventory.sellForBalance")}</button>}
      </article>)}</div>}
    </div>
  );
}
