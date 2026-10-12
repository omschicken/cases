import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [result, setResult] = useState<BattleResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<CaseDto[]>("/cases"), user ? api.get<WalletDto>("/wallet/me") : Promise.resolve(null)])
      .then(([nextCases, nextWallet]) => { setCases(nextCases); setWallet(nextWallet); setSelectedId(nextCases[0]?.id ?? ""); })
      .catch(() => setError("Не удалось загрузить арену"))
      .finally(() => setLoading(false));
  }, [user]);

  const selected = cases.find((item) => item.id === selectedId);
  async function startBattle() {
    if (!selected) return;
    setSubmitting(true); setError(null); setResult(null);
    try {
      const next = await api.post<BattleResult>("/games/battles", { caseId: selected.id });
      setResult(next); setConfirming(false);
      if (wallet) setWallet({ balanceMinor: (BigInt(wallet.balanceMinor) - BigInt(selected.priceMinor)).toString() });
    } catch (err) { setError(err instanceof ApiError ? err.message : "Сражение не запущено"); }
    finally { setSubmitting(false); }
  }

  if (!user) return <div className="game-workspace game-auth"><span>DROPZONE / BATTLES</span><h1>СРАЖЕНИЯ</h1><p>Войди, чтобы выйти на арену против бота.</p><Link to="/login" className="feature-primary">Войти</Link></div>;
  return <div className="game-workspace battle-workspace">
    <header className="game-heading"><div><span className="section-kicker">АРЕНА / 1 VS 1</span><h1>СРАЖЕНИЯ</h1><p>Выбери кейс. Ты и бот получите по одному серверному roll. Победитель по стоимости забирает оба предмета.</p></div><div className="game-counter"><span>БАЛАНС</span><strong>{wallet ? formatMinor(wallet.balanceMinor) : "…"}</strong></div></header>
    {error && <div className="catalog-notice" role="alert">{error}</div>}
    {result && <section className={`battle-result ${result.won ? "is-won" : "is-lost"}`}><div className="battle-result-title"><span>{result.won ? "ПОБЕДА / ОБА ПРЕДМЕТА В ИНВЕНТАРЕ" : "ПОРАЖЕНИЕ / РЕВАНШ?"}</span><strong>{result.battleCase.name}</strong></div><BattleDrop label="ТЫ" item={result.playerItem}/><div className="battle-versus">{result.won ? "WIN" : "LOSE"}</div><BattleDrop label="БОТ" item={result.botItem}/></section>}
    <div className="battle-layout"><section><div className="game-section-label"><span>01 / ВЫБЕРИ КЕЙС</span><span>{cases.length} ДОСТУПНО</span></div>{loading ? <p>Загрузка…</p> : <div className="battle-case-grid">{cases.map((item) => <button type="button" key={item.id} className={`battle-case ${selectedId === item.id ? "selected" : ""}`} onClick={() => { setSelectedId(item.id); setResult(null); setConfirming(false); }}><span>{String(item.items.length).padStart(2, "0")} DROPS</span><img src={item.imageUrl} alt=""/><strong>{item.name}</strong><b>{formatMinor(item.priceMinor, item.currency)}</b></button>)}</div>}</section>
      <aside className="game-summary battle-summary"><span className="game-summary-label">02 / ЛОББИ</span><div className="battle-players"><div><i>{user.displayName?.[0] ?? user.email[0]}</i><span>ТЫ</span></div><b>VS</b><div><i>AI</i><span>БОТ</span></div></div><dl><div><dt>Кейс</dt><dd>{selected?.name ?? "—"}</dd></div><div><dt>Вход</dt><dd>{selected ? formatMinor(selected.priceMinor, selected.currency) : "—"}</dd></div><div><dt>Раундов</dt><dd>1</dd></div></dl>{confirming ? <div className="game-confirm"><button type="button" disabled={submitting} onClick={() => void startBattle()}>{submitting ? "Сражение…" : "Подтвердить вход"}</button><button type="button" disabled={submitting} onClick={() => setConfirming(false)}>Отмена</button></div> : <button type="button" className="game-run" disabled={!selected} onClick={() => setConfirming(true)}>Начать сражение</button>}</aside></div>
  </div>;
}

function BattleDrop({ label, item }: { label: string; item: CaseItem }) {
  return <article className="battle-drop" style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}><span>{label}</span><img src={item.imageUrl} alt={item.name}/><strong>{item.name}</strong><b>{formatMinor(item.valueMinor, item.currency)}</b></article>;
}
