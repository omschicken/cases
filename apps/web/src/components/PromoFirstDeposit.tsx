import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === "true";

/**
 * "+10% on first deposit (up to 500 RUB)". Shown only to a logged-in user who
 * still has the bonus, and only while deposits are actually switched on —
 * otherwise the button would lead to a page that can't take a deposit.
 */
export function PromoFirstDeposit() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!user || !paymentsEnabled) {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ firstDepositBonusAvailable: boolean }>("/wallet/promo-status")
      .then((r) => !cancelled && setAvailable(r.firstDepositBonusAvailable === true))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!available) return null;

  return (
    <aside className="dz-promo-banner" aria-label={t("promo.firstDeposit.title", { defaultValue: "Бонус на первый депозит" })}>
      <span className="dz-promo-banner__title">
        {t("promo.firstDeposit.title", { defaultValue: "🎁 Бонус на первый депозит" })}
      </span>
      <span className="dz-promo-banner__percent">+10%</span>
      <span className="dz-promo-banner__cap">
        {t("promo.firstDeposit.cap", { defaultValue: "до 500 ₽" })}
      </span>
      <Link to="/wallet" className="dz-promo-banner__cta">
        {t("promo.firstDeposit.cta", { defaultValue: "Пополнить" })}
      </Link>
    </aside>
  );
}
