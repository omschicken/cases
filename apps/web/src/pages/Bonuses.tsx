import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { PageHeader } from "../components/dz/PageHeader";

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
      <div className="dz-workspace">
        <PageHeader kicker="БОНУСЫ" title="БОНУСЫ" lede="Войди, чтобы получать ежедневные бонусы и активировать промокоды." />
        <div style={{ marginTop: "var(--dz-s5)" }}>
          <Link to="/login" className="dz-commit" style={{ textDecoration: "none", display: "inline-flex" }}>
            Войти <span aria-hidden="true" style={{ marginLeft: "var(--dz-s2)" }}>↗</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dz-workspace">
      <PageHeader
        kicker="БОНУСЫ / ЕЖЕДНЕВНО"
        title="БОНУСЫ"
        lede="Заходи каждый день, чтобы увеличить стрик и получить максимальный бонус на 7-й день."
      />

      {/* Daily bonus */}
      <div className="dz-panel" style={{ marginTop: "var(--dz-s5)" }}>
        <div className="dz-panel__label">
          <span>01 / Ежедневный бонус</span>
        </div>

        {loading ? (
          <p style={{ color: "var(--dz-text-4)", fontSize: "var(--dz-type-sm)" }}>Загрузка…</p>
        ) : daily && (
          <div>
            {/* Streak track */}
            <div className="dz-chips" style={{ marginBottom: "var(--dz-s4)" }}>
              {STREAK_LABELS.map((label, i) => {
                const isDone = i < daily.streakDay - (daily.claimedToday ? 1 : 0);
                const isCurrent = daily.claimedToday && i === daily.streakDay - 1;
                return (
                  <span
                    key={i}
                    className="dz-chip"
                    aria-pressed={isCurrent || undefined}
                    style={isDone ? { borderColor: "var(--dz-success)", color: "var(--dz-success)" } : undefined}
                  >
                    {label}
                    {isDone && <span aria-hidden="true" style={{ marginLeft: "4px" }}>✓</span>}
                  </span>
                );
              })}
            </div>

            {error && (
              <div role="alert" style={{ marginBottom: "var(--dz-s4)", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-danger)", borderRadius: "var(--dz-r-sm)", color: "var(--dz-danger)", fontSize: "var(--dz-type-sm)" }}>
                {error}
              </div>
            )}

            {claimResult ? (
              <div className="dz-outcome dz-outcome--won">
                <span className="dz-outcome__label">Бонус получен</span>
                <div>
                  <p className="dz-outcome__name">+{formatMinor(claimResult.amountMinor)}</p>
                  <span className="dz-outcome__meta">Стрик день {claimResult.streakDay}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--dz-s4)", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <span style={{ fontFamily: "var(--dz-font-technical)", fontSize: "var(--dz-type-tech)", letterSpacing: "var(--dz-tracking-tech)", textTransform: "uppercase", color: "var(--dz-text-4)" }}>
                    Сумма сегодня
                  </span>
                  <strong style={{ fontFamily: "var(--dz-font-display)", fontSize: "var(--dz-type-lg)", color: "var(--dz-amber)" }}>
                    {formatMinor(daily.amountMinor)}
                  </strong>
                </div>
                <button
                  type="button"
                  className="dz-commit"
                  disabled={daily.claimedToday || claiming}
                  onClick={() => void claimBonus()}
                >
                  {claiming ? "Получаем…" : daily.claimedToday ? "Получен сегодня ✓" : "Получить бонус"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Promo code */}
      <div className="dz-panel" style={{ marginTop: "var(--dz-s4)" }}>
        <div className="dz-panel__label">
          <span>02 / Промокод</span>
        </div>

        <p style={{ margin: "0 0 var(--dz-s4)", fontSize: "var(--dz-type-sm)", color: "var(--dz-text-3)" }}>
          Введи промокод, чтобы получить бонус на баланс. Каждый код можно использовать один раз.
        </p>

        {promoError && (
          <div role="alert" style={{ marginBottom: "var(--dz-s4)", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-danger)", borderRadius: "var(--dz-r-sm)", color: "var(--dz-danger)", fontSize: "var(--dz-type-sm)" }}>
            {promoError}
          </div>
        )}

        {promoResult ? (
          <div className="dz-outcome dz-outcome--won">
            <span className="dz-outcome__label">Промокод активирован</span>
            <p className="dz-outcome__name">+{formatMinor(promoResult.amountMinor, promoResult.currency)}</p>
            <button
              type="button"
              className="dz-btn"
              onClick={() => setPromoResult(null)}
            >
              Ввести ещё один
            </button>
          </div>
        ) : (
          <form style={{ display: "flex", gap: "var(--dz-s3)", flexWrap: "wrap" }} onSubmit={(e) => void redeemPromo(e)}>
            <label className="dz-field" style={{ flex: "1 1 200px" }}>
              <span>Промокод</span>
              <input
                type="text"
                placeholder="DROPZONE2024"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                maxLength={32}
                disabled={redeeming}
              />
            </label>
            <div style={{ alignSelf: "flex-end" }}>
              <button type="submit" className="dz-commit" disabled={!promoCode.trim() || redeeming}>
                {redeeming ? "Активируем…" : "Активировать"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
