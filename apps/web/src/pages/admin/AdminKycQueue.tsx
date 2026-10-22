import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api";

interface PendingKyc {
  id: string;
  fullName: string;
  dateOfBirth: string;
  documentType: string;
  documentFrontUrl: string;
  selfieUrl: string;
  user: { id: string; email: string };
}

export function AdminKycQueue() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PendingKyc[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<PendingKyc[]>("/admin/kyc/pending")
      .then(setItems)
      .catch(() => setError(t("admin.kycQueue.couldNotLoad")));
  }

  useEffect(load, [t]);

  async function review(id: string, approve: boolean) {
    setError(null);
    try {
      const rejectionReason = approve
        ? undefined
        : window.prompt(t("admin.kycQueue.rejectionPrompt")) ?? t("admin.kycQueue.rejected");
      await api.post(`/admin/kyc/${id}/review`, { approve, rejectionReason });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.kycQueue.reviewFailed"));
    }
  }

  return (
    <div>
      <h2>{t("admin.kycQueue.heading")}</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.kycQueue.user")}</th>
            <th>{t("admin.kycQueue.fullName")}</th>
            <th>{t("admin.kycQueue.dob")}</th>
            <th>{t("admin.kycQueue.document")}</th>
            <th>{t("admin.kycQueue.selfie")}</th>
            <th>{t("admin.kycQueue.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((k) => (
            <tr key={k.id}>
              <td>{k.user.email}</td>
              <td>{k.fullName}</td>
              <td>{new Date(k.dateOfBirth).toLocaleDateString()}</td>
              <td>
                <a href={k.documentFrontUrl} target="_blank" rel="noreferrer">
                  {t("admin.kycQueue.view")}
                </a>
              </td>
              <td>
                <a href={k.selfieUrl} target="_blank" rel="noreferrer">
                  {t("admin.kycQueue.view")}
                </a>
              </td>
              <td>
                <button onClick={() => review(k.id, true)}>{t("admin.kycQueue.approve")}</button>
                <button onClick={() => review(k.id, false)}>{t("admin.kycQueue.reject")}</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6}>{t("admin.kycQueue.noneP")}</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
