import { useState } from "react";
import { Link } from "react-router-dom";
import { History, Plus, ShieldCheck, Swords } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEditorialData } from "../hooks/useEditorialData";
import { useEditorialOperation } from "../hooks/useEditorialOperation";
import { resolveCaseArt } from "../lib/caseArt";
import type { CaseDto, CaseItem, GameOperationDto, WalletDto } from "../lib/types";
import { EditorialItemImage } from "../components/editorial/EditorialItemImage";
import { ConfirmDialog, DataState, OperationState, SignInState, money } from "../components/editorial/SectionUI";

type BattleResult = { operation: GameOperationDto; won: boolean; battleCase: { id: string; name: string }; playerItem: CaseItem; botItem: CaseItem; winnings: string[] };
export function BattlesPage() {
  const { user } = useAuth();
  const cases = useEditorialData<CaseDto[]>("/cases");
  const history = useEditorialData<GameOperationDto[]>(user ? "/games/operations/me" : null);
  const wallet = useEditorialData<WalletDto>(user ? "/wallet/me" : null);
  const operation = useEditorialOperation();
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("available");
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [historyItem, setHistoryItem] = useState<GameOperationDto | null>(null);
  const available = (cases.data ?? []).filter((value) => value.isActive && value.currency === "RUB" && value.canBattle !== false);
  const chosen = available.find((value) => value.id === selectedId) ?? available[0];
  const battles = (history.data ?? []).filter((value) => value.type === "BATTLE");
  const insufficient = !!chosen && !!wallet.data && BigInt(wallet.data.balanceMinor) < BigInt(chosen.priceMinor);
  const refresh = () => { history.refresh(); wallet.refresh(); };
  const create = async () => {
    if (!chosen) return;
    setConfirm(false); setResult(null);
    const data = await operation.run<BattleResult>({ type: "BATTLE", ids: [], caseId: chosen.id }, "/games/battles", { caseId: chosen.id });
    if (data) setResult(data);
    refresh();
  };
  return <section className="edv2">
    <div className="edv2-banner"><div className="edv2-banner-copy"><div className="edv2-kicker">COMMUNITY / CASE BATTLES</div><h1>Сражения</h1><p>Открывайте кейсы. Соревнуйтесь. Забирайте лучшие скины.</p></div><div className="edv2-banner-cases">{available.slice(0, 3).map((item) => <img key={item.id} src={resolveCaseArt(item.slug, item.imageUrl)} alt={item.name} />)}</div></div>
    <div className="edv2-battlebar"><div className="edv2-chips"><button className={"edv2-chip" + (tab === "available" ? " is-active" : "")} onClick={() => setTab("available")}>С ботом</button><button className={"edv2-chip" + (tab === "history" ? " is-active" : "")} onClick={() => setTab("history")}><History size={13} /> Моя история</button></div><div className="edv2-actions"><button className="edv2-btn edv2-dark" onClick={() => { setPicker(!picker); setTab("available"); }}><Plus size={15} />Выбрать кейс</button></div></div>
    {picker && <div className="edv2-panel edv2-contract-select"><div className="edv2-row edv2-between"><h2>Кейс для сражения</h2><button className="edv2-subtle" onClick={() => setPicker(false)}>Свернуть</button></div><div className="edv2-case-picker">{available.map((item) => <button className={"edv2-case-option" + (chosen?.id === item.id ? " is-selected" : "")} key={item.id} onClick={() => { setSelectedId(item.id); setPicker(false); setResult(null); }}><img src={resolveCaseArt(item.slug, item.imageUrl)} alt="" /><strong>{item.name}</strong><span>{money(item.priceMinor)}</span></button>)}</div></div>}
    <OperationState operation={operation} onRefresh={refresh} />
    {tab === "available" ? <><div className="edv2-sectionhead"><h2>{result ? "Результат сражения" : "Один кейс. Два участника."}</h2><span className="edv2-pill">1 × 1 · бот</span></div>
      <div className="edv2-panel edv2-battle-feature"><div className="edv2-player"><div className="edv2-row"><span className="edv2-face">{(user?.displayName ?? "В").slice(0, 1)}</span><div><strong>{user?.displayName ?? "Вы"}</strong><p className="edv2-small">Игрок</p></div></div><div className="edv2-score">{result ? money(result.playerItem.valueMinor) : "—"}</div>{result ? <EditorialItemImage name={result.playerItem.name} imageUrl={result.playerItem.imageUrl} /> : <Swords size={43} strokeWidth={1} color="#a5ad9d" />}<span className="edv2-small">{result?.playerItem.name ?? "Предмет появится после открытия"}</span></div>
      <div className="edv2-battle-mid"><span className="edv2-label">{result ? "РАУНД ЗАВЕРШЁН · 1 / 1" : "ОДИН РАУНД · WINNER TAKES ALL"}</span>{chosen && <img src={resolveCaseArt(chosen.slug, chosen.imageUrl)} alt={chosen.name} />}<b>{result ? (result.won ? "Победа — оба предмета ваши" : "В этом раунде победил бот") : chosen?.name ?? "Выберите кейс"}</b>{result ? <div className="edv2-track"><span /></div> : <button className="edv2-btn edv2-primary" onClick={() => setConfirm(true)} disabled={!user || !chosen || operation.busy || !!operation.pending || insufficient || !wallet.data}>{insufficient ? "Недостаточно средств" : "Начать · " + (chosen ? money(chosen.priceMinor) : "—")}</button>}<span className="edv2-small">{result ? "Результат подтверждён сервером" : "Стоимость одного кейса списывается с баланса"}</span>{result && <button className="edv2-subtle" onClick={() => setResult(null)}>Новое сражение</button>}</div>
      <div className="edv2-player"><div className="edv2-row"><span className="edv2-face" style={{ background: "#343938" }}>B</span><div><strong>CaseCrow Bot</strong><p className="edv2-small">Соперник</p></div></div><div className="edv2-score">{result ? money(result.botItem.valueMinor) : "—"}</div>{result ? <EditorialItemImage name={result.botItem.name} imageUrl={result.botItem.imageUrl} /> : <Swords size={43} strokeWidth={1} color="#a5ad9d" />}<span className="edv2-small">{result?.botItem.name ?? "Тот же кейс. Независимый результат."}</span></div></div>
      <p className="edv2-battle-note"><ShieldCheck size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />При равной стоимости побеждает игрок. Сервер определяет оба предмета; победитель получает оба.</p>
      {!user && <SignInState />}
      <div className="edv2-sectionhead"><h2>Выберите сражение <span className="edv2-count">{available.length}</span></h2><span className="edv2-small">Один раунд с ботом</span></div><DataState loading={cases.loading} error={cases.error} retry={cases.refresh} empty={!cases.loading && !cases.error && !available.length ? "Доступных кейсов пока нет" : undefined} />
      <div className="edv2-panel">{available.map((item) => <div key={item.id} className="edv2-battle-entry"><div className="edv2-entry-mode"><strong>1 × 1</strong><p><span className="edv2-pill">С ботом</span></p></div><div className="edv2-case-cell"><img src={resolveCaseArt(item.slug, item.imageUrl)} alt="" /><strong>{item.name}</strong></div><strong className="edv2-entry-price">{money(item.priceMinor)}</strong><div className="edv2-participants edv2-row"><span className="edv2-face">В</span><span className="edv2-face" style={{ background: "#343938" }}>B</span><span className="edv2-small">1 раунд</span></div><button className="edv2-btn edv2-xs" onClick={() => { setSelectedId(item.id); setResult(null); window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }}>Выбрать →</button></div>)}</div>
    </> : <><div className="edv2-sectionhead"><h2>История сражений</h2><span className="edv2-small">Последние операции аккаунта</span></div>{!user ? <SignInState /> : <><DataState loading={history.loading} error={history.error} retry={history.refresh} empty={!history.loading && !history.error && !battles.length ? "У вас пока нет завершённых сражений" : undefined} /><div className="edv2-panel">{battles.map((item) => <div key={item.id} className="edv2-battle-entry"><div className="edv2-entry-mode"><strong>1 × 1 · бот</strong><p>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</p></div><div className="edv2-case-cell"><strong>{available.find((value) => value.id === item.metadata?.caseId)?.name ?? "Кейс из истории"}</strong></div><span className={"edv2-pill edv2-entry-price" + (item.status === "LOST" ? " is-lost" : "")}>{item.status === "WON" ? "Победа" : "Без выигрыша"}</span><span className="edv2-participants edv2-small">Раунд завершён</span><button className="edv2-btn edv2-xs" onClick={() => setHistoryItem(item)}>Подробнее</button></div>)}</div></>}</>}
    <p className="edv2-bottom-note">Многопользовательские комнаты и командные режимы пока недоступны.</p>
    {wallet.error && <p className="edv2-error">Баланс недоступен. <button className="edv2-subtle" onClick={wallet.refresh}>Обновить</button></p>}
    {confirm && chosen && <ConfirmDialog title="Начать сражение?" confirmLabel={"Списать " + money(chosen.priceMinor)} onClose={() => setConfirm(false)} onConfirm={create} busy={operation.busy}><p><strong>{chosen.name} · один раунд с ботом.</strong></p><p>Стоимость списывается сразу. При победе оба предмета попадут в инвентарь; при проигрыше предметы не начисляются.</p></ConfirmDialog>}
    {historyItem && <ConfirmDialog title="Сражение завершено" confirmLabel="Понятно" onClose={() => setHistoryItem(null)} onConfirm={() => setHistoryItem(null)}><p>Результат: <strong>{historyItem.status === "WON" ? "победа" : "без выигрыша"}</strong></p><p>Операция: {historyItem.id}</p><p>Nonce: {historyItem.nonce}</p><p style={{ overflowWrap: "anywhere" }}>Хеш серверного seed: {historyItem.serverSeedHash}</p><Link to="/inventory">Перейти в инвентарь →</Link></ConfirmDialog>}
  </section>;
}
