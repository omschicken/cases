import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { GameOperationDto, InventoryItemDto, CaseItem } from "../lib/types";

type ContractResult = { operation: GameOperationDto; item: CaseItem; inventoryItemId: string; inputValueMinor: string };

export function ContractsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContractResult | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<InventoryItemDto[]>("/cases/inventory/me").then(setItems).catch(() => setError("Не удалось загрузить инвентарь")).finally(() => setLoading(false));
  }, [user]);

  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]);
  const total = selectedItems.reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n);
  const rangeLow = total * 60n / 100n;
  const rangeHigh = total * 90n / 100n;

  function toggle(id: string) {
    if (submittingRef.current) return;
    setConfirming(false); setResult(null);
    setSelected((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : current.length < 10 ? [...current, id] : current);
  }

  async function execute() {
    if (submittingRef.current || selected.length < 3) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try {
      const next = await api.post<ContractResult>("/games/contracts", { inventoryItemIds: selected });
      setResult(next); setItems((current) => current.filter((item) => !selected.includes(item.id))); setSelected([]); setConfirming(false);
      const currentItems = await api.get<InventoryItemDto[]>("/cases/inventory/me").catch(() => null);
      if (currentItems) setItems(currentItems);
    } catch (err) { setError(err instanceof ApiError && err.status === 0 ? "Ответ не получен. Проверь инвентарь перед повтором." : err instanceof ApiError ? err.message : "Контракт не выполнен"); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (!user) return <div className="game-workspace game-auth game-auth--contracts"><span>DROPZONE / CONTRACTS</span><h1>КОНТРАКТЫ</h1><p>Войди в аккаунт, чтобы использовать предметы из своего инвентаря.</p><Link to="/login" className="feature-primary">Войти <span aria-hidden="true">↗</span></Link></div>;

  return <div className="game-workspace">
    <header className="game-heading"><div><span className="section-kicker">МАСТЕРСКАЯ / LIVE</span><h1>КОНТРАКТЫ</h1><p>Выбери от 3 до 10 предметов. Они будут обменены на один новый предмет стоимостью 60–90% от общей суммы.</p></div><div className="game-counter"><span>ВЫБРАНО</span><strong>{selected.length} / 10</strong></div></header>
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <section className="game-result game-result--won"><span>КОНТРАКТ ВЫПОЛНЕН</span><img src={result.item.imageUrl} alt={result.item.name}/><div><h2>{result.item.name}</h2><strong>{formatMinor(result.item.valueMinor, result.item.currency)}</strong></div><Link to="/inventory">Открыть инвентарь ↗</Link></section>}
    <div className="game-layout">
      <section><div className="game-section-label"><span>01 / ПРЕДМЕТЫ</span><span>{items.length} ДОСТУПНО</span></div>
        {loading ? <p>Загрузка…</p> : items.length === 0 ? <GameEmptyState variant="contracts" label="МАСТЕРСКАЯ / 03 → 01" title="Начни с трёх предметов" description="Твой инвентарь пока пуст. Открой кейсы, собери минимум три предмета и вернись, чтобы создать контракт." action={<Link to="/#collections">Выбрать кейс <span aria-hidden="true">↗</span></Link>}/> : <div className="game-item-grid">{items.map((item) => <button type="button" key={item.id} disabled={submitting} className={`game-item ${selected.includes(item.id) ? "selected" : ""}`} onClick={() => toggle(item.id)} style={{ "--rarity-color": rarityColor(item.caseItem.rarity) } as CSSProperties}><span>{item.caseItem.rarity}</span><img src={item.caseItem.imageUrl} alt=""/><strong>{item.caseItem.name}</strong><b>{formatMinor(item.caseItem.valueMinor, item.caseItem.currency)}</b></button>)}</div>}
      </section>
      <aside className="game-summary"><span className="game-summary-label">02 / РАСЧЁТ</span><div className="contract-slots" aria-label={`Выбрано ${selected.length} из 10 предметов`}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={index < selected.length ? "filled" : ""}/>)}</div><dl><div><dt>Предметов</dt><dd>{selected.length} / 10</dd></div><div><dt>Общая стоимость</dt><dd>{formatMinor(total.toString())}</dd></div><div><dt>Результат</dt><dd>{selected.length >= 3 ? `${formatMinor(rangeLow.toString())} — ${formatMinor(rangeHigh.toString())}` : "Выбери 3 предмета"}</dd></div></dl><p>Результат определяется сохранённым roll и nonce. Выбранные предметы будут безвозвратно использованы.</p>{confirming ? <div className="game-confirm"><button type="button" onClick={() => void execute()} disabled={submitting}>{submitting ? "Выполняем…" : "Подтвердить контракт"}</button><button type="button" onClick={() => setConfirming(false)} disabled={submitting}>Отмена</button></div> : <button type="button" className="game-run" disabled={selected.length < 3} onClick={() => setConfirming(true)}>Создать контракт</button>}</aside>
    </div>
    {!loading && items.length === 0 && <GameSteps label="ПУТЬ К КОНТРАКТУ" steps={[{ title: "Собери предметы", description: "Для обмена понадобится минимум три предмета из инвентаря." }, { title: "Заполни контракт", description: "Выбери от 3 до 10 предметов и проверь общую стоимость." }, { title: "Подтверди обмен", description: "После подтверждения предметы будут использованы, а результат появится в инвентаре." }]}/>}
  </div>;
}
