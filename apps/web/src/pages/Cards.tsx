import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { InventoryItemDto, ItemRarity } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";

const rarities: Array<ItemRarity | "ALL"> = ["ALL", "GOLD", "COVERT", "CLASSIFIED", "RESTRICTED", "MIL_SPEC", "INDUSTRIAL", "CONSUMER"];

export function CardsPage() {
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
  if (!user) return <div className="game-workspace game-auth game-auth--cards"><span>DROPZONE / CARDS</span><h1>КАРТОЧКИ</h1><p>Войди, чтобы открыть свой коллекционный архив.</p><Link to="/login" className="feature-primary">Войти <span aria-hidden="true">↗</span></Link></div>;
  return <div className="game-workspace cards-workspace">
    <PageHeader kicker="АРХИВ / ТВОЯ КОЛЛЕКЦИЯ" title="КАРТОЧКИ" lede="Каждый уникальный предмет в инвентаре становится карточкой. Собирай редкости, отслеживай дубликаты и стоимость архива." aside={<><Readout label="УНИКАЛЬНЫХ" value={String(cards.length)} /><Readout label="АРХИВ" value={formatMinor(totalValue.toString())} /></>} />
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {cards.length > 0 && <nav className="cards-filters" aria-label="Фильтр редкости">{rarities.map((rarity) => <button type="button" key={rarity} className={filter === rarity ? "active" : ""} onClick={() => setFilter(rarity)}>{rarity === "ALL" ? "ВСЕ" : rarity.replace("_", " ")} <span>{rarity === "ALL" ? cards.length : cards.filter(({ item }) => item.rarity === rarity).length}</span></button>)}</nav>}
    {loading ? <p>Загрузка коллекции…</p> : error ? null : visible.length === 0 ? <GameEmptyState variant="cards" label="АРХИВ / КОЛЛЕКЦИЯ" title={cards.length === 0 ? "Первая карточка ждёт тебя" : "В этой редкости пока пусто"} description={cards.length === 0 ? "Каждый новый предмет пополнит твой архив. Открой кейс, чтобы собрать первую карточку." : "В коллекции есть другие предметы. Вернись ко всем редкостям или продолжай собирать архив."} action={cards.length === 0 ? <Link to="/#collections">Перейти к кейсам <span aria-hidden="true">↗</span></Link> : <button type="button" onClick={() => setFilter("ALL")}>Показать все карточки <span aria-hidden="true">↗</span></button>}/> : <section className="collectible-grid">{visible.map(({ item, count }, index) => <article key={item.id} className="collectible-card" style={{ "--rarity-color": rarityColor(item.rarity), "--card-tilt": `${(index % 5 - 2) * .35}deg` } as CSSProperties}><div className="collectible-card-top"><span>DZ / {String(index + 1).padStart(3, "0")}</span><b>{item.rarity}</b></div><div className="collectible-art"><span aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span><img src={item.imageUrl} alt={item.name}/></div><div className="collectible-copy"><strong>{item.name}</strong><span>{formatMinor(item.valueMinor, item.currency)}</span></div><div className="collectible-card-foot"><span>OWNED ×{count}</span><i>{count > 1 ? "DUPLICATE" : "UNIQUE"}</i></div></article>)}</section>}
    {!loading && !error && cards.length === 0 && <GameSteps label="КАК РАБОТАЕТ АРХИВ" steps={[{ title: "Открой кейс", description: "Полученный предмет сразу появится в инвентаре." }, { title: "Собирай разные предметы", description: "Каждый уникальный предмет займёт одну карточку в архиве." }, { title: "Следи за коллекцией", description: "Здесь видны редкости, дубликаты и общая стоимость." }]}/>}
  </div>;
}
