import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api";
import type { PriceSyncStatusDto } from "../../lib/types";

// While a sync is running, poll for progress every few seconds so the admin
// sees it move instead of wondering whether the button worked.
const POLL_MS = 4000;

export function AdminPrices() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PriceSyncStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  function load() {
    api
      .get<PriceSyncStatusDto>("/admin/prices/status")
      .then(setStatus)
      .catch(() => setError(t("admin.prices.couldNotLoad")));
  }

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (status?.running && !pollRef.current) {
      pollRef.current = window.setInterval(load, POLL_MS);
    } else if (!status?.running && pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.running]);

  async function trigger() {
    setError(null);
    try {
      const summary = await api.post<PriceSyncStatusDto["lastSummary"]>("/admin/prices/sync");
      setStatus({ running: true, lastSummary: summary });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.prices.couldNotTrigger"));
    }
  }

  const summary = status?.lastSummary;

  return (
    <div>
      <h2>{t("admin.prices.heading")}</h2>
      <p className="hint">{t("admin.prices.description")}</p>
      {error && <p className="form-error">{error}</p>}

      <button onClick={trigger} disabled={status?.running}>
        {status?.running ? t("admin.prices.running") : t("admin.prices.syncNow")}
      </button>

      {summary && (
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <tbody>
            <tr>
              <td>{t("admin.prices.started")}</td>
              <td>{new Date(summary.startedAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.finished")}</td>
              <td>{summary.finishedAt ? new Date(summary.finishedAt).toLocaleString() : t("admin.prices.inProgress")}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.total")}</td>
              <td>{summary.totalNames}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.updated")}</td>
              <td className="positive">
                {summary.updated} ({t("admin.prices.viaSkinport", { n: summary.bySource.skinport })},{" "}
                {t("admin.prices.viaSteam", { n: summary.bySource.steam })})
              </td>
            </tr>
            <tr>
              <td>{t("admin.prices.skipped")}</td>
              <td>{summary.skipped}</td>
            </tr>
            <tr>
              <td>{t("admin.prices.failed")}</td>
              <td className={summary.failed > 0 ? "negative" : undefined}>{summary.failed}</td>
            </tr>
          </tbody>
        </table>
      )}

      {!summary && !error && <p className="hint">{t("admin.prices.neverRun")}</p>}
    </div>
  );
}
