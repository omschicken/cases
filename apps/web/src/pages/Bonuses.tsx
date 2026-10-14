import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";

interface DailyStatus {
  claimedToday: boolean;
  streakDay: number;
  amountMinor: string;
}

const STREAK_LABELS = ["День 1", "День 2", "День 3", "День 4", "День 5", "День 6", "ДЖЕКПОТ"];

export function BonusesPage() {
  const { user } = useAuth();
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [claiming, setClaiming] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ amountMinor: string; streakDay: number } | null>(null);
  const [promoResult, setPromoResult] = useState<{ amountMinor: string; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const claimingRef = useRef(false);
  const redeemingRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    api.get<DailyStatus>("/bonuses/daily").then(setDaily).catch(() => undefined).finally(() => setLoading(false));
  }, [user]);

  async function claimBonus() {
    if (claimingRef.current || daily?.claimedToday) return;
    claimingRef.current = true;
    setClaiming(true); setError(null); setClaimResult(null);
    try {
      const result = await api.post<{ amountMinor: string; streakDay: number }>("/bonuses/daily/claim", {});
      setClaimResult(result);
      setDaily((d) => d ? { ...d, claimedToday: true } : d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось получить бонус");
    } finally { claimingRef.current = false; setClaiming(false); }
  }

  async function redeemPromo(e: React.FormEvent) {
    e.preventDefault();
    if (redeemingRef.current || !promoCode.trim()) return;
    redeemingRef.current = true;
    setRedeeming(true); setPromoError(null); setPromoResult(null);
    try {
      const result = await api.post<{ amountMinor: string; currency: string }>("/bonuses/promo/redeem", { code: promoCode.trim() });
      setPromoResult(result);
      setPromoCode("");
    } catch (err) {
      setPromoError(err instanceof ApiError ? err.message : "Промокод не активирован");
    } finally { redeemingRef.current = false; setRedeeming(false); }
  }

  if (!user) {
    return (
      <div className="game-workspace game-auth game-auth--bonuses">
        <span>DROPZONE / БОНУСЫ</span>
        <h1>БОНУСЫ</h1>
        <p>Войди, чтобы получать ежедневные бонусы и активировать промокоды.</p>
        <Link to="/login" className="feature-primary">Войти <span aria-hidden="true">↗</span></Link>
      </div>
    );
  }

  return (
    <div className="game-workspace bonuses-workspace">
      <header className="game-heading">
        <div>
          <span className="section-kicker">БОНУСЫ / ЕЖЕДНЕВНО</span>
          <h1>БОНУСЫ</h1>
          <p>Заходи каждый день, чтобы увеличить стрик и получить максимальный бонус на 7-й день.</p>
        </div>
      </header>

      {/* Daily bonus */}
      <section className="bonus-section">
        <div className="game-section-label"><span>01 / ЕЖЕДНЕВНЫЙ БОНУС</span></div>
        {loading ? <p>Загрузка…</p> : daily && (
          <div className="bonus-daily">
            <div className="bonus-streak-track">
              {STREAK_LABELS.map((label, i) => (
                <div key={i} className={`bonus-streak-day ${daily.claimedToday && i === daily.streakDay - 1 ? "current" : i < daily.streakDay - (daily.claimedToday ? 1 : 0) ? "done" : ""}`}>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {error && <div className="catalog-notice" role="alert">{error}</div>}
            {claimResult ? (
              <div className="game-result game-result--won">
                <span>БОНУС ПОЛУЧЕН</span>
                <div>
                  <h2>+{formatMinor(claimResult.amountMinor)}</h2>
                  <strong>СТРИК ДЕНЬ {claimResult.streakDay}</strong>
                </div>
              </div>
            ) : (
              <div className="bonus-claim-row">
                <div>
                  <span>Сумма сегодня</span>
                  <strong>{formatMinor(daily.amountMinor)}</strong>
                </div>
                <button
                  type="button"
                  className="game-run"
                  disabled={daily.claimedToday || claiming}
                  onClick={() => void claimBonus()}
                >
                  {claiming ? "Получаем…" : daily.claimedToday ? "Получен сегодня ✓" : "Получить бонус"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Promo code */}
      <section className="bonus-section">
        <div className="game-section-label"><span>02 / ПРОМОКОД</span></div>
        <div className="bonus-promo">
          <p>Введи промокод, чтобы получить бонус на баланс. Каждый код можно использовать один раз.</p>
          {promoError && <div className="catalog-notice" role="alert">{promoError}</div>}
          {promoResult ? (
            <div className="game-result game-result--won">
              <span>ПРОМОКОД АКТИВИРОВАН</span>
              <div><h2>+{formatMinor(promoResult.amountMinor, promoResult.currency)}</h2></div>
              <button type="button" className="feature-primary" onClick={() => setPromoResult(null)}>Ввести ещё один</button>
            </div>
          ) : (
            <form className="bonus-promo-form" onSubmit={(e) => void redeemPromo(e)}>
              <input
                type="text"
                placeholder="DROPZONE2024"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                maxLength={32}
                disabled={redeeming}
                aria-label="Промокод"
              />
              <button type="submit" className="game-run" disabled={!promoCode.trim() || redeeming}>
                {redeeming ? "Активируем…" : "Активировать"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
