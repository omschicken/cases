import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEditorialData } from "../hooks/useEditorialData";
import { useEditorialOperation } from "../hooks/useEditorialOperation";
import { upgradeChance } from "../lib/editorialGameRules";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";
import { EditorialItemImage } from "../components/editorial/EditorialItemImage";
import { ConfirmDialog, DataState, ItemFilters, ItemTile, OperationState, Rules, SectionHeading, SignInState, filterItems, money } from "../components/editorial/SectionUI";
import type { ItemSort } from "../components/editorial/SectionUI";

type UpgradeResult = { operation: GameOperationDto; won: boolean; item: CaseItem | null; target: CaseItem; chance: number };
export function UpgraderPage() {
  const { user } = useAuth();
  const inventory = useEditorialData<InventoryItemDto[]>(user ? "/cases/inventory/me" : null);
  const targets = useEditorialData<CaseItem[]>("/games/upgrade-targets");
  const operation = useEditorialOperation();
  const [params] = useSearchParams();
  const [sourceId, setSourceId] = useState(params.get("item") ?? "");
  const [targetId, setTargetId] = useState("");
  const [tab, setTab] = useState("source");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<ItemSort>("newest");
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [factor, setFactor] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const picker = useRef<HTMLDivElement>(null);
  const available = (inventory.data ?? []).filter((item) => item.status === "IN_INVENTORY" && item.caseItem.currency === "RUB");
  const source = available.find((item) => item.id === sourceId);
  const hasSources = available.length > 0;
  const target = targets.data?.find((item) => item.id === targetId);
  const chance = source && target ? upgradeChance(source.caseItem.valueMinor, target.valueMinor) : null;
  const percentage = (result?.chance ?? chance ?? 0) * 100;
  const locked = operation.busy || !!operation.pending || animating;
  const targetList = (targets.data ?? []).filter((item) => source && BigInt(item.valueMinor) > BigInt(source.caseItem.valueMinor) && BigInt(item.valueMinor) <= BigInt(source.caseItem.valueMinor) * 90n && (!factor || BigInt(item.valueMinor) * 100n >= BigInt(source.caseItem.valueMinor) * BigInt(Math.round(factor * 100))));
  const sources = filterItems(available, (item) => item.caseItem, query, rarity, sort);
  const choices = filterItems(targetList, (item) => item, query, rarity, sort);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setVisibleLimit(60), [tab, query, rarity, sort, sourceId, factor]);
  const selectTab = (value: string) => { setTab(value); setQuery(""); setRarity(""); setSort("newest"); };
  const change = (value: string) => { selectTab(value); picker.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); };
  const reset = () => { if (locked) return; setSourceId(""); setTargetId(""); setResult(null); setFactor(null); selectTab("source"); };
  const create = async () => {
    if (!source || !target || chance === null) return;
    setConfirm(false); setResult(null);
    const data = await operation.run<UpgradeResult>({ type: "UPGRADE", ids: [source.id] }, "/games/upgrades", { inventoryItemId: source.id, targetCaseItemId: target.id });
    if (data) {
      setResult(data);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) inventory.refresh();
      else { setAnimating(true); timer.current = setTimeout(() => { setAnimating(false); inventory.refresh(); }, 1550); }
    } else inventory.refresh();
  };
  return <section className={"edv2" + (operation.busy || animating ? " is-processing" : "")}>
    <SectionHeading title="Апгрейд" description="Превратите свой скин в нечто большее. Выберите цель и испытайте удачу." action={<Rules>Один предмет можно обменять на попытку получить более дорогой. Шанс равен 90% отношения цен с округлением сервера, минимум 1%, максимум 75%. Цель не может стоить более чем в 90 раз дороже исходного предмета. При неудаче исходный предмет расходуется. Кнопки ×1.5, ×2, ×3, ×5 фильтруют цели по цене; итоговый шанс зависит от выбранной пары.</Rules>} />
    <OperationState operation={operation} onRefresh={inventory.refresh} />
    <div className="edv2-upgrade-area"><div className="edv2-panel edv2-upgrade-choice"><div className="edv2-row edv2-between"><span className="edv2-label">Ваш предмет</span><span className="edv2-small">01</span></div><div className="edv2-upgrade-art">{source ? <EditorialItemImage name={source.caseItem.name} imageUrl={source.caseItem.imageUrl} /> : <span>{result ? "Предмет использован" : "Выберите предмет из инвентаря"}</span>}</div><b>{source?.caseItem.name ?? "Исходный скин"}</b><div className="edv2-row edv2-between"><strong>{source ? money(source.caseItem.valueMinor) : "—"}</strong><button className="edv2-btn" onClick={() => change("source")} disabled={locked}>{source ? "Изменить" : "Выбрать"}</button></div></div>
    <div className="edv2-panel edv2-upgrade-center"><div className="edv2-chance" style={{ "--chance": percentage + "%", "--roll": result ? result.operation.roll * 360 + "deg" : "0deg" } as CSSProperties}><div className="edv2-chance-inner"><small>ШАНС УСПЕХА</small><strong>{source && target || result ? percentage.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) + "%" : "—"}</strong><small>{operation.busy ? "Ожидаем сервер" : animating ? "Открываем результат…" : "По правилам сервера"}</small>{result && !animating && <b className={"edv2-outcome" + (!result.won ? " is-lost" : "")}>{result.won ? "УСПЕХ" : "БЕЗ ВЫИГРЫША"}</b>}</div>{result && <span className="edv2-roll-marker" />}</div><div className="edv2-factors" aria-label="Фильтр целей по цене">{[1.5, 2, 3, 5].map((value) => <button key={value} className={factor === value ? "is-active" : ""} aria-pressed={factor === value} disabled={!source || locked} onClick={() => { setFactor(factor === value ? null : value); setTargetId(""); selectTab("target"); }}>×{value}</button>)}</div><span className="edv2-small">×1.5 даёт более высокий шанс, ×5 выше потенциальный выигрыш.<br />Точный шанс указан для выбранной пары.</span></div>
    <div className="edv2-panel edv2-upgrade-choice"><div className="edv2-row edv2-between"><span className="edv2-label">Желаемый предмет</span><span className="edv2-small">02</span></div><div className="edv2-upgrade-art">{target ? <EditorialItemImage name={target.name} imageUrl={target.imageUrl} /> : <span>Выберите более дорогой скин</span>}</div><b>{target?.name ?? "Целевой скин"}</b><div className="edv2-row edv2-between"><strong>{target ? money(target.valueMinor) : "—"}</strong><button className="edv2-btn" onClick={() => change("target")} disabled={!source || locked}>{target ? "Изменить" : "Выбрать"}</button></div></div></div>
    <div className="edv2-upgrade-footer"><p>При неудаче исходный предмет будет использован. Перед операцией проверьте цель, цену и шанс.</p><div className="edv2-actions"><button className="edv2-btn" onClick={reset} disabled={locked}><RotateCcw size={14} />Сбросить</button><button className="edv2-btn edv2-primary" onClick={() => setConfirm(true)} disabled={!user || !source || !target || chance === null || locked || !!result}><ArrowUpRight size={15} />Апгрейд</button></div></div>
    {result && !animating && <div className="edv2-result" role="status"><div className="edv2-row edv2-between"><h2>{result.won ? "Апгрейд успешен" : "Попытка завершена"}</h2><button className="edv2-btn edv2-xs" onClick={reset}>Новая попытка</button></div>{result.won && result.item ? <div className="edv2-result-items"><div className="edv2-result-item"><EditorialItemImage name={result.item.name} imageUrl={result.item.imageUrl} /><b>{result.item.name}</b><strong>{money(result.item.valueMinor)}</strong></div></div> : <p>Сервер подтвердил неудачу. Исходный предмет использован, целевой предмет не начислен.</p>}<p><Link to="/inventory">В инвентарь →</Link></p><small>Операция {result.operation.id} · шанс {(result.chance * 100).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}% · roll {result.operation.roll}</small></div>}
    <div ref={picker} className="edv2-available">
    {user && !inventory.loading && !inventory.error && !hasSources && <div className="edv2-state edv2-panel" role="status">В инвентаре пока нет доступных предметов для апгрейда. <Link to="/">Открыть каталог кейсов →</Link></div>}
    {source && !targets.loading && !targets.error && targetList.length === 0 && <div className="edv2-state" role="status">Для этого предмета нет подходящих целей. Сбросьте множитель или выберите другой предмет. <button type="button" className="edv2-btn" onClick={() => { setFactor(null); setTargetId(""); }}>Показать все цели</button></div>}
