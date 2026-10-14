import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CaseChest } from "../components/CaseChest";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseDto, CaseItem, GameOperationDto, WalletDto } from "../lib/types";

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

  if (!user) return <div className="game-workspace game-auth game-auth--battles"><span>DROPZONE / BATTLES</span><h1>СРАЖЕНИЯ</h1><p>Войди, чтобы выйти на арену против бота.</p><Link to="/login" className="feature-primary">Войти <span aria-hidden="true">↗</span></Link></div>;
  return <div className="game-workspace battle-workspace">
    <header className="game-heading"><div><span className="section-kicker">АРЕНА / 1 VS 1</span><h1>СРАЖЕНИЯ</h1><p>Выбери кейс. Ты и бот получите по одному серверному roll. Победитель по стоимости забирает оба предмета.</p></div><div className="game-counter"><span>БАЛАНС</span><strong>{wallet ? formatMinor(wallet.balanceMinor) : "…"}</strong></div></header>
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <section className={`battle-result ${result.won ? "is-won" : "is-lost"}`}><div className="battle-result-title"><span>{result.won ? "ПОБЕДА / ОБА ПРЕДМЕТА В ИНВЕНТАРЕ" : "ПОРАЖЕНИЕ / РЕВАНШ?"}</span><strong>{result.battleCase.name}</strong></div><BattleDrop label="ТЫ" item={result.playerItem}/><div className="battle-versus">{result.won ? "WIN" : "LOSE"}</div><BattleDrop label="БОТ" item={result.botItem}/></section>}
    <div className="battle-layout"><section><div className="game-section-label"><span>01 / ВЫБЕРИ КЕЙС</span><span>{cases.length} ДОСТУПНО</span></div>{cases.length > 8 && <label className="battle-search"><span>ПОИСК ПО КЕЙСАМ</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название кейса…" aria-label="Поиск кейса"/><small>{visibleCases.length} / {cases.length}</small></label>}{loading ? <p>Загрузка…</p> : visibleCases.length === 0 ? <div className="battle-no-results"><strong>Кейсы не найдены</strong><p>Попробуй другое название.</p><button type="button" onClick={() => setQuery("")}>Сбросить поиск ↗</button></div> : <div className="battle-case-grid">{visibleCases.map((item) => <button type="button" key={item.id} disabled={submitting} className={`battle-case ${selectedId === item.id ? "selected" : ""}`} onClick={() => { setSelectedId(item.id); setResult(null); setConfirming(false); }}><span>{String(item.itemCount ?? item.items.length).padStart(2, "0")} DROPS</span><div className="battle-case-art"><CaseChest caseName={item.name} caseSlug={item.slug}/></div><strong>{item.name}</strong><b>{formatMinor(item.priceMinor, item.currency)}</b></button>)}</div>}</section>
      <aside className="game-summary battle-summary"><span className="game-summary-label">02 / ЛОББИ</span><div className="battle-players"><div><i>{user.displayName?.[0] ?? user.email[0]}</i><span>ТЫ</span></div><b>VS</b><div><i>AI</i><span>БОТ</span></div></div><dl><div><dt>Кейс</dt><dd>{selected?.name ?? "—"}</dd></div><div><dt>Вход</dt><dd>{selected ? formatMinor(selected.priceMinor, selected.currency) : "—"}</dd></div><div><dt>Раундов</dt><dd>1</dd></div></dl>{confirming ? <div className="game-confirm"><button type="button" disabled={submitting} onClick={() => void startBattle()}>{submitting ? "Сражение…" : "Подтвердить вход"}</button><button type="button" disabled={submitting} onClick={() => setConfirming(false)}>Отмена</button></div> : <button type="button" className="game-run" disabled={!selected} onClick={() => setConfirming(true)}>Начать сражение</button>}</aside></div>
  </div>;
}

function BattleDrop({ label, item }: { label: string; item: CaseItem }) {
  return <article className="battle-drop" style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}><span>{label}</span><img src={item.imageUrl} alt={item.name}/><strong>{item.name}</strong><b>{formatMinor(item.valueMinor, item.currency)}</b></article>;
}
