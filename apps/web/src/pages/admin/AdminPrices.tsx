import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api";
import type { CaseBalanceRowDto, PriceSyncStatusDto } from "../../lib/types";

// Prices refresh on their own every minute; this page only shows the state and
// lets an admin force a refresh. The status is re-read every few seconds.
const POLL_MS = 5000;

export function AdminPrices() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PriceSyncStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [balancing, setBalancing] = useState(false);
  const [balance, setBalance] = useState<CaseBalanceRowDto[] | null>(null);

  function load() {
    api
      .get<PriceSyncStatusDto>("/admin/prices/status")
      .then(setStatus)
      .catch(() => setError(t("admin.prices.couldNotLoad")));
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  async function trigger() {
    setError(null);
    setBusy(true);
    try {
      setStatus(await api.post<PriceSyncStatusDto>("/admin/prices/sync"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.prices.couldNotTrigger"));
    } finally {
      setBusy(false);
    }
  }

  async function rebalance(populate: boolean) {
    const question = populate
      ? "Добавить в кейсы предметы (до 24–28 штук) и пересчитать шансы под окупаемость 80%?"
      : "Пересчитать шансы выпадения и цены всех активных кейсов под окупаемость 80%?";
    if (!window.confirm(question)) return;
    setError(null);
    setBalancing(true);
    try {
      setBalance(await api.post<CaseBalanceRowDto[]>(populate ? "/admin/cases/populate" : "/admin/cases/rebalance"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось пересчитать кейсы");
    } finally {
      setBalancing(false);
    }
  }

  const money = (minor: string) => (Number(minor) / 100).toLocaleString();
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div>
      <h2>{t("admin.prices.heading")}</h2>
      <p className="hint">
        {t("admin.prices.description", {
          defaultValue: "Цены всего каталога Market.CSGO обновляются автоматически раз в минуту и сразу применяются во всех активных кейсах.",
        })}
      </p>
      {error && <p className="form-error">{error}</p>}

      <button onClick={trigger} disabled={busy}>
        {busy ? t("admin.prices.running") : t("admin.prices.syncNow", { defaultValue: "Обновить сейчас" })}
      </button>

      {status && (
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <tbody>
            <tr>
              <td>{t("admin.prices.lastUpdate", { defaultValue: "Последнее обновление" })}</td>
              <td>{fmt(status.lastFinishedAt)}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.duration", { defaultValue: "Длительность" })}</td>
              <td>{status.durationMs !== null ? `${(status.durationMs / 1000).toFixed(1)} с` : "—"}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.skins", { defaultValue: "Скинов в каталоге" })}</td>
              <td className="positive">{status.skinsListed}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.items", { defaultValue: "Всего предметов Market.CSGO" })}</td>
              <td>{status.itemsTotal}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.images", { defaultValue: "С картинками" })}</td>
              <td>{status.withImages}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.casesUpdated", { defaultValue: "Цен в кейсах изменено" })}</td>
              <td>{status.casesUpdated ?? "—"}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.failed")}</td>
              <td className={status.lastError ? "negative" : undefined}>{status.lastError ?? t("admin.prices.noErrors", { defaultValue: "нет" })}</td>
            </tr>
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: "2rem" }}>Окупаемость кейсов</h2>
      <p className="hint">
        Подбирает шансы выпадения (и, если нужно, цену кейса), чтобы средняя выплата была 80% от цены. Меняет шансы у всех
        активных кейсов, поэтому запускай осознанно после обновления цен.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={() => rebalance(true)} disabled={balancing}>
          {balancing ? "Работаю…" : "Наполнить кейсы и пересчитать (80%)"}
        </button>
        <button onClick={() => rebalance(false)} disabled={balancing}>
          Только пересчитать (80%)
        </button>
      </div>
      {balance && (
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Кейс</th>
              <th>Предметов</th>
              <th>Цена было</th>
              <th>Цена стало</th>
              <th>Окупаемость</th>
            </tr>
          </thead>
          <tbody>
            {balance.map((r) => (
              <tr key={r.slug}>
                <td>{r.slug}</td>
                <td>{r.itemCount}</td>
                <td>{money(r.oldPriceMinor)}</td>
                <td className={r.priceMinor !== r.oldPriceMinor ? "positive" : undefined}>{money(r.priceMinor)}</td>
                <td>{Math.round(r.rtp * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
