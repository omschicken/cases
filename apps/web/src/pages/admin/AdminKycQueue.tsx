import { useEffect, useState } from "react";
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
  const [items, setItems] = useState<PendingKyc[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<PendingKyc[]>("/admin/kyc/pending")
      .then(setItems)
      .catch(() => setError("Could not load KYC queue"));
  }

  useEffect(load, []);

  async function review(id: string, approve: boolean) {
    setError(null);
    try {
      const rejectionReason = approve ? undefined : window.prompt("Rejection reason?") ?? "Rejected";
      await api.post(`/admin/kyc/${id}/review`, { approve, rejectionReason });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Review failed");
    }
  }

  return (
    <div>
      <h2>Pending identity verifications</h2>
      {error && <p className="form-error">{error}</p>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Full name</th>
            <th>DOB</th>
            <th>Document</th>
            <th>Selfie</th>
            <th>Actions</th>
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
                  view
                </a>
              </td>
              <td>
                <a href={k.selfieUrl} target="_blank" rel="noreferrer">
                  view
                </a>
              </td>
              <td>
                <button onClick={() => review(k.id, true)}>Approve</button>
                <button onClick={() => review(k.id, false)}>Reject</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6}>No pending submissions.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
