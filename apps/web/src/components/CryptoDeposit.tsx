import { FormEvent, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";

const COINS = [
  { id: "usdttrc20", label: "USDT (TRC-20)", symbol: "₮", color: "#26a17b" },
  { id: "btc", label: "BTC", symbol: "₿", color: "#f7931a" },
  { id: "eth", label: "ETH", symbol: "Ξ", color: "#627eea" },
  { id: "ltc", label: "LTC", symbol: "Ł", color: "#a6a9aa" },
] as const;
type CoinId = (typeof COINS)[number]["id"];

const MIN_RUB = 100;
const POLL_MS = 10_000;

interface CreatedPayment {
  paymentId: string;
  payAddress: string;
  payAmount: string;
  payCurrency: string;
  expirationEstimate: string;
}
interface PaymentStatus {
  status: "pending" | "confirmed" | "failed";
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function CryptoDeposit({ onConfirmed }: { onConfirmed: () => void }) {
  const { t } = useTranslation();
  const [coin, setCoin] = useState<CoinId>("usdttrc20");
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<CreatedPayment | null>(null);
  const [status, setStatus] = useState<PaymentStatus["status"]>("pending");
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;

  // Poll the payment while it is pending; the server also re-checks with the
  // provider, so a missed webhook still resolves here.
  useEffect(() => {
    if (!payment || status !== "pending") return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await api.get<PaymentStatus>(`/payments/crypto/status/${payment.paymentId}`);
        if (stopped) return;
        setStatus(res.status);
        if (res.status === "confirmed") confirmedRef.current();
      } catch {
        /* transient — keep polling */
      }
    };
    const poll = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [payment, status]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amountRub = Number(amount.replace(",", "."));
    if (!Number.isFinite(amountRub) || amountRub < MIN_RUB) {
      setError(t("wallet.crypto.min", { defaultValue: "Минимальная сумма — 100 ₽" }));
      return;
    }
    setBusy(true);
    try {
      const created = await api.post<CreatedPayment>("/payments/crypto/create", { currency: coin, amountRub });
      setPayment(created);
      setStatus("pending");
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("wallet.depositFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the address is selectable */
    }
  }

  function reset() {
    setPayment(null);
    setStatus("pending");
    setError(null);
  }

  if (!payment) {
    return (
      <form onSubmit={onCreate} className="auth-form crypto-deposit">
        <h3>{t("wallet.deposit")} — {t("wallet.crypto.title", { defaultValue: "криптовалюта" })}</h3>
        <div className="crypto-coins" role="radiogroup" aria-label={t("wallet.method")}>
          {COINS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={coin === c.id}
              className={`crypto-coin${coin === c.id ? " crypto-coin--active" : ""}`}
              onClick={() => setCoin(c.id)}
            >
              <span className="crypto-coin__logo" style={{ background: c.color }} aria-hidden="true">{c.symbol}</span>
              {c.label}
            </button>
          ))}
        </div>
        <label>
          {t("wallet.crypto.amountRub", { defaultValue: "Сумма, ₽ (от 100)" })}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={busy}>
          {t("wallet.crypto.create", { defaultValue: "Создать платёж" })}
        </button>
      </form>
    );
  }

  const remaining = new Date(payment.expirationEstimate).getTime() - now;
  const expired = status === "pending" && remaining <= 0;
  const coinLabel = COINS.find((c) => c.id === payment.payCurrency)?.label ?? payment.payCurrency.toUpperCase();

  return (
    <div className="auth-form crypto-deposit crypto-pay">
      {status === "confirmed" ? (
        <>
          <h3>✅ {t("wallet.crypto.success", { defaultValue: "Платёж получен" })}</h3>
          <p className="form-info">{t("wallet.crypto.successText", { defaultValue: "Баланс пополнен." })}</p>
          <button type="button" onClick={reset}>{t("wallet.crypto.again", { defaultValue: "Ещё пополнение" })}</button>
        </>
      ) : status === "failed" || expired ? (
        <>
          <h3>❌ {t("wallet.crypto.failed", { defaultValue: "Платёж не завершён" })}</h3>
          <p className="hint">
            {t("wallet.crypto.failedText", { defaultValue: "Время ожидания истекло или платёж отклонён. Создайте новый." })}
          </p>
          <button type="button" onClick={reset}>{t("wallet.crypto.again", { defaultValue: "Создать новый платёж" })}</button>
        </>
      ) : (
        <>
          <h3>{t("wallet.crypto.pay", { defaultValue: "Отправьте оплату" })}</h3>
          <div className="crypto-pay__qr">
            <QRCodeSVG value={payment.payAddress} size={176} marginSize={2} />
          </div>
          <p>
            {t("wallet.crypto.sendExactly", { defaultValue: "Отправьте ровно" })}{" "}
            <strong><code>{payment.payAmount} {coinLabel}</code></strong>
          </p>
          <label>
            {t("wallet.crypto.address", { defaultValue: "Адрес" })}
            <input value={payment.payAddress} readOnly onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button type="button" onClick={() => copy(payment.payAddress)}>
            {copied ? t("wallet.crypto.copied", { defaultValue: "Скопировано ✓" }) : t("wallet.crypto.copy", { defaultValue: "Копировать адрес" })}
          </button>
          <p className="hint">
            ⏳ {t("wallet.crypto.expiresIn", { defaultValue: "Осталось" })} <strong>{formatRemaining(remaining)}</strong>
            {" · "}
            {t("wallet.crypto.waiting", { defaultValue: "ждём поступление, статус обновляется сам" })}
          </p>
        </>
      )}
    </div>
  );
}