<div className="edv2-sectionhead"><div className="edv2-picker-tabs"><button className={tab === "source" ? "is-active" : ""} onClick={() => selectTab("source")}>Ваш инвентарь</button><button className={tab === "target" ? "is-active" : ""} onClick={() => selectTab("target")}>Выберите цель</button></div><span className="edv2-count">{tab === "source" ? available.length : targetList.length}</span></div>
    {!user && tab === "source" ? <SignInState /> : <><ItemFilters query={query} setQuery={setQuery} rarity={rarity} setRarity={setRarity} sort={sort} setSort={setSort} />{tab === "source" ? <><DataState loading={inventory.loading} error={inventory.error} retry={inventory.refresh} empty={!inventory.loading && !inventory.error && !sources.length ? "Нет подходящих предметов в инвентаре" : undefined} /><div className="edv2-items">{sources.slice(0, visibleLimit).map((item) => <ItemTile key={item.id} item={item.caseItem} selected={item.id === sourceId} disabled={locked} onClick={() => { setSourceId(item.id); setTargetId(""); setResult(null); setFactor(null); selectTab("target"); }} />)}</div>{sources.length > visibleLimit && <button type="button" className="edv2-btn cc-load-more" onClick={() => setVisibleLimit(v => v + 60)}>Показать ещё · {sources.length - visibleLimit} предметов</button>}</> : <><DataState loading={targets.loading} error={targets.error} retry={targets.refresh} empty={!targets.loading && !targets.error && !choices.length ? (source ? "Нет целей, соответствующих фильтрам" : "Сначала выберите исходный предмет") : undefined} /><div className="edv2-items">{choices.slice(0, visibleLimit).map((item) => <ItemTile key={item.id} item={item} selected={item.id === targetId} disabled={locked} onClick={() => { setTargetId(item.id); setResult(null); }} />)}</div>{choices.length > visibleLimit && <button type="button" className="edv2-btn cc-load-more" onClick={() => setVisibleLimit(v => v + 60)}>Показать ещё · {choices.length - visibleLimit} скинов</button>}</>}
    </div>
    {confirm && source && target && <ConfirmDialog title="Подтвердить апгрейд" confirmLabel="Выполнить апгрейд" onClose={() => setConfirm(false)} onConfirm={create} busy={operation.busy}><p><strong>{source.caseItem.name}</strong> → <strong>{target.name}</strong></p><p>Шанс успеха: {percentage.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}%. При любом результате исходный предмет будет использован.</p></ConfirmDialog>}
  </section>;
}
