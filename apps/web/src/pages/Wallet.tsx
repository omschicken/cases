import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { LedgerEntryDto, PaymentRail, WalletDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { PromoFirstDeposit } from "../components/PromoFirstDeposit";

export function WalletPage() {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [ledger, setLedger] = useState<LedgerEntryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [depositRail, setDepositRail] = useState<PaymentRail>("CARD");
  const [depositAmount, setDepositAmount] = useState("5000.00");
  const depositCurrency = "RUB";

  const [withdrawRail, setWithdrawRail] = useState<PaymentRail>("CARD");
  const [withdrawAmount, setWithdrawAmount] = useState("1000.00");
  const withdrawCurrency = "RUB";
  const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === "true";
  const [withdrawDestination, setWithdrawDestination] = useState("");

  function load() {
    api.get<WalletDto>("/wallet/me").then(setWallet).catch(() => undefined);
    api
      .get<LedgerEntryDto[]>("/wallet/me/ledger")
      // Only an actual array reaches state. A non-array body — an error
      // envelope, or a paginated shape — would otherwise reach .map() during
      // render and white-screen the wallet, which is the worst page in the
      // product to lose to a malformed response.
      .then((rows) => setLedger(Array.isArray(rows) ? rows : []))
      .catch(() => undefined);
  }

  useEffect(load, []);

  async function onDeposit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const result = await api.post<{ status?: string }>("/payments/deposit", {
        rail: depositRail,
        amountMinor: Math.round(Number(depositAmount) * 100),
        currency: depositCurrency,
      });
      setInfo(result.status === "CONFIRMED" ? t("wallet.depositConfirmed") : t("wallet.depositPending"));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("wallet.depositFailed"));
    }
  }

  async function onWithdraw(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/payments/withdraw", {
        rail: withdrawRail,
        amountMinor: Math.round(Number(withdrawAmount) * 100),
        currency: withdrawCurrency,
        destination: withdrawDestination,
      });
      setInfo(t("wallet.withdrawalRequested"));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("wallet.withdrawalFailed"));
    }
  }

  return (
    <div className="wallet-page">
      <PromoFirstDeposit />
      <PageHeader
        kicker="DROPZONE / WALLET"
        title={t("wallet.title")}
        lede={t("wallet.lede", { defaultValue: "Пополнение, вывод и полная история операций по счёту." })}
        aside={<Readout label={t("wallet.balance", { defaultValue: "Баланс" })} value={wallet ? formatMinor(wallet.balanceMinor) : "…"} />}
      />

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      {!paymentsEnabled ? (
        <p className="hint">{t("wallet.paymentsUnavailable")}</p>
      ) : (
      <div className="wallet-forms">
        <form onSubmit={onDeposit} className="auth-form">
          <h3>{t("wallet.deposit")}</h3>
          <label>
            {t("wallet.method")}
            <select value={depositRail} onChange={(e) => setDepositRail(e.target.value as PaymentRail)}>
              <option value="CARD">{t("wallet.card")}</option>
              <option value="CRYPTO">{t("wallet.crypto")}</option>
              <option value="STEAM_SKIN">{t("wallet.steamSkin")}</option>
            </select>
          </label>
          <label>
            {t("wallet.amount")}
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          </label>
          <label>
            {t("wallet.currency")}
            <input value={depositCurrency} readOnly aria-readonly="true" />
          </label>
          <button type="submit">{t("wallet.depositButton")}</button>
        </form>

        <form onSubmit={onWithdraw} className="auth-form">
          <h3>{t("wallet.withdraw")}</h3>
          <p className="hint">{t("wallet.kycHint")}</p>
          <label>
            {t("wallet.method")}
            <select value={withdrawRail} onChange={(e) => setWithdrawRail(e.target.value as PaymentRail)}>
              <option value="CARD">{t("wallet.cardBank")}</option>
              <option value="CRYPTO">{t("wallet.crypto")}</option>
              <option value="STEAM_SKIN">{t("wallet.steamSkin")}</option>
            </select>
          </label>
          <label>
            {t("wallet.amount")}
            <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          </label>
          <label>
            {t("wallet.currency")}
            <input value={withdrawCurrency} readOnly aria-readonly="true" />
          </label>
          <label>
            {t("wallet.destination")}
            <input
              value={withdrawDestination}
              onChange={(e) => setWithdrawDestination(e.target.value)}
              required
            />
          </label>
          <button type="submit">{t("wallet.withdrawButton")}</button>
        </form>
      </div>
      )}

      <h3>{t("wallet.recentActivity")}</h3>
      <div className="dz-table-scroll">
        <table className="dz-table">
          <thead>
            <tr>
              <th>{t("wallet.date")}</th>
              <th>{t("wallet.reason")}</th>
              <th>{t("wallet.amountCol")}</th>
              <th>{t("wallet.balanceAfter")}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{t(`ledgerReason.${entry.reason}`, { defaultValue: entry.reason.replace(/_/g, " ") })}</td>
                <td className={Number(entry.amountMinor) < 0 ? "dz-amount-neg" : "dz-amount-pos"}>
                  {formatMinor(entry.amountMinor)}
                </td>
                <td>{formatMinor(entry.balanceAfterMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
