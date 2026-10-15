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
import type { GameOperationDto, InventoryItemDto, CaseItem } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Gate, Step, Outcome, OutcomeLink } from "../components/dz/SelectableItem";

type ContractResult = { operation: GameOperationDto; item: CaseItem; inventoryItemId: string; inputValueMinor: string };

export function ContractsPage() {
  const { t } = useTranslation();
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

  if (!user) return <Gate kicker="DROPZONE / CONTRACTS" title="КОНТРАКТЫ" body="Войди в аккаунт, чтобы использовать предметы из своего инвентаря." action={<Link to="/login" className="dz-commit">Войти <span aria-hidden="true">↗</span></Link>} />;

  return <div className="dz-workspace">
    <PageHeader kicker="МАСТЕРСКАЯ / LIVE" title="КОНТРАКТЫ" lede="Выбери от 3 до 10 предметов. Они будут обменены на один новый предмет стоимостью 60–90% от общей суммы." aside={<Readout label="ВЫБРАНО" value={`${selected.length} / 10`} />} />
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <Outcome won label="КОНТРАКТ ВЫПОЛНЕН" name={result.item.name} meta={formatMinor(result.item.valueMinor, result.item.currency)} imageUrl={result.item.imageUrl} action={<OutcomeLink to="/inventory">Открыть инвентарь ↗</OutcomeLink>} />}
    <div className="dz-workspace__layout">
      <section><Step label="01 / Предметы" count={`${items.length} доступно`} />
        {loading ? <p>Загрузка…</p> : items.length === 0 ? <GameEmptyState variant="contracts" label="МАСТЕРСКАЯ / 03 → 01" title="Начни с трёх предметов" description="Твой инвентарь пока пуст. Открой кейсы, собери минимум три предмета и вернись, чтобы создать контракт." action={<Link to="/#collections">Выбрать кейс <span aria-hidden="true">↗</span></Link>}/> : <div className="dz-pick-grid">{items.map((item) => <SelectableItem key={item.id} name={item.caseItem.name} imageUrl={item.caseItem.imageUrl} value={formatMinor(item.caseItem.valueMinor, item.caseItem.currency)} rarity={item.caseItem.rarity} rarityLabel={t(`rarity.${item.caseItem.rarity}`, { defaultValue: RARITY_LABELS[item.caseItem.rarity] })} selected={selected.includes(item.id)} disabled={submitting} onSelect={() => toggle(item.id)} label={`${item.caseItem.name} — ${formatMinor(item.caseItem.valueMinor, item.caseItem.currency)}`} />)}</div>}
      </section>
      <aside className="dz-summary">
        <span className="dz-summary__label">02 / Расчёт</span>
        <div className="contract-slots" aria-label={`Выбрано ${selected.length} из 10 предметов`}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={index < selected.length ? "filled" : ""}/>)}</div>
        <dl className="dz-summary__rows">
          <div className="dz-summary__row"><dt>Предметов</dt><dd>{selected.length} / 10</dd></div>
          <div className="dz-summary__row"><dt>Общая стоимость</dt><dd>{formatMinor(total.toString())}</dd></div>
          <div className="dz-summary__row"><dt>Результат</dt><dd>{selected.length >= 3 ? `${formatMinor(rangeLow.toString())} — ${formatMinor(rangeHigh.toString())}` : "Выбери 3 предмета"}</dd></div>
        </dl>
        <p className="dz-summary__label">Результат определяется сохранённым roll и nonce. Выбранные предметы будут безвозвратно использованы.</p>
        {confirming
          ? <div className="dz-confirm">
              <button type="button" className="dz-commit" onClick={() => void execute()} disabled={submitting}>{submitting ? "Выполняем…" : "Подтвердить контракт"}</button>
              <button type="button" className="dz-confirm__cancel" onClick={() => setConfirming(false)} disabled={submitting}>Отмена</button>
            </div>
          : <button type="button" className="dz-commit" disabled={selected.length < 3} onClick={() => setConfirming(true)}>Создать контракт</button>}
      </aside>
    </div>
    {!loading && items.length === 0 && <GameSteps label="ПУТЬ К КОНТРАКТУ" steps={[{ title: "Собери предметы", description: "Для обмена понадобится минимум три предмета из инвентаря." }, { title: "Заполни контракт", description: "Выбери от 3 до 10 предметов и проверь общую стоимость." }, { title: "Подтверди обмен", description: "После подтверждения предметы будут использованы, а результат появится в инвентаре." }]}/>}
  </div>;
}
