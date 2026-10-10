import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { InventoryItemDto } from "../lib/types";

export function InventoryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const visibleItems = useMemo(() => {
    const filtered = rarityFilter === "all" ? items : items.filter((item) => item.caseItem.rarity === rarityFilter);
    return [...filtered].sort((a, b) => {
      if (sort === "value-desc") return Number(BigInt(b.caseItem.valueMinor) - BigInt(a.caseItem.valueMinor));
      if (sort === "value-asc") return Number(BigInt(a.caseItem.valueMinor) - BigInt(b.caseItem.valueMinor));
      return 0;
    });
  }, [items, rarityFilter, sort]);

  function load() {
    api
      .get<InventoryItemDto[]>("/cases/inventory/me")
      .then(setItems)
      .catch(() => setError(t("inventory.couldNotLoad")));
  }

  useEffect(load, [t]);

  async function sell(id: string) {
    setSellingId(id);
    setError(null);
    try {
      await api.post(`/cases/inventory/${id}/sell`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("inventory.couldNotSell"));
    } finally {
      setSellingId(null);
    }
  }

  return (
    <div>
      <div className="inventory-heading"><div><p className="section-kicker">{t("inventory.kicker", { defaultValue: "YOUR LOADOUT" })}</p><h1>{t("inventory.title")}</h1></div><div className="inventory-controls"><label><span>{t("inventory.filter", { defaultValue: "Редкость" })}</span><select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}><option value="all">{t("inventory.all", { defaultValue: "Все" })}</option><option value="rare">{t("inventory.rare", { defaultValue: "Редкие" })}</option><option value="mythical">{t("inventory.mythical", { defaultValue: "Мифические" })}</option><option value="legendary">{t("inventory.legendary", { defaultValue: "Легендарные" })}</option><option value="chase">{t("inventory.chase", { defaultValue: "Особые" })}</option></select></label><label><span>{t("inventory.sort", { defaultValue: "Сортировка" })}</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">{t("inventory.newest", { defaultValue: "Новые" })}</option><option value="value-desc">{t("inventory.valueDesc", { defaultValue: "Цена: по убыванию" })}</option><option value="value-asc">{t("inventory.valueAsc", { defaultValue: "Цена: по возрастанию" })}</option></select></label></div></div>
      {error && <p className="form-error">{error}</p>}
      <div className="item-grid">
        {visibleItems.map((inv) => (
          <div
            className="item-card"
            key={inv.id}
            style={{ "--rarity-color": rarityColor(inv.caseItem.rarity) } as CSSProperties}
          >
            <img src={inv.caseItem.imageUrl} alt={inv.caseItem.name} />
            <p>{inv.caseItem.name}</p>
            <p className="value">{formatMinor(inv.caseItem.valueMinor, inv.caseItem.currency)}</p>
            <button onClick={() => sell(inv.id)} disabled={sellingId === inv.id}>
              {sellingId === inv.id ? t("inventory.selling") : t("inventory.sellForBalance")}
            </button>
          </div>
        ))}
        {items.length === 0 && <p>{t("inventory.noItemsYet")}</p>}{items.length > 0 && visibleItems.length === 0 && <p className="hint">{t("inventory.noFilteredItems", { defaultValue: "По этому фильтру предметов нет." })}</p>}
      </div>
    </div>
  );
}
