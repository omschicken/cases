import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";

type UpgradeResult = { operation: GameOperationDto; won: boolean; item: CaseItem | null; target: CaseItem; chance: number };

export function UpgraderPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [targets, setTargets] = useState<CaseItem[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpgradeResult | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.get<InventoryItemDto[]>("/cases/inventory/me"), api.get<CaseItem[]>("/games/upgrade-targets")])
      .then(([items, nextTargets]) => { setInventory(items); setTargets(nextTargets); })
      .catch(() => setError("Не удалось загрузить предметы"))
      .finally(() => setLoading(false));
  }, [user]);

  const source = inventory.find((item) => item.id === sourceId);
  const eligibleTargets = useMemo(() => source ? targets.filter((item) => BigInt(item.valueMinor) > BigInt(source.caseItem.valueMinor)).slice(0, 120) : [], [source, targets]);
  const target = eligibleTargets.find((item) => item.id === targetId);
  const chance = source && target ? Math.max(.01, Math.min(.75, Number(BigInt(source.caseItem.valueMinor) * 90_000n / BigInt(target.valueMinor)) / 100_000)) : 0;

  async function execute() {
    if (!source || !target || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try {
      const next = await api.post<UpgradeResult>("/games/upgrades", { inventoryItemId: source.id, targetCaseItemId: target.id });
      setResult(next); setInventory((items) => items.filter((item) => item.id !== source.id)); setSourceId(""); setTargetId(""); setConfirming(false);
      const currentItems = await api.get<InventoryItemDto[]>("/cases/inventory/me").catch(() => null);
      if (currentItems) setInventory(currentItems);
    } catch (err) { setError(err instanceof ApiError && err.status === 0 ? "Ответ не получен. Проверь инвентарь перед повтором." : err instanceof ApiError ? err.message : "Апгрейд не выполнен"); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (!user) return <div className="game-workspace game-auth game-auth--upgrader"><span>DROPZONE / UPGRADER</span><h1>АПГРЕЙД</h1><p>Войди, чтобы выбрать предмет и цель.</p><Link to="/login" className="feature-primary">Войти <span aria-hidden="true">↗</span></Link></div>;

  return <div className="game-workspace game-workspace--upgrade">
    <header className="game-heading"><div><span className="section-kicker">ЛАБОРАТОРИЯ / LIVE</span><h1>АПГРЕЙД</h1><p>Выбери свой предмет и более дорогую цель. Шанс рассчитывается до подтверждения и ограничен 75%.</p></div><div className="upgrade-chance"><span>ШАНС</span><strong>{(chance * 100).toFixed(1)}%</strong></div></header>
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <section className={`game-result ${result.won ? "game-result--won" : "game-result--lost"}`}><span>{result.won ? "АПГРЕЙД УСПЕШЕН" : "ПОПЫТКА НЕ УДАЛАСЬ"}</span>{result.won && result.item && <img src={result.item.imageUrl} alt={result.item.name}/>}<div><h2>{result.won ? result.target.name : "Предмет использован"}</h2><strong>ROLL {result.operation.roll.toFixed(5)} / {(result.chance * 100).toFixed(1)}%</strong></div></section>}
    {loading ? <p>Загрузка…</p> : <div className="upgrade-layout">
      <section><div className="game-section-label"><span>01 / ТВОЙ ПРЕДМЕТ</span><span>{inventory.length}</span></div>{inventory.length === 0 ? <GameEmptyState variant="upgrade-source" label="СТАРТ / ИНВЕНТАРЬ" title="Нужен исходный предмет" description="Открой кейс, чтобы получить предмет для апгрейда. Он появится здесь автоматически после обновления страницы." action={<Link to="/#collections">Открыть каталог <span aria-hidden="true">↗</span></Link>}/> : <div className="game-item-grid">{inventory.map((item) => <button type="button" key={item.id} disabled={submitting} className={`game-item ${sourceId === item.id ? "selected" : ""}`} onClick={() => { setSourceId(item.id); setTargetId(""); setResult(null); setConfirming(false); }} style={{ "--rarity-color": rarityColor(item.caseItem.rarity) } as CSSProperties}><img src={item.caseItem.imageUrl} alt=""/><strong>{item.caseItem.name}</strong><b>{formatMinor(item.caseItem.valueMinor, item.caseItem.currency)}</b></button>)}</div>}</section>
      <div className="upgrade-arrow" aria-hidden="true">→</div>
      <section><div className="game-section-label"><span>02 / ЦЕЛЬ</span><span>{eligibleTargets.length}</span></div>{!source ? <GameEmptyState variant="upgrade-target" label="ЦЕЛЬ / ЗАБЛОКИРОВАНА" title="Сначала выбери предмет" description="После выбора мы покажем только цели дороже исходного предмета и рассчитаем шанс."/> : eligibleTargets.length === 0 ? <GameEmptyState variant="upgrade-target" label="ЦЕЛЬ / НЕТ ВАРИАНТОВ" title="Нет подходящих целей" description="Для этого предмета сейчас нет более дорогих целей. Выбери другой исходный предмет."/> : <div className="game-item-grid">{eligibleTargets.map((item) => <button type="button" key={item.id} disabled={submitting} className={`game-item ${targetId === item.id ? "selected" : ""}`} onClick={() => { setTargetId(item.id); setResult(null); setConfirming(false); }} style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}><img src={item.imageUrl} alt=""/><strong>{item.name}</strong><b>{formatMinor(item.valueMinor, item.currency)}</b></button>)}</div>}</section>
    </div>}
    <aside className="upgrade-runbar"><div><span>ИТОГОВЫЙ ШАНС</span><strong>{(chance * 100).toFixed(1)}%</strong></div><p>При неудаче исходный предмет будет использован. Каждый результат записывается с roll и nonce.</p>{confirming ? <div className="game-confirm"><button type="button" onClick={() => void execute()} disabled={submitting}>{submitting ? "Выполняем…" : "Подтвердить попытку"}</button><button type="button" onClick={() => setConfirming(false)} disabled={submitting}>Отмена</button></div> : <button type="button" className="game-run" disabled={!source || !target} onClick={() => setConfirming(true)}>Запустить апгрейд</button>}</aside>
    {!loading && inventory.length === 0 && <GameSteps label="ПУТЬ К АПГРЕЙДУ" steps={[{ title: "Получи предмет", description: "Открой кейс — полученный предмет появится в инвентаре." }, { title: "Выбери цель", description: "Доступны только предметы дороже исходного. Шанс виден до подтверждения." }, { title: "Реши, рисковать ли", description: "При неудаче исходный предмет будет использован." }]}/>}
  </div>;
}
