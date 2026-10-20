import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownUp, Check, Search, ShieldCheck, X } from "lucide-react";
import { EditorialItemImage } from "./EditorialItemImage";
import { formatMinor } from "../../lib/money";
import { RARITY_LABELS } from "../../lib/rarity";
import type { CaseItem, ItemRarity } from "../../lib/types";
import { API_URL } from "../../lib/api";

export const edRarity: Record<ItemRarity, string> = { CONSUMER: "#afb5b5", INDUSTRIAL: "#90adba", MIL_SPEC: "#7b9db4", RESTRICTED: "#9e81b5", CLASSIFIED: "#bd81ad", COVERT: "#c4776d", GOLD: "#b9a276" };
export const money = (minor: string | bigint) => formatMinor(String(minor), "RUB");

export function SectionHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="edv2-heading"><div><div className="edv2-kicker">CASE CROW / ИГРОВЫЕ РЕЖИМЫ</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function Rules({ children }: { children: ReactNode }) {
  return <details className="edv2-rules"><summary>Как это работает <span>↗</span></summary><div>{children}</div></details>;
}
export function DataState({ loading, error, empty, retry }: { loading?: boolean; error?: string; empty?: string; retry?: () => void }) {
  if (loading) return <div className="edv2-state" role="status"><span className="edv2-spinner" />Загружаем предметы…</div>;
  if (error) return <div className="edv2-state edv2-error" role="alert">{error}{retry && <button className="edv2-btn" onClick={retry}>Повторить загрузку</button>}</div>;
  return empty ? <div className="edv2-state">{empty}<Link to="/">Перейти к кейсам →</Link></div> : null;
}
export function SignInState() {
  return <div className="edv2-state edv2-panel"><ShieldCheck size={26} /><h2>Войдите в CaseCrow</h2><p>Предметы, результаты и история привязаны к вашему аккаунту.</p><a className="edv2-btn edv2-primary" href={`${API_URL}/auth/steam`}>Войти через Steam</a></div>;
}
export function ItemTile({ item, selected, onClick, disabled, status }: { item: CaseItem; selected?: boolean; onClick: () => void; disabled?: boolean; status?: string }) {
  const [weapon, finish = ""] = item.name.split(" | ");
  return <button type="button" className={`edv2-item${selected ? " is-selected" : ""}`} aria-pressed={selected ?? false} aria-label={`${item.name}, ${money(item.valueMinor)}${status ? `, ${status}` : ""}`} onClick={onClick} disabled={disabled} style={{ borderTopColor: edRarity[item.rarity] }}>
    <div className="edv2-item-media"><EditorialItemImage name={item.name} imageUrl={item.imageUrl} decorative /><span className="edv2-check">{selected && <Check size={11} />}</span></div>
    <div className="edv2-item-body"><b title={weapon}>{weapon}</b><p title={finish}>{finish || RARITY_LABELS[item.rarity]}</p><strong>{money(item.valueMinor)}</strong>{status && <small>{status}</small>}</div>
  </button>;
}
export type ItemSort = "newest" | "price-desc" | "price-asc" | "name";
export function ItemFilters({ query, setQuery, rarity, setRarity, sort, setSort }: { query: string; setQuery: (v: string) => void; rarity: string; setRarity: (v: string) => void; sort: ItemSort; setSort: (v: ItemSort) => void }) {
  return <div className="edv2-filters"><label className="edv2-field edv2-search"><Search size={15} /><input aria-label="Поиск скинов" placeholder="Поиск скинов…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><label className="edv2-field"><select aria-label="Редкость" value={rarity} onChange={(e) => setRarity(e.target.value)}><option value="">Все редкости</option>{Object.entries(RARITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="edv2-field"><ArrowDownUp size={13} /><select aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value as ItemSort)}><option value="newest">По умолчанию</option><option value="price-desc">Сначала дороже</option><option value="price-asc">Сначала дешевле</option><option value="name">По названию</option></select></label></div>;
}
export function filterItems<T>(items: T[], getItem: (value: T) => CaseItem, query: string, rarity: string, sort: ItemSort) {
  return items.filter((value) => { const item = getItem(value); return item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (!rarity || item.rarity === rarity); }).sort((a, b) => {
    const x = getItem(a), y = getItem(b);
    if (sort === "name") return x.name.localeCompare(y.name);
    if (sort === "newest") return 0;
    const cmp = BigInt(x.valueMinor) < BigInt(y.valueMinor) ? -1 : BigInt(x.valueMinor) > BigInt(y.valueMinor) ? 1 : 0;
    return sort === "price-asc" ? cmp : -cmp;
  });
}
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, busy }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className="edv2-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><div className="edv2-dialog-heading"><h2>{title}</h2><button aria-label="Закрыть" onClick={onClose} disabled={busy}><X size={18} /></button></div><div className="edv2-dialog-copy">{children}</div><div className="edv2-actions"><button className="edv2-btn" onClick={onClose} disabled={busy}>Отмена</button><button className="edv2-btn edv2-primary" onClick={onConfirm} disabled={busy}>{busy ? "Выполняем…" : confirmLabel}</button></div></dialog>;
}
export function OperationState({ operation, onRefresh }: { operation: { busy: boolean; pending: unknown; error: string; notice: string; reconcile: () => Promise<boolean | undefined> }; onRefresh: () => void }) {
  return <div aria-live="polite">{operation.busy && <div className="edv2-operation"><span className="edv2-spinner" />Сервер обрабатывает операцию…</div>}{!operation.busy && !!operation.pending && <div className="edv2-recovery"><ShieldCheck size={20} /><div><b>Проверяем предыдущую операцию</b><p>Ответ не подтверждён. Повторное списание заблокировано, в том числе после перезагрузки.</p></div><button className="edv2-btn" onClick={async () => { if (await operation.reconcile()) onRefresh(); }}>Проверить историю</button></div>}{operation.error && <p className="edv2-error" role="alert">{operation.error}</p>}{operation.notice && <p className="edv2-toast">{operation.notice}</p>}</div>;
}
