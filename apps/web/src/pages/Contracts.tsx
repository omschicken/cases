import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEditorialData } from "../hooks/useEditorialData";
import { useEditorialOperation } from "../hooks/useEditorialOperation";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";
import { EditorialItemImage } from "../components/editorial/EditorialItemImage";
import { ConfirmDialog, DataState, ItemFilters, ItemTile, OperationState, Rules, SectionHeading, SignInState, filterItems, money } from "../components/editorial/SectionUI";
import type { ItemSort } from "../components/editorial/SectionUI";

type ContractResult = { operation: GameOperationDto; item: CaseItem; inventoryItemId: string; inputValueMinor: string };
export function ContractsPage() {
  const { user } = useAuth();
  const inventory = useEditorialData<InventoryItemDto[]>(user ? "/cases/inventory/me" : null);
  const operation = useEditorialOperation();
  const [params] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (params.get("items") ?? "").split(",").filter(Boolean).slice(0, 10));
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<ItemSort>("newest");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<ContractResult | null>(null);
  const available = (inventory.data ?? []).filter((value) => value.status === "IN_INVENTORY" && value.caseItem.currency === "RUB");
  const selected = available.filter((value) => selectedIds.includes(value.id));
  const total = selected.reduce((sum, value) => sum + BigInt(value.caseItem.valueMinor), 0n);
  const filtered = filterItems(available, (value) => value.caseItem, query, rarity, sort);
  const locked = operation.busy || !!operation.pending;
  useEffect(() => { if (inventory.data) setSelectedIds((ids) => ids.filter((id) => inventory.data!.some((item) => item.id === id && item.status === "IN_INVENTORY"))); }, [inventory.data]);
  const toggle = (id: string) => { if (locked) return; setResult(null); setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : ids.length < 10 ? [...ids, id] : ids); };
  const create = async () => {
    if (selected.length < 3 || selected.length > 10) return;
    setConfirm(false); setResult(null);
    const ids = selected.map((item) => item.id);
    const data = await operation.run<ContractResult>({ type: "CONTRACT", ids }, "/games/contracts", { inventoryItemIds: ids });
    if (data) { setResult(data); setSelectedIds([]); }
    inventory.refresh();
  };
  return <section className="edv2">
    <SectionHeading title="Контракты" description="Объединяйте скины в один новый предмет. Ваша коллекция — ваши правила." action={<Rules>Выберите от 3 до 10 предметов в рублях. Сервер ищет награду стоимостью 60–90% от суммы. Если таких предметов нет, выбирает самый дорогой доступный до 90%. Все выбранные предметы расходуются без возможности возврата. Итог определяет сервер.</Rules>} />
    <OperationState operation={operation} onRefresh={inventory.refresh} />
    <div className="edv2-contract-main"><div className="edv2-panel edv2-contract-select"><div className="edv2-row edv2-between"><h2>Предметы для контракта <span className="edv2-count">{selected.length} / 10</span></h2><button className="edv2-subtle" onClick={() => setSelectedIds([])} disabled={locked || !selected.length}>Очистить</button></div><div className="edv2-slotgrid">{Array.from({ length: 10 }, (_, index) => { const item = selected[index]; return <div key={index} className={"edv2-slot" + (item ? " is-filled" : "")}>{item ? <><EditorialItemImage name={item.caseItem.name} imageUrl={item.caseItem.imageUrl} decorative /><b title={item.caseItem.name}>{item.caseItem.name}</b><small>{money(item.caseItem.valueMinor)}</small><button aria-label={"Убрать " + item.caseItem.name} onClick={() => toggle(item.id)} disabled={locked}><X size={12} /></button></> : <><span><Plus size={20} strokeWidth={1} /></span><small style={{ textAlign: "center", padding: 0 }}>Слот {index + 1}</small></>}</div>; })}</div></div>
    <aside className="edv2-panel edv2-contract-summary"><div className="edv2-row edv2-between"><span className="edv2-label">ВАШ КОНТРАКТ</span><span className="edv2-pill">{selected.length} предмета</span></div><div><div className="edv2-label">Общая стоимость</div><div className="edv2-summary-value">{money(total)}</div></div><div className="edv2-summary-rule"><span>Количество предметов</span><b>{selected.length} / 10</b></div><div className="edv2-summary-info"><b>Условия результата</b><p>{selected.length ? money(total * 60n / 100n) + " — " + money(total * 90n / 100n) : "Выберите предметы для расчёта диапазона"}</p><p>Обычный диапазон — 60–90% суммы. При отсутствии подходящих скинов сервер выбирает награду дешевле, до 90%.</p></div><button className="edv2-btn edv2-primary" onClick={() => setConfirm(true)} disabled={!user || locked || selected.length < 3 || selected.length > 10}><Check size={15} />Создать контракт</button><small>Минимум 3 предмета. После подтверждения выбранные скины будут использованы безвозвратно.</small></aside></div>
    {result && <div className="edv2-result" role="status"><div className="edv2-row edv2-between"><h2>Контракт выполнен</h2><Link className="edv2-btn edv2-xs" to="/inventory">В инвентарь →</Link></div><div className="edv2-result-items"><div className="edv2-result-item"><EditorialItemImage name={result.item.name} imageUrl={result.item.imageUrl} /><b>{result.item.name}</b><strong>{money(result.item.valueMinor)}</strong></div></div><small>Операция {result.operation.id} · результат сервера</small></div>}
    <div className="edv2-available"><div className="edv2-sectionhead"><h2>Ваш инвентарь <span className="edv2-count">{available.length}</span></h2><span className="edv2-small">Выберите от 3 до 10 предметов</span></div>{!user ? <SignInState /> : <><ItemFilters query={query} setQuery={setQuery} rarity={rarity} setRarity={setRarity} sort={sort} setSort={setSort} /><DataState loading={inventory.loading} error={inventory.error} retry={inventory.refresh} empty={!inventory.loading && !inventory.error && !filtered.length ? (available.length ? "По этим фильтрам ничего не найдено" : "Нет доступных предметов для контракта") : undefined} /><div className="edv2-items">{filtered.map((value) => <ItemTile key={value.id} item={value.caseItem} selected={selectedIds.includes(value.id)} disabled={locked || (!selectedIds.includes(value.id) && selected.length >= 10)} onClick={() => toggle(value.id)} />)}</div></>}</div>
    {confirm && <ConfirmDialog title="Подтвердить контракт" confirmLabel="Использовать предметы" onClose={() => setConfirm(false)} onConfirm={create} busy={operation.busy}><p><strong>{selected.length} предмета · {money(total)}</strong></p><p>Все выбранные предметы будут безвозвратно использованы. Новый предмет определит сервер по правилам контракта.</p></ConfirmDialog>}
  </section>;
}
