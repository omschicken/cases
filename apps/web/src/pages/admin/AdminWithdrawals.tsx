import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api";
import { formatMinor } from "../../lib/money";

interface PendingWithdrawal {
  id: string;
  rail: string;
  amountMinor: string;
  currency: string;
  destination: string;
  requestedAt: string;
  user: { id: string; email: string };
}

export function AdminWithdrawals() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PendingWithdrawal[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<PendingWithdrawal[]>("/admin/withdrawals/pending")
      .then(setItems)
      .catch(() => setError(t("admin.withdrawals.couldNotLoad")));
  }

  useEffect(load, [t]);

  async function review(id: string, approve: boolean) {
    setError(null);
    try {
      const rejectionReason = approve
        ? undefined
        : window.prompt(t("admin.withdrawals.rejectionPrompt")) ?? t("admin.withdrawals.rejected");
      await api.post(`/admin/withdrawals/${id}/review`, { approve, rejectionReason });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.withdrawals.reviewFailed"));
    }
  }

  return (
    <div>
      <h2>{t("admin.withdrawals.heading")}</h2>
      {error && <p className="form-error">{error}</p>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.withdrawals.user")}</th>
            <th>{t("admin.withdrawals.rail")}</th>
            <th>{t("admin.withdrawals.amount")}</th>
            <th>{t("admin.withdrawals.destination")}</th>
            <th>{t("admin.withdrawals.requested")}</th>
            <th>{t("admin.withdrawals.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id}>
              <td>{w.user.email}</td>
              <td>{w.rail}</td>
              <td>{formatMinor(w.amountMinor, w.currency)}</td>
              <td>{w.destination}</td>
              <td>{new Date(w.requestedAt).toLocaleString()}</td>
              <td>
                <button onClick={() => review(w.id, true)}>{t("admin.withdrawals.approvePay")}</button>
                <button onClick={() => review(w.id, false)}>{t("admin.withdrawals.reject")}</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6}>{t("admin.withdrawals.none")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
