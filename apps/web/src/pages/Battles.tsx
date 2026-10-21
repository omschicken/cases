import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Plus, RefreshCw, ShieldCheck, Swords, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEditorialData } from "../hooks/useEditorialData";
import { resolveCaseArt } from "../lib/caseArt";
import { api } from "../lib/api";
import type { CaseDto, GameOperationDto, WalletDto } from "../lib/types";
import { DataState, SignInState, money } from "../components/editorial/SectionUI";

type BattleRoundResult = { round: number; caseId: string; itemId: string; name: string; imageUrl: string; valueMinor: string; roll: number; nonce: number };
type AwardedBattleItem = { inventoryItemId: string; caseId: string; itemId: string; name: string; imageUrl: string; valueMinor: string };
type BattleParticipant = { id: string; userId: string; displayName: string; avatarUrl: string | null; paidMinor: string; scoreMinor: string; isWinner: boolean; roundResults: BattleRoundResult[]; awardedItems: AwardedBattleItem[] };
type BattleRoom = { id: string; caseIds: string[]; maxPlayers: number; status: "WAITING" | "COMPLETED" | "CANCELLED"; createdAt: string; completedAt: string | null; createdBy: { id: string; displayName: string | null }; participants: BattleParticipant[]; cases?: Array<{ id: string; name: string; imageUrl: string; priceMinor: string }> };

const roomPath = (id: string) => `/games/battles/rooms/${id}`;
const roomFee = (room: BattleRoom, cases: CaseDto[]) => room.caseIds.reduce((sum, id) => sum + BigInt(cases.find((item) => item.id === id)?.priceMinor ?? "0"), 0n).toString();

