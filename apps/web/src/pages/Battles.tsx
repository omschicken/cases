import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CaseChest } from "../components/CaseChest";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseDto, CaseItem, GameOperationDto, WalletDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Gate, Step } from "../components/dz/SelectableItem";

type BattleResult = { operation: GameOperationDto; won: boolean; battleCase: { id: string; name: string }; playerItem: CaseItem; botItem: CaseItem; winnings: string[] };

export function BattlesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<BattleResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<CaseDto[]>("/cases"), user ? api.get<WalletDto>("/wallet/me") : Promise.resolve(null)])
      .then(([nextCases, nextWallet]) => { setCases(nextCases); setWallet(nextWallet); setSelectedId(nextCases[0]?.id ?? ""); })
      .catch(() => setError("Не удалось загрузить арену"))
      .finally(() => setLoading(false));
  }, [user]);

  const selected = cases.find((item) => item.id === selectedId);
  const visibleCases = cases.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  async function startBattle() {
    if (!selected || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null); setResult(null);
    try {
      const next = await api.post<BattleResult>("/games/battles", { caseId: selected.id });
      setResult(next); setConfirming(false);
      setWallet(await api.get<WalletDto>("/wallet/me").catch(() => null));
    } catch (err) { setError(err instanceof ApiError && err.status === 0 ? "Ответ не получен. Проверь баланс и инвентарь перед повтором." : err instanceof ApiError ? err.message : "Сражение не запущено"); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (!user) return <Gate kicker="DROPZONE / BATTLES" title="СРАЖЕНИЯ" body="Войди, чтобы выйти на арену против бота." action={<Link to="/login" className="dz-commit">Войти <span aria-hidden="true">↗</span></Link>} />;
  return <div className="dz-workspace">
    <PageHeader kicker="АРЕНА / 1 VS 1" title="СРАЖЕНИЯ" lede="Выбери кейс. Ты и бот получите по одному серверному roll. Победитель по стоимости забирает оба предмета." aside={<Readout label="БАЛАНС" value={wallet ? formatMinor(wallet.balanceMinor) : "…"} />} />
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <section className={`dz-outcome dz-outcome--${result.won ? "won" : "lost"}`} role="status" aria-live="polite" style={{ display: "block" }}>
      <span className="dz-outcome__label">{result.won ? "ПОБЕДА / ОБА ПРЕДМЕТА В ИНВЕНТАРЕ" : "ПОРАЖЕНИЕ / РЕВАНШ?"}</span>
      <h2 className="dz-outcome__name">{result.battleCase.name}</h2>
      <div className="dz-versus">
        <BattleDrop label="ТЫ" item={result.playerItem}/>
        <span className="dz-versus__mark">{result.won ? "WIN" : "LOSE"}</span>
        <BattleDrop label="БОТ" item={result.botItem}/>
      </div>
    </section>}
    <div className="dz-workspace__layout"><section><Step label="01 / Выбери кейс" count={`${cases.length} доступно`} />{cases.length > 8 && <label className="dz-field"><span>Поиск по кейсам</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название кейса…" aria-label="Поиск кейса"/></label>}{loading ? <p>Загрузка…</p> : visibleCases.length === 0 ? <div className="dz-empty"><span className="dz-empty__mark" aria-hidden="true">⌕</span><h2 className="dz-empty__title">Кейсы не найдены</h2><p className="dz-empty__body">Попробуй другое название.</p><button type="button" className="dz-btn" onClick={() => setQuery("")}>Сбросить поиск ↗</button></div> : <div className="dz-pick-grid">{visibleCases.map((item) => <SelectableItem key={item.id} name={item.name} value={formatMinor(item.priceMinor, item.currency)} note={`${String(item.itemCount ?? item.items.length).padStart(2, "0")} drops`} selected={selectedId === item.id} disabled={submitting} onSelect={() => { setSelectedId(item.id); setResult(null); setConfirming(false); }} />)}</div>}</section>
      <aside className="dz-summary">
        <span className="dz-summary__label">02 / Лобби</span>
        <div className="battle-players"><div><i>{user.displayName?.[0] ?? user.email[0]}</i><span>ТЫ</span></div><b>VS</b><div><i>AI</i><span>БОТ</span></div></div>
        <dl className="dz-summary__rows">
          <div className="dz-summary__row"><dt>Кейс</dt><dd>{selected?.name ?? "—"}</dd></div>
          <div className="dz-summary__row"><dt>Вход</dt><dd>{selected ? formatMinor(selected.priceMinor, selected.currency) : "—"}</dd></div>
          <div className="dz-summary__row"><dt>Раундов</dt><dd>1</dd></div>
        </dl>
        {confirming
          ? <div className="dz-confirm">
              <button type="button" className="dz-commit" disabled={submitting} onClick={() => void startBattle()}>{submitting ? "Сражение…" : "Подтвердить вход"}</button>
              <button type="button" className="dz-confirm__cancel" disabled={submitting} onClick={() => setConfirming(false)}>Отмена</button>
            </div>
          : <button type="button" className="dz-commit" disabled={!selected} onClick={() => setConfirming(true)}>Начать сражение</button>}
      </aside></div>
  </div>;
}

function BattleDrop({ label, item }: { label: string; item: CaseItem }) {
  return <article className="battle-drop" style={{ "--dz-rarity": rarityColor(item.rarity), "--rarity-color": rarityColor(item.rarity) } as CSSProperties}><span>{label}</span><img src={item.imageUrl} alt={item.name}/><strong>{item.name}</strong><b>{formatMinor(item.valueMinor, item.currency)}</b></article>;
}
