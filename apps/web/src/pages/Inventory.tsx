import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { History, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { useEditorialData } from "../hooks/useEditorialData";
import type { InventoryItemDto } from "../lib/types";
import { ConfirmDialog, DataState, ItemFilters, ItemTile, SectionHeading, filterItems, money } from "../components/editorial/SectionUI";
import type { ItemSort } from "../components/editorial/SectionUI";

export function InventoryPage() {
  const { user } = useAuth();
  const inventory = useEditorialData<InventoryItemDto[]>(user ? "/cases/inventory/me" : null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<ItemSort>("newest");
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [category, setCategory] = useState("all");
  const [confirm, setConfirm] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const running = useRef(false);
  const key = "casecrow:inventory-sale:" + user?.id;
  const all = inventory.data ?? [];
  const available = all.filter((item) => item.status === "IN_INVENTORY" && item.caseItem.currency === "RUB");
  const selected = available.filter((item) => selectedIds.includes(item.id));
  const total = available.reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n);
  const selectedTotal = selected.reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n);
  const highest = available.reduce((best, item) => BigInt(item.caseItem.valueMinor) > best ? BigInt(item.caseItem.valueMinor) : best, 0n);
  const classified = available.filter((item) => {
    if (category === "all") return true;
    const name = item.caseItem.name.toLowerCase();
    const gloves = /gloves|wraps|перчат/.test(name);
    const special = item.caseItem.name.startsWith("★");
    return category === "gloves" ? gloves : category === "knives" ? special && !gloves : !special;
  });
  const filtered = filterItems(classified, (item) => item.caseItem, query, rarity, sort);
  const locked = busy || !!pending;
  useEffect(() => setVisibleLimit(60), [query, rarity, sort, category]);
  const canSendToContract = selected.length >= 3 && selected.length <= 10 && !locked;
  useEffect(() => {
    const sync = () => { try { setPending(localStorage.getItem(key)); } catch { setError("Не удалось прочитать состояние продажи"); } };
    sync(); window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, [key]);
  useEffect(() => { if (inventory.data) setSelectedIds((ids) => ids.filter((id) => inventory.data!.some((item) => item.id === id && item.status === "IN_INVENTORY"))); }, [inventory.data]);
  const toggle = (id: string) => { if (!locked) setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]); };
  const sell = async () => {
    if (!selected.length || running.current) return;
    const ids = selected.map((item) => item.id);
    running.current = true; setBusy(true); setConfirm(0); setError(""); setNotice("");
    try {
      const existing = localStorage.getItem(key);
      if (existing) { setPending(existing); return; }
      const receipt = JSON.stringify(ids);
      localStorage.setItem(key, receipt);
      setPending(receipt);
      const response = await api.post<{ soldCount: number; amountMinor: string }>("/cases/inventory/sell-batch", { ids });
      localStorage.removeItem(key); setPending(null);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setNotice("Продано предметов: " + response.soldCount + ". Средства зачислены на баланс.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 408 && reason.status !== 429) {
        localStorage.removeItem(key); setPending(null);
      }
      setError(reason instanceof Error ? reason.message : "Не удалось подтвердить продажу");
    } finally {
      running.current = false; setBusy(false); inventory.refresh(); window.dispatchEvent(new Event("casecrow:wallet-updated"));
    }
  };
  const checkSale = async () => {
    if (!pending || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      let ids: string[];
      try { ids = JSON.parse(pending) as string[]; }
      catch { ids = [pending]; }
      const current = await api.get<InventoryItemDto[]>("/cases/inventory/me");
      if (ids.every((id) => !current.some((item) => item.id === id && item.status === "IN_INVENTORY"))) {
        localStorage.removeItem(key); setPending(null);
        setNotice("Продажа завершена, инвентарь и баланс обновлены.");
        inventory.refresh(); window.dispatchEvent(new Event("casecrow:wallet-updated"));
      } else {
        setError("Продажа не подтверждена. Повторный запрос не отправляется, чтобы избежать двойной операции.");
      }
    } catch { setError("Не удалось проверить продажу. Повторный запрос не отправлен."); }
    finally { running.current = false; setBusy(false); }
  };
  return <section className="edv2">
    <SectionHeading title="Инвентарь" description="Ваша коллекция скинов. Управляйте предметами и создавайте новые возможности." action={<div className="edv2-actions"><Link className="edv2-btn" to="/history"><History size={14} />История операций</Link></div>} />
    <div className="edv2-stats"><div className="edv2-panel edv2-stat"><span className="edv2-label">Предметов в инвентаре</span><strong>{!inventory.data ? "—" : available.length}</strong><small>Доступны для действий</small></div><div className="edv2-panel edv2-stat"><span className="edv2-label">Стоимость коллекции</span><strong>{!inventory.data ? "—" : money(total)}</strong><small>По текущим ценам сервера</small></div><div className="edv2-panel edv2-stat"><span className="edv2-label">Выбрано предметов</span><strong>{selected.length}</strong><small>{money(selectedTotal)}</small></div><div className="edv2-panel edv2-stat"><span className="edv2-label">Самый ценный предмет</span><strong>{!inventory.data ? "—" : money(highest)}</strong><small>В доступной коллекции</small></div></div>
    {error && <p className="edv2-error" role="alert">{error}</p>}{notice && <p className="edv2-toast" role="status">{notice}</p>}{pending && !busy && <div className="edv2-recovery"><ShieldCheck size={20} /><div><b>Проверяем предыдущую продажу</b><p>Ответ не подтверждён. Повторные запросы остановлены.</p></div><button className="edv2-btn" onClick={checkSale}>Проверить состояние</button></div>}{busy && <div className="edv2-operation" role="status"><span className="edv2-spinner" />Обрабатываем продажу на сервере.</div>}
    <div className="edv2-inventory-toolbar"><div className="edv2-chips">{[["all", "Все предметы"], ["weapons", "Оружие"], ["knives", "Ножи"], ["gloves", "Перчатки"]].map(([value, label]) => <button key={value} className={"edv2-chip" + (category === value ? " is-active" : "")} onClick={() => setCategory(value)}>{label}</button>)}</div><ItemFilters query={query} setQuery={setQuery} rarity={rarity} setRarity={setRarity} sort={sort} setSort={setSort} /></div>

    <div className="edv2-inventory-layout"><div><DataState loading={inventory.loading} error={inventory.error} retry={inventory.refresh} empty={!inventory.loading && !inventory.error && !filtered.length ? (all.length ? "По этим фильтрам ничего не найдено" : "Ваша коллекция пока пуста") : undefined} /><div className="edv2-inventory-cards">{filtered.slice(0, visibleLimit).map((item) => <ItemTile key={item.id} item={item.caseItem} selected={selectedIds.includes(item.id)} onClick={() => toggle(item.id)} disabled={locked || item.status !== "IN_INVENTORY"}  />)}</div>{filtered.length > visibleLimit && <button type="button" className="edv2-btn cc-load-more" onClick={() => setVisibleLimit(v => v + 60)}>Показать ещё · {filtered.length - visibleLimit} предметов</button>}<p className="edv2-bottom-note">Цены и доступность подтверждаются сервером при выполнении операции.</p></div><aside className="edv2-panel edv2-right-rail"><div className="edv2-row edv2-between"><h3>Выбрано</h3><b>{selected.length}</b></div><div className="edv2-row edv2-between"><span className="edv2-small">Общая стоимость</span><strong>{money(selectedTotal)}</strong></div><button className="edv2-btn edv2-primary" disabled={!selected.length || locked} onClick={() => setConfirm(1)}>Продать выбранное</button><Link className="edv2-btn" aria-disabled={!canSendToContract} to={canSendToContract ? "/contracts?items=" + selected.map((item) => item.id).join(",") : "#"} onClick={(e) => { if (!canSendToContract) e.preventDefault(); }}>В контракт →</Link><Link className="edv2-btn" aria-disabled={selected.length !== 1 || locked} to={selected.length === 1 && !locked ? "/upgrader?item=" + selected[0].id : "#"} onClick={(e) => { if (selected.length !== 1 || locked) e.preventDefault(); }}>В апгрейд →</Link><button className="edv2-subtle" disabled={!selected.length || locked} onClick={() => setSelectedIds([])}>Снять выделение</button><button className="edv2-subtle" onClick={() => setSelectedIds(filtered.filter((item) => item.status === "IN_INVENTORY" && item.caseItem.currency === "RUB").map((item) => item.id))} disabled={locked || !filtered.length}>Выбрать все</button><button className="edv2-btn" disabled={locked || !available.length} onClick={() => { setSelectedIds(available.map((item) => item.id)); setConfirm(3); }}>Продать всё · {available.length}</button><p className="edv2-small">Контракт: от 3 до 10 предметов.<br />Апгрейд: один исходный предмет.<br />Выбранные предметы продаются одной серверной операцией.</p><p className="edv2-small">Вывод скинов в Steam пока недоступен.</p></aside></div>
    {confirm > 0 && <ConfirmDialog title={confirm === 1 ? "Продать выбранные предметы?" : confirm === 3 ? "Продать весь инвентарь?" : "Окончательное подтверждение" } confirmLabel={confirm === 1 ? "Продолжить" : "Продать за " + money(selectedTotal)} onClose={() => setConfirm(0)} onConfirm={() => confirm === 1 || confirm === 3 ? setConfirm(2) : sell()} busy={busy}><p><strong>{selected.length} предмета · {money(selectedTotal)}</strong></p><p>Предметы исчезнут из доступного инвентаря, средства будут зачислены на баланс. Продажу нельзя отменить.</p>{selected.length > 1 && <p>Все выбранные предметы продаются одной операцией.</p>}</ConfirmDialog>}
  </section>;
}
