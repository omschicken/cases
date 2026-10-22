import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, ArrowUpRight, RotateCcw, Sparkles, EyeOff, Check, X, RotateCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEditorialData } from "../hooks/useEditorialData";
import { useEditorialOperation } from "../hooks/useEditorialOperation";
import { upgradeChance } from "../lib/editorialGameRules";
import { nearestUpgradeTarget } from "../lib/upgradeSelection";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";
import { EditorialItemImage } from "../components/editorial/EditorialItemImage";
import { ConfirmDialog, DataState, ItemFilters, ItemTile, OperationState, Rules, SectionHeading, SignInState, filterItems, money } from "../components/editorial/SectionUI";
import type { ItemSort } from "../components/editorial/SectionUI";
import { edRarity } from "../components/editorial/SectionUI";
import { RARITY_LABELS } from "../lib/rarity";
import "../styles/upgrader-premium.css";

type UpgradeResult = { operation: GameOperationDto; won: boolean; item: CaseItem | null; target: CaseItem; chance: number };
type UpgradeMode = "classic" | "mystery";
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
  const [mode, setMode] = useState<UpgradeMode>("classic");
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
  const shownTarget = result && !animating ? (result.item ?? null) : mode === "classic" ? target ?? null : null;
  const shownTargetParts = shownTarget?.name.split(" | ") ?? [];
  const locked = operation.busy || !!operation.pending || animating;
  const targetList = (targets.data ?? []).filter((item) => source && BigInt(item.valueMinor) > BigInt(source.caseItem.valueMinor) && BigInt(item.valueMinor) <= BigInt(source.caseItem.valueMinor) * 90n && (!factor || BigInt(item.valueMinor) * 100n >= BigInt(source.caseItem.valueMinor) * BigInt(Math.round(factor * 100))));
  const sources = filterItems(available, (item) => item.caseItem, query, rarity, sort);
  const choices = filterItems(targetList, (item) => item, query, rarity, sort);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setVisibleLimit(60), [tab, query, rarity, sort, sourceId, factor]);
  const selectTab = (value: string) => { setTab(value); setQuery(""); setRarity(""); setSort("newest"); };
  const change = (value: string) => { selectTab(value); picker.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); };
  const reset = () => { if (locked) return; setSourceId(""); setTargetId(""); setResult(null); setFactor(mode === "mystery" ? 2 : null); selectTab("source"); };
  const selectMode = (next: UpgradeMode) => {
    if (locked) return;
    setMode(next); setResult(null); setTargetId(""); setFactor(next === "mystery" ? 2 : null);
    selectTab(next === "mystery" ? "source" : "target");
  };
  const selectMultiplier = (value: number) => {
    if (locked || !source) return;
    setFactor(value); setResult(null);
    if (mode === "classic") {
      const closest = nearestUpgradeTarget(targets.data ?? [], source.caseItem.valueMinor, value);
      setTargetId(closest?.id ?? "");
      selectTab("target");
    } else {
      setTargetId(""); selectTab("source");
    }
  };
  const create = async () => {
    if (!source || (mode === "classic" && (!target || chance === null))) return;
    setConfirm(false); setResult(null);
    const mystery = mode === "mystery";
    const data = await operation.run<UpgradeResult>(
      { type: "UPGRADE", ids: [source.id] },
      mystery ? "/games/upgrades/mystery" : "/games/upgrades",
      mystery ? { inventoryItemId: source.id, multiplier: 2 } : { inventoryItemId: source.id, targetCaseItemId: target!.id },
    );
    if (data) {
      setResult(data);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) inventory.refresh();
      else { setAnimating(true); timer.current = setTimeout(() => { setAnimating(false); inventory.refresh(); }, 900); }
    } else inventory.refresh();
  };
  const sourceSkin = source?.caseItem;
  const sourceParts = sourceSkin?.name.split(" | ") ?? [];
  const targetParts = shownTargetParts;
  const sourceTitle = sourceParts[1] ?? sourceParts[0] ?? "Выберите предмет";
  const targetTitle = targetParts[1] ?? targetParts[0] ?? "Выберите цель";
  const rules = <Rules>Один предмет можно обменять на попытку получить более дорогой. Шанс равен отношению цены исходного предмета к цене цели, но не более 75%. Апгрейд ×2 имеет шанс 50%. При неудаче исходный предмет расходуется. Кнопки ×1.5, ×2, ×3, ×5 автоматически подбирают ближайшую по стоимости цель. В «Мистери» предмет выдаётся всегда: 20% наград стоят 30–60% исходной цены, 15% стоят 60–90%, 50% стоят 90–110%, 10% стоят 110–150%, 5% стоят 150–200%. Если в любом из диапазонов нет предметов, операция недоступна и исходный предмет не расходуется.</Rules>;

  return <section className={"edv2 cc-upgrade" + (operation.busy || animating ? " is-processing" : "")}>
    <div className="cc-upgrade-horizon" aria-hidden="true">
      <div className="cc-upgrade-horizon-scenery" />
    </div>
    <SectionHeading title="Апгрейд" description="Превратите свой скин в нечто большее. Выберите предмет, цель и испытайте удачу." action={rules} />
    <OperationState operation={operation} onRefresh={inventory.refresh} />
    <div className="cc-upgrade-workspace">
      <div className="edv2-upgrade-area">
        <div className={"edv2-panel edv2-upgrade-choice cc-upgrade-choice" + (sourceSkin ? " has-item" : "")}>
          <div className="edv2-row edv2-between cc-upgrade-card-top"><span className="edv2-label">ВАШ ПРЕДМЕТ</span><span className="cc-upgrade-step">01</span></div>
          <div className="edv2-upgrade-art cc-upgrade-item-art">
            {sourceSkin ? <EditorialItemImage name={sourceSkin.name} imageUrl={sourceSkin.imageUrl} /> : <div className="cc-upgrade-placeholder"><img src="/casecrow-mark.svg" alt="" /><span>{result ? "Предмет использован" : "Выберите предмет из инвентаря"}</span></div>}
          </div>
          <div className="cc-upgrade-skin-details">
            <div className="cc-upgrade-weapon">{sourceParts[0] ?? "Исходный скин"}</div>
            <b title={sourceSkin?.name}>{sourceTitle}</b>
            {sourceSkin && <span className="cc-upgrade-rarity"><i style={{ background: edRarity[sourceSkin.rarity] }} />{RARITY_LABELS[sourceSkin.rarity]}</span>}
          </div>
          <div className="edv2-row edv2-between cc-upgrade-card-value"><strong>{sourceSkin ? money(sourceSkin.valueMinor) : "—"}</strong><span className="cc-upgrade-card-order">ВАШ ВЫБОР</span></div>
          <button type="button" className="edv2-btn cc-upgrade-card-action" onClick={() => change("source")} disabled={locked}><ArrowLeftRight size={15} />{sourceSkin ? "Заменить предмет" : "Выбрать предмет"}</button>
        </div>

        <div className="edv2-panel edv2-upgrade-center cc-upgrade-meter-panel">
          <div className="cc-upgrade-center-eyebrow"><Sparkles size={15} /> {mode === "mystery" ? "МИСТЕРИ АПГРЕЙД" : "ВАША ВОЗМОЖНОСТЬ"}</div>
          <div className="cc-upgrade-modes" role="group" aria-label="Режим апгрейда">
            <button type="button" className={mode === "classic" ? "is-active" : ""} aria-pressed={mode === "classic"} disabled={locked} onClick={() => selectMode("classic")}>Обычный</button>
            <button type="button" className={mode === "mystery" ? "is-active" : ""} aria-pressed={mode === "mystery"} disabled={locked} onClick={() => selectMode("mystery")}><EyeOff size={13}/> Мистери</button>
          </div>
          <div className={"edv2-chance cc-upgrade-chance cc-upgrade-reel" + (mode === "mystery" ? " cc-upgrade-mystery-orb" : "") + (operation.busy ? " is-spinning" : "") + (result && animating ? " is-finalizing" : "") + (result && !animating ? (result.won ? " is-won" : " is-lost") : "")} role="meter" aria-label="Шанс успешного апгрейда" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result ? percentage : mode === "classic" && source && target ? percentage : 0} style={{ "--chance": (result || mode === "classic" ? percentage : 0) + "%", "--roll": result ? result.operation.roll * 360 + "deg" : "0deg" } as CSSProperties}>
            <span className="cc-upgrade-reel-ticks" aria-hidden="true"/>{mode === "mystery" && <span className="cc-upgrade-orb-flow" aria-hidden="true" />}
            <span className="cc-upgrade-reel-pointer" aria-hidden="true"/>
            <div className="edv2-chance-inner">
              <small>{mode === "mystery" ? "МИСТЕРИ" : "ШАНС УСПЕХА"}</small>
              <strong>{mode === "mystery" ? "✦" : result || (mode === "classic" && source && target) ? percentage.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) + "%" : "—"}</strong>
              {result && !animating ? <span className={"cc-upgrade-result-symbol" + (result.won ? " is-won" : " is-lost")}>{result.won ? <Check size={21}/> : <X size={21}/>}</span> : <span className="cc-upgrade-reel-star">✦</span>}
              {result && !animating && <b className={"edv2-outcome" + (!result.won ? " is-lost" : "")}>{result.won ? "ПОБЕДА" : "НЕ ПОВЕЗЛО"}</b>}
            </div>
          </div>
          <div className="edv2-factors cc-upgrade-factors" aria-label={mode === "mystery" ? "Диапазоны наград" : "Подбор цели по цене"}>{(mode === "mystery" ? [] : [1.5, 2, 3, 5]).map(value => <button type="button" key={value} className={factor === value ? "is-active" : ""} aria-pressed={factor === value} disabled={!source || locked || !!result} onClick={() => selectMultiplier(value)}>×{value}</button>)}</div>
          
        </div>

        <div className={"edv2-panel edv2-upgrade-choice cc-upgrade-choice cc-upgrade-target-card" + (shownTarget ? " has-item" : "") + (result && !animating ? (result.won ? " is-success" : " is-failure") : "")}>
          <div className="edv2-row edv2-between cc-upgrade-card-top"><span className="edv2-label">{result && !animating ? (result.won ? "ВЫ ПОЛУЧИЛИ" : "ПОПЫТКА ЗАВЕРШЕНА") : mode === "mystery" ? "СЛУЧАЙНЫЙ ПРЕДМЕТ" : "ЖЕЛАЕМЫЙ ПРЕДМЕТ"}</span><span className="cc-upgrade-step">{result && !animating ? (result.won ? "✓" : "×") : "02"}</span></div>
          <div className="edv2-upgrade-art cc-upgrade-item-art cc-upgrade-item-art--target">
            {shownTarget ? <EditorialItemImage name={shownTarget.name} imageUrl={shownTarget.imageUrl} /> : <div className="cc-upgrade-placeholder">{mode === "mystery" && !result ? <EyeOff size={45} strokeWidth={1.3} /> : result && !animating ? <X size={40} strokeWidth={1.5} /> : <img src="/casecrow-mark.svg" alt="" />}<span>{result && !animating ? "Без выигрыша" : mode === "mystery" ? "Узнаете после апгрейда" : "Выберите более дорогой скин"}</span></div>}
          </div>
          <div className="cc-upgrade-skin-details"><div className="cc-upgrade-weapon">{result && !animating && !result.won ? "В следующий раз повезёт" : targetParts[0] ?? (mode === "mystery" ? "Секретный предмет" : "Целевой скин")}</div><b title={shownTarget?.name}>{result && !animating && !result.won ? "Попытка завершена" : shownTargetParts[1] ?? shownTargetParts[0] ?? (mode === "mystery" ? "Мистери-цель" : targetTitle)}</b>{shownTarget && <span className="cc-upgrade-rarity"><i style={{ background: edRarity[shownTarget.rarity] }} />{RARITY_LABELS[shownTarget.rarity]}</span>}</div>
          <div className="edv2-row edv2-between cc-upgrade-card-value"><strong>{shownTarget ? money(shownTarget.valueMinor) : mode === "mystery" && source ? `${money((BigInt(source.caseItem.valueMinor) * 30n / 100n).toString())} – ${money((BigInt(source.caseItem.valueMinor) * 200n / 100n).toString())}` : "—"}</strong><span className="cc-upgrade-card-order">{result && !animating ? (result.won ? "НАЧИСЛЕНО" : "НЕ ПОЛУЧЕНО") : "ВАША ЦЕЛЬ"}</span></div>
          {result && !animating ? <div className="cc-upgrade-result-actions"><button type="button" className="edv2-btn cc-upgrade-card-action" onClick={reset}><RotateCw size={15}/> Новая попытка</button>{result.won && <Link className="cc-upgrade-inventory-link" to="/inventory">В инвентарь →</Link>}</div> : mode === "mystery" ? <button type="button" className="edv2-btn cc-upgrade-card-action" disabled><EyeOff size={15}/> Цель скрыта</button> : <button type="button" className="edv2-btn cc-upgrade-card-action" onClick={() => change("target")} disabled={!source || locked}><ArrowUpRight size={15}/>{target ? "Выбрать другую цель" : "Выбрать цель"}</button>}
        </div>
      </div>

      <div className="edv2-upgrade-footer cc-upgrade-footer">
        <p><ShieldCheck size={16} /> {mode === "mystery" ? "При каждом мистери-апгрейде выдаётся один случайный предмет." : "При неудаче исходный предмет будет использован."}</p>
        <div className="edv2-actions"><button type="button" className="edv2-btn" onClick={reset} disabled={locked}><RotateCcw size={15}/>Сбросить</button><button type="button" className="edv2-btn edv2-primary" onClick={() => setConfirm(true)} disabled={!user || !source || (mode === "classic" && (!target || chance === null)) || locked || !!result}><ArrowUpRight size={18}/>{mode === "mystery" ? "Мистери апгрейд" : "Апгрейд"}</button></div>
      </div>
    </div>
    <div ref={picker} className="edv2-available cc-upgrade-picker">
      {user && !inventory.loading && !inventory.error && !hasSources && !result && <div className="edv2-state edv2-panel" role="status">В инвентаре пока нет доступных предметов для апгрейда. <Link to="/">Открыть каталог кейсов →</Link></div>}
      {source && !targets.loading && !targets.error && targetList.length === 0 && <div className="edv2-state" role="status">Для этого предмета нет подходящих целей. Сбросьте множитель или выберите другой предмет. <button type="button" className="edv2-btn" onClick={() => { setFactor(null); setTargetId(""); }}>Показать все цели</button></div>}
      <div className="edv2-sectionhead"><div className="edv2-picker-tabs"><button type="button" className={tab === "source" ? "is-active" : ""} onClick={() => selectTab("source")}>Ваш инвентарь</button><button type="button" className={tab === "target" ? "is-active" : ""} onClick={() => selectTab("target")}>Выберите цель</button></div><span className="edv2-count">{tab === "source" ? available.length : targetList.length}</span></div>
      {!user && tab === "source" ? <SignInState /> : <><ItemFilters query={query} setQuery={setQuery} rarity={rarity} setRarity={setRarity} sort={sort} setSort={setSort} />{tab === "source" ? <><DataState loading={inventory.loading} error={inventory.error} retry={inventory.refresh} empty={!inventory.loading && !inventory.error && !sources.length ? "Нет подходящих предметов в инвентаре" : undefined} /><div className="edv2-items">{sources.slice(0, visibleLimit).map((item) => <ItemTile key={item.id} item={item.caseItem} selected={item.id === sourceId} disabled={locked} onClick={() => { setSourceId(item.id); setTargetId(""); setResult(null); setFactor(mode === "mystery" ? 2 : null); selectTab(mode === "mystery" ? "source" : "target"); }} />)}</div>{sources.length > visibleLimit && <button type="button" className="edv2-btn cc-load-more" onClick={() => setVisibleLimit(v => v + 60)}>Показать ещё · {sources.length - visibleLimit} предметов</button>}</> : <><DataState loading={targets.loading} error={targets.error} retry={targets.refresh} empty={!targets.loading && !targets.error && !choices.length ? (source ? "Нет целей, соответствующих фильтрам" : "Сначала выберите исходный предмет") : undefined} /><div className="edv2-items">{choices.slice(0, visibleLimit).map((item) => <ItemTile key={item.id} item={item} selected={item.id === targetId} disabled={locked} onClick={() => { setTargetId(item.id); setFactor(null); setResult(null); }} />)}</div>{choices.length > visibleLimit && <button type="button" className="edv2-btn cc-load-more" onClick={() => setVisibleLimit(v => v + 60)}>Показать ещё · {choices.length - visibleLimit} скинов</button>}</>}</>}
    </div>
    {confirm && source && (mode === "mystery" || target) && <ConfirmDialog title={mode === "mystery" ? "Мистери апгрейд" : "Подтвердить апгрейд"} confirmLabel={mode === "mystery" ? "Открыть случайную цель" : "Выполнить апгрейд"} onClose={() => setConfirm(false)} onConfirm={create} busy={operation.busy}>
      <p><strong>{source.caseItem.name}</strong> → <strong>{mode === "mystery" ? `Случайный предмет от 30% до 200% цены` : target?.name}</strong></p>
      <p>{mode === "mystery" ? `Награда гарантирована; 50% результатов в зоне 90–110% стоимости исходного предмета.` : `Шанс успеха: ${percentage.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}%.`} При любом результате исходный предмет будет использован.</p>
    </ConfirmDialog>}
  </section>;
}
