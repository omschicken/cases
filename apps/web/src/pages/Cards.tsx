import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, rarityColor } from "../lib/rarity";
import type { InventoryItemDto, ItemRarity } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { Gate } from "../components/dz/SelectableItem";
import { ItemCard } from "../components/dz/ItemCard";

const rarities: Array<ItemRarity | "ALL"> = ["ALL", "GOLD", "COVERT", "CLASSIFIED", "RESTRICTED", "MIL_SPEC", "INDUSTRIAL", "CONSUMER"];

export function CardsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [filter, setFilter] = useState<ItemRarity | "ALL">("ALL");
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (user) api.get<InventoryItemDto[]>("/cases/inventory/me").then(setInventory).catch(() => setError("Не удалось загрузить коллекцию. Обнови страницу, чтобы попробовать снова.")).finally(() => setLoading(false)); }, [user]);
  const cards = useMemo(() => {
    const map = new Map<string, { item: InventoryItemDto["caseItem"]; count: number }>();
    inventory.forEach(({ caseItem }) => { const current = map.get(caseItem.id); map.set(caseItem.id, { item: caseItem, count: (current?.count ?? 0) + 1 }); });
    return [...map.values()].sort((a, b) => Number(BigInt(b.item.valueMinor) - BigInt(a.item.valueMinor)));
  }, [inventory]);
  const visible = filter === "ALL" ? cards : cards.filter(({ item }) => item.rarity === filter);
  const totalValue = inventory.reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n);
  if (!user) return <Gate kicker="DROPZONE / CARDS" title="КАРТОЧКИ" body="Войди, чтобы открыть свой коллекционный архив." action={<Link to="/login" className="dz-commit">Войти <span aria-hidden="true">↗</span></Link>} />;
  return <div className="dz-workspace">
    <PageHeader kicker="АРХИВ / ТВОЯ КОЛЛЕКЦИЯ" title="КАРТОЧКИ" lede="Каждый уникальный предмет в инвентаре становится карточкой. Собирай редкости, отслеживай дубликаты и стоимость архива." aside={<><Readout label="УНИКАЛЬНЫХ" value={String(cards.length)} /><Readout label="АРХИВ" value={formatMinor(totalValue.toString())} /></>} />
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {cards.length > 0 && <nav className="dz-chips" aria-label="Фильтр редкости">{rarities.map((rarity) => <button type="button" key={rarity} className="dz-chip" aria-pressed={filter === rarity} style={rarity === "ALL" ? undefined : ({ "--dz-rarity": rarityColor(rarity) } as CSSProperties)} onClick={() => setFilter(rarity)}>{rarity === "ALL" ? "Все" : t(`rarity.${rarity}`, { defaultValue: RARITY_LABELS[rarity] })} <b>{rarity === "ALL" ? cards.length : cards.filter(({ item }) => item.rarity === rarity).length}</b></button>)}</nav>}
    {loading ? <p>Загрузка коллекции…</p> : error ? null : visible.length === 0 ? <GameEmptyState variant="cards" label="АРХИВ / КОЛЛЕКЦИЯ" title={cards.length === 0 ? "Первая карточка ждёт тебя" : "В этой редкости пока пусто"} description={cards.length === 0 ? "Каждый новый предмет пополнит твой архив. Открой кейс, чтобы собрать первую карточку." : "В коллекции есть другие предметы. Вернись ко всем редкостям или продолжай собирать архив."} action={cards.length === 0 ? <Link to="/#collections">Перейти к кейсам <span aria-hidden="true">↗</span></Link> : <button type="button" onClick={() => setFilter("ALL")}>Показать все карточки <span aria-hidden="true">↗</span></button>}/> : <section className="dz-item-grid">{visible.map(({ item, count }) => <ItemCard key={item.id} name={item.name} imageUrl={item.imageUrl} rarity={item.rarity} rarityLabel={t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })} value={formatMinor(item.valueMinor, item.currency)} badge={count > 1 ? `×${count}` : undefined} meta={count > 1 ? "Дубликат" : "Уникальный"} />)}</section>}
    {!loading && !error && cards.length === 0 && <GameSteps label="КАК РАБОТАЕТ АРХИВ" steps={[{ title: "Открой кейс", description: "Полученный предмет сразу появится в инвентаре." }, { title: "Собирай разные предметы", description: "Каждый уникальный предмет займёт одну карточку в архиве." }, { title: "Следи за коллекцией", description: "Здесь видны редкости, дубликаты и общая стоимость." }]}/>}
  </div>;
}
