import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS } from "../lib/rarity";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Step, Outcome , Gate} from "../components/dz/SelectableItem";

type UpgradeResult = { operation: GameOperationDto; won: boolean; item: CaseItem | null; target: CaseItem; chance: number };

export function UpgraderPage() {
  const { t } = useTranslation();
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

  if (!user) return <Gate kicker="DROPZONE / UPGRADER" title="АПГРЕЙД" body="Войди, чтобы выбрать предмет и цель." action={<Link to="/login" className="dz-commit">Войти <span aria-hidden="true">↗</span></Link>} />;

  return <div className="dz-workspace">
    <PageHeader kicker="ЛАБОРАТОРИЯ / LIVE" title="АПГРЕЙД" lede="Выбери свой предмет и более дорогую цель. Шанс рассчитывается до подтверждения и ограничен 75%." aside={<Readout label="ШАНС" value={`${(chance * 100).toFixed(1)}%`} />} />
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <Outcome won={result.won} label={result.won ? "АПГРЕЙД УСПЕШЕН" : "ПОПЫТКА НЕ УДАЛАСЬ"} name={result.won ? result.target.name : "Предмет использован"} meta={`ROLL ${result.operation.roll.toFixed(5)} / ${(result.chance * 100).toFixed(1)}%`} imageUrl={result.won && result.item ? result.item.imageUrl : undefined} />}
    {loading ? <p>Загрузка…</p> : <div className="upgrade-layout">
      <section><Step label="01 / Твой предмет" count={inventory.length} />{inventory.length === 0 ? <GameEmptyState variant="upgrade-source" label="СТАРТ / ИНВЕНТАРЬ" title="Нужен исходный предмет" description="Открой кейс, чтобы получить предмет для апгрейда. Он появится здесь автоматически после обновления страницы." action={<Link to="/#collections">Открыть каталог <span aria-hidden="true">↗</span></Link>}/> : <div className="dz-pick-grid">{inventory.map((item) => <SelectableItem key={item.id} name={item.caseItem.name} imageUrl={item.caseItem.imageUrl} value={formatMinor(item.caseItem.valueMinor, item.caseItem.currency)} rarity={item.caseItem.rarity} rarityLabel={t(`rarity.${item.caseItem.rarity}`, { defaultValue: RARITY_LABELS[item.caseItem.rarity] })} selected={sourceId === item.id} disabled={submitting} onSelect={() => { setSourceId(item.id); setTargetId(""); setResult(null); setConfirming(false); }} />)}</div>}</section>
      <div className="upgrade-arrow" aria-hidden="true">→</div>
      <section><Step label="02 / Цель" count={eligibleTargets.length} />{!source ? <GameEmptyState variant="upgrade-target" label="ЦЕЛЬ / ЗАБЛОКИРОВАНА" title="Сначала выбери предмет" description="После выбора мы покажем только цели дороже исходного предмета и рассчитаем шанс."/> : eligibleTargets.length === 0 ? <GameEmptyState variant="upgrade-target" label="ЦЕЛЬ / НЕТ ВАРИАНТОВ" title="Нет подходящих целей" description="Для этого предмета сейчас нет более дорогих целей. Выбери другой исходный предмет."/> : <div className="dz-pick-grid">{eligibleTargets.map((item) => <SelectableItem key={item.id} name={item.name} imageUrl={item.imageUrl} value={formatMinor(item.valueMinor, item.currency)} rarity={item.rarity} rarityLabel={t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })} selected={targetId === item.id} disabled={submitting} onSelect={() => { setTargetId(item.id); setResult(null); setConfirming(false); }} />)}</div>}</section>
    </div>}
    <aside className="dz-summary">
      <span className="dz-summary__label">Итоговый шанс</span>
      <span className="dz-summary__figure">{(chance * 100).toFixed(1)}%</span>
      <p className="dz-summary__label">При неудаче исходный предмет будет использован. Каждый результат записывается с roll и nonce.</p>
      {confirming
        ? <div className="dz-confirm">
            <button type="button" className="dz-commit" onClick={() => void execute()} disabled={submitting}>{submitting ? "Выполняем…" : "Подтвердить попытку"}</button>
            <button type="button" className="dz-confirm__cancel" onClick={() => setConfirming(false)} disabled={submitting}>Отмена</button>
          </div>
        : <button type="button" className="dz-commit" disabled={!source || !target} onClick={() => setConfirming(true)}>Запустить апгрейд</button>}
    </aside>
    {!loading && inventory.length === 0 && <GameSteps label="ПУТЬ К АПГРЕЙДУ" steps={[{ title: "Получи предмет", description: "Открой кейс — полученный предмет появится в инвентаре." }, { title: "Выбери цель", description: "Доступны только предметы дороже исходного. Шанс виден до подтверждения." }, { title: "Реши, рисковать ли", description: "При неудаче исходный предмет будет использован." }]}/>}
  </div>;
}