export function BattlesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const casesData = useEditorialData<CaseDto[]>("/cases");
  const roomsData = useEditorialData<BattleRoom[]>("/games/battles/rooms");
  const roomData = useEditorialData<BattleRoom>(roomId ? roomPath(roomId) : null);
  const historyData = useEditorialData<GameOperationDto[]>(user ? "/games/operations/me" : null);
  const wallet = useEditorialData<WalletDto>(user ? "/wallet/me" : null);
  const [tab, setTab] = useState<"lobby" | "history">("lobby");
  const [constructing, setConstructing] = useState(false);
  const [rounds, setRounds] = useState<string[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [createRequestKey, setCreateRequestKey] = useState(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem("casecrow.battles.create-request") ?? "null") as { requestKey?: string } | null;
      return pending?.requestKey ?? sessionStorage.getItem("casecrow.battles.create-key") ?? crypto.randomUUID();
    } catch { return crypto.randomUUID(); }
  });
  const [caseFilter, setCaseFilter] = useState("");
  const [playerFilter, setPlayerFilter] = useState("any");
  const [sort, setSort] = useState("newest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState(false);

  const cases = (casesData.data ?? []).filter((item) => item.isActive && item.currency === "RUB" && item.canBattle !== false);
  const rooms = roomsData.data ?? [];
  const activeRoom = roomData.data;
  const fee = rounds.reduce((sum, id) => sum + BigInt(cases.find((item) => item.id === id)?.priceMinor ?? "0"), 0n);
  const available = BigInt(wallet.data?.balanceMinor ?? "0");
  const myBattles = (historyData.data ?? []).filter((item) => item.type === "BATTLE");
  const filteredRooms = useMemo(() => rooms.filter((room) => {
    const names = room.caseIds.map((id) => cases.find((item) => item.id === id)?.name ?? "").join(" ").toLowerCase();
    const matchesCase = !caseFilter || names.includes(caseFilter.toLowerCase()) || room.id.toLowerCase().includes(caseFilter.toLowerCase());
    const matchesPlayers = playerFilter === "any" || room.maxPlayers === Number(playerFilter);
    return matchesCase && matchesPlayers;
  }).sort((a, b) => sort === "fee-low" ? Number(roomFee(a, cases)) - Number(roomFee(b, cases)) : sort === "players" ? b.participants.length - a.participants.length : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [rooms, cases, caseFilter, playerFilter, sort]);

  useEffect(() => {
    if (!roomId || activeRoom?.status !== "WAITING") return;
    const timer = window.setInterval(() => { roomData.refresh(); roomsData.refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [roomId, activeRoom?.status, roomData.refresh, roomsData.refresh]);
  useEffect(() => {
    if (!roomId) return;
    const timer = window.setInterval(() => roomsData.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [roomId, roomsData.refresh]);
  useEffect(() => {
    if (!roomId || activeRoom?.status !== "COMPLETED") return;
    setReveal(true);
    const timer = window.setTimeout(() => setReveal(false), 4600);
    return () => window.clearTimeout(timer);
  // A new room id starts its own reveal; an already-completed URL is still fully recoverable.
  }, [roomId, activeRoom?.status]);

  const openRoom = (id: string) => { setError(""); setSearchParams({ room: id }); };
  const closeRoom = () => { setSearchParams({}); roomData.refresh(); roomsData.refresh(); };
  const addRound = (caseId: string) => { if (rounds.length < 5) setRounds((value) => [...value, caseId]); };
  const removeRound = (index: number) => setRounds((value) => value.filter((_, position) => position !== index));
  const createRoom = async () => {
    if (!user || !rounds.length || fee > available) return;
    setBusy(true); setError("");
    try {
      const requestConfig = JSON.stringify({ caseIds: rounds, maxPlayers });
      let requestKey = createRequestKey;
      try {
        const previous = JSON.parse(sessionStorage.getItem("casecrow.battles.create-request") ?? "null") as { requestKey?: string; config?: string } | null;
        if (previous?.config === requestConfig && previous.requestKey) requestKey = previous.requestKey;
        else {
          requestKey = crypto.randomUUID(); setCreateRequestKey(requestKey);
          sessionStorage.setItem("casecrow.battles.create-key", requestKey);
          sessionStorage.setItem("casecrow.battles.create-request", JSON.stringify({ requestKey, config: requestConfig }));
        }
      } catch { /* session storage is an optional retry aid */ }
      const room = await api.post<BattleRoom>("/games/battles/rooms", { requestKey, caseIds: rounds, maxPlayers });
      try { sessionStorage.removeItem("casecrow.battles.create-request"); } catch { /* optional retry aid */ }
      const nextKey = crypto.randomUUID(); setCreateRequestKey(nextKey);
      try { sessionStorage.setItem("casecrow.battles.create-key", nextKey); } catch { /* optional retry aid */ }
      setConstructing(false); setRounds([]); setSearchParams({ room: room.id });
      roomsData.refresh(); wallet.refresh(); historyData.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать сражение"); }
    finally { setBusy(false); }
  };
  const joinRoom = async (room: BattleRoom) => {
    if (!user) return;
    setBusy(true); setError("");
    try {
      const result = await api.post<BattleRoom>(`/games/battles/rooms/${room.id}/join`);
      setSearchParams({ room: result.id });
      roomData.refresh();
      roomsData.refresh(); wallet.refresh(); historyData.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось подключиться к сражению"); roomsData.refresh(); }
    finally { setBusy(false); }
  };
  const cancelRoom = async (room: BattleRoom) => {
    setBusy(true); setError("");
    try { await api.post<BattleRoom>(`/games/battles/rooms/${room.id}/cancel`); roomData.refresh(); roomsData.refresh(); wallet.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отменить комнату"); }
    finally { setBusy(false); }
  };

  return <section className="edv2 cc-battles">
    <div className="edv2-banner"><div className="edv2-banner-copy"><div className="edv2-kicker">COMMUNITY / CASE BATTLES</div><h1>Сражения</h1><p>Создайте комнату, соберите игроков и откройте кейсы вместе.</p></div><div className="edv2-banner-cases">{cases.slice(0, 3).map((item) => <img key={item.id} src={resolveCaseArt(item.slug, item.imageUrl)} alt={item.name} />)}</div></div>

    {activeRoom && <section className="cc-arena-wrap" aria-label="Арена сражения">
      <div className="edv2-row edv2-between cc-arena-heading"><div><span className="edv2-label">{activeRoom.status === "COMPLETED" ? "СРАЖЕНИЕ ЗАВЕРШЕНО" : activeRoom.status === "CANCELLED" ? "КОМНАТА ОТМЕНЕНА" : "АРЕНА / ОЖИДАНИЕ ИГРОКОВ"}</span><h2>{activeRoom.status === "COMPLETED" ? "Результаты раундов" : activeRoom.status === "CANCELLED" ? "Взнос возвращён" : "Комната сражения"}</h2><p>Комната {activeRoom.id.slice(0, 8)} · {activeRoom.caseIds.length} раунд(а) · {activeRoom.participants.length}/{activeRoom.maxPlayers} игроков</p></div><button className="edv2-btn edv2-xs" onClick={closeRoom}><X size={14} /> Закрыть</button></div>
      {roomData.loading && !activeRoom ? <div className="edv2-panel cc-room-loading">Загружаем состояние комнаты…</div> : <>
        <div className="cc-arena-seats">
          {Array.from({ length: activeRoom.maxPlayers }, (_, index) => {
            const player = activeRoom.participants[index];
            return <article className={"edv2-panel cc-arena-seat" + (player?.isWinner ? " is-winner" : "")} key={player?.id ?? `empty-${index}`}>
              <div className="cc-seat-head">{player?.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span className="edv2-face">{player?.displayName.slice(0, 1) ?? "?"}</span>}<div><strong>{player?.displayName ?? "Ожидание игрока"}</strong><small>{player ? player.userId === user?.id ? "Вы" : player.isWinner ? "Победитель" : activeRoom.status === "COMPLETED" ? "Участник" : "В комнате" : "Свободное место"}</small></div><b>{player && activeRoom.status === "COMPLETED" ? money(player.scoreMinor) : "—"}</b></div>
              {player && activeRoom.status === "COMPLETED" ? <div className={"cc-seat-drops" + (reveal ? " is-revealing" : "")}>{player.roundResults.map((drop, round) => <div className="cc-drop-result" key={`${player.id}-${drop.round}`} style={{ "--drop-delay": `${(index * 0.12 + round * 0.2).toFixed(2)}s` } as CSSProperties}><img src={drop.imageUrl} alt={drop.name} /><div><small>Раунд {round + 1} · выпадение</small><strong>{drop.name}</strong><span>{money(drop.valueMinor)}</span></div></div>)}<div className="cc-awards"><span>{player.isWinner ? "Начислено в инвентарь" : "Выигрыш"}</span>{player.awardedItems.length ? player.awardedItems.map((item) => <div className="cc-award-item" key={item.inventoryItemId}><img src={item.imageUrl} alt="" /><strong>{item.name}</strong><b>{money(item.valueMinor)}</b></div>) : <small>{player.isWinner ? "Предметы доступны в инвентаре" : "В этот раз предметы не начислены"}</small>}</div></div> : <div className="cc-seat-placeholder"><Swords size={22} /><span>{player ? "Раунды стартуют, когда комната заполнится" : "Свободное место в лобби"}</span></div>}
            </article>;
          })}
        </div>
        {activeRoom.status === "WAITING" && !activeRoom.participants.some((player) => player.userId === user?.id) && activeRoom.participants.length < activeRoom.maxPlayers && <div className="edv2-row cc-join-row"><p>Взнос за все раунды: <strong>{money(roomFee(activeRoom, cases))}</strong></p><button className="edv2-btn edv2-primary" disabled={!user || busy || available < BigInt(roomFee(activeRoom, cases))} onClick={() => joinRoom(activeRoom)}>{!user ? "Войдите, чтобы играть" : busy ? "Подключаем…" : available < BigInt(roomFee(activeRoom, cases)) ? "Недостаточно средств" : "Войти в сражение"}</button></div>}
        {activeRoom.status === "WAITING" && activeRoom.createdBy.id === user?.id && activeRoom.participants.length === 1 && <div className="cc-cancel-row"><p>Если матч не начат, отмените комнату: взнос вернётся на баланс.</p><button className="edv2-btn" disabled={busy} onClick={() => cancelRoom(activeRoom)}>Отменить комнату</button></div>}
        {activeRoom.status === "COMPLETED" && <p className="cc-fairness-note"><ShieldCheck size={14} /> Итоги вычислены сервером. Участники и раунды сохраняются после обновления страницы.</p>}
        {activeRoom.status === "CANCELLED" && <p className="cc-fairness-note">Взнос за комнату возвращён создателю.</p>}
      </>}
    </section>}

    <div className="edv2-battlebar"><div className="edv2-chips"><button className={"edv2-chip" + (tab === "lobby" ? " is-active" : "")} onClick={() => setTab("lobby")}>Лобби</button><button className={"edv2-chip" + (tab === "history" ? " is-active" : "")} onClick={() => setTab("history")}>Мои сражения</button></div><div className="edv2-actions"><button className="edv2-btn" onClick={() => { roomsData.refresh(); casesData.refresh(); }}><RefreshCw size={14} /> Обновить</button><button className="edv2-btn edv2-primary" onClick={() => { setConstructing(!constructing); setError(""); }}><Plus size={15} /> Создать сражение</button></div></div>

    {error && <p className="edv2-error" role="alert">{error}</p>}
    {constructing && <section className="edv2-panel cc-constructor">
      <div className="edv2-row edv2-between"><div><span className="edv2-label">КОНСТРУКТОР</span><h2>Новое сражение</h2><p>Добавьте от 1 до 5 разных кейсов. Каждый кейс станет отдельным раундом.</p></div><button className="edv2-subtle" onClick={() => setConstructing(false)}>Свернуть</button></div>
      <div className="cc-constructor-grid"><div><label className="edv2-small" htmlFor="cc-case-picker">Добавить кейс</label><div className="cc-add-case"><select id="cc-case-picker" value="" onChange={(event) => addRound(event.target.value)} disabled={rounds.length >= 5}><option value="">Выберите кейс…</option>{cases.filter((item) => !rounds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.priceMinor)}</option>)}</select><Plus size={16} /></div><div className="cc-round-list">{rounds.map((id, index) => { const item = cases.find((value) => value.id === id); return <div className="cc-round-row" key={`${id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><img src={resolveCaseArt(item?.slug ?? "", item?.imageUrl)} alt="" /><strong>{item?.name}</strong><b>{item ? money(item.priceMinor) : "—"}</b><button aria-label="Удалить раунд" onClick={() => removeRound(index)}><X size={14} /></button></div>; })}{!rounds.length && <p className="cc-empty-rounds">Добавьте кейсы, чтобы собрать раунды.</p>}</div></div>
        <div className="cc-room-settings"><label className="edv2-small" htmlFor="cc-player-count">Игроки в комнате</label><select id="cc-player-count" value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}><option value={2}>1 × 1 · 2 игрока</option><option value={3}>Свободная игра · 3 игрока</option><option value={4}>Свободная игра · 4 игрока</option></select><div className="cc-entry-total"><span>Взнос с каждого</span><strong>{money(fee.toString())}</strong><small>Ваш баланс: {wallet.data ? money(wallet.data.balanceMinor) : "Загрузка…"}</small></div><button className="edv2-btn edv2-primary" disabled={!user || busy || !rounds.length || !wallet.data || fee > available} onClick={createRoom}>{busy ? "Создаём комнату…" : !user ? "Войдите, чтобы создать" : fee > available ? "Недостаточно средств" : "Создать комнату"}</button>{!user && <SignInState />}</div></div>
    </section>}

    {tab === "lobby" ? <>
      <div className="edv2-sectionhead"><h2>Открытые комнаты <span className="edv2-count">{filteredRooms.length}</span></h2><span className="edv2-small">Реальные игроки · серверные результаты</span></div>
      <div className="cc-lobby-filters"><label><span>Поиск</span><input value={caseFilter} onChange={(event) => setCaseFilter(event.target.value)} placeholder="Кейс или номер комнаты" /></label><label><span>Игроки</span><select value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)}><option value="any">Любое число</option><option value="2">2 игрока</option><option value="3">3 игрока</option><option value="4">4 игрока</option></select></label><label><span>Сортировка</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Сначала новые</option><option value="fee-low">По взносу</option><option value="players">По заполненности</option></select></label><button className="edv2-btn" onClick={() => roomsData.refresh()}><RefreshCw size={13} /> Обновить лобби</button></div>
      <DataState loading={roomsData.loading} error={roomsData.error} retry={roomsData.refresh} empty={!roomsData.loading && !roomsData.error && !filteredRooms.length ? "Открытых комнат пока нет — создайте первую." : undefined} />
      <div className="cc-room-grid">{filteredRooms.map((room) => { const inRoom = room.participants.some((player) => player.userId === user?.id); const feeMinor = roomFee(room, cases); return <article className="edv2-panel cc-room-card" key={room.id}>
        <div className="cc-room-card-top"><span className="edv2-pill">{room.participants.length}/{room.maxPlayers} игроков</span><span className="cc-live"><i /> Открыто</span></div><div className="cc-room-cases">{room.caseIds.map((id, round) => { const item = cases.find((value) => value.id === id); return <div className="cc-room-case" key={`${id}-${round}`}><img src={resolveCaseArt(item?.slug ?? "", item?.imageUrl)} alt="" /><span>Раунд {round + 1}</span></div>; })}</div><div className="cc-room-info"><div><span className="edv2-small">Создатель</span><strong>{room.createdBy.displayName ?? "Игрок"}</strong></div><div><span className="edv2-small">Взнос за раунды</span><strong>{money(feeMinor)}</strong></div></div><div className="cc-room-players">{room.participants.map((player) => <span className="edv2-face" key={player.id} title={player.displayName}>{player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : player.displayName.slice(0, 1)}</span>)}{Array.from({ length: Math.max(0, room.maxPlayers - room.participants.length) }, (_, index) => <span className="cc-open-seat" key={index}>+</span>)}</div><div className="cc-room-actions"><button className="edv2-btn" onClick={() => openRoom(room.id)}><Eye size={14} /> Наблюдать</button><button className="edv2-btn edv2-primary" disabled={!user || busy || inRoom || available < BigInt(feeMinor)} onClick={() => inRoom ? openRoom(room.id) : joinRoom(room)}>{inRoom ? "Вернуться" : !user ? "Войдите, чтобы играть" : available < BigInt(feeMinor) ? "Недостаточно средств" : "Войти"}</button></div>
      </article>; })}</div>
    </> : <>
      <div className="edv2-sectionhead"><h2>История сражений</h2><span className="edv2-small">Завершённые серверные операции</span></div>
      {!user ? <SignInState /> : <><DataState loading={historyData.loading} error={historyData.error} retry={historyData.refresh} empty={!historyData.loading && !historyData.error && !myBattles.length ? "У вас пока нет завершённых сражений" : undefined} /><div className="edv2-panel">{myBattles.map((item) => { const id = typeof item.metadata?.roomId === "string" ? item.metadata.roomId : ""; return <div className="edv2-battle-entry" key={item.id}><div className="edv2-entry-mode"><strong>Комната</strong><p>{new Date(item.createdAt).toLocaleString("ru-RU")}</p></div><div className="edv2-case-cell"><strong>{id ? `Сражение ${id.slice(0, 8)}` : "Сражение с ботом"}</strong></div><span className={"edv2-pill edv2-entry-price" + (item.status === "LOST" ? " is-lost" : "")}>{item.status === "WON" ? "Победа" : "Поражение"}</span><span className="edv2-participants edv2-small">Раундов: {Array.isArray(item.metadata?.roundResults) ? item.metadata.roundResults.length : 1}</span>{id ? <button className="edv2-btn edv2-xs" onClick={() => openRoom(id)}>Открыть арену →</button> : <span className="edv2-small">Проверка #{item.nonce}</span>}</div>; })}</div></>}
    </>}
    {wallet.error && <p className="edv2-error">Баланс недоступен. <button className="edv2-subtle" onClick={wallet.refresh}>Обновить</button></p>}
    <p className="cc-fairness-note"><ShieldCheck size={14} /> Выпадения определяются сервером и записываются в историю. Повторный запрос на вход в уже оплаченную комнату безопасен.</p>
  </section>;
}
