import { useEffect, useState } from "react";
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
  const [items, setItems] = useState<PendingWithdrawal[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<PendingWithdrawal[]>("/admin/withdrawals/pending")
      .then(setItems)
      .catch(() => setError("Could not load withdrawals"));
  }

  useEffect(load, []);

  async function review(id: string, approve: boolean) {
    setError(null);
    try {
      const rejectionReason = approve ? undefined : window.prompt("Rejection reason?") ?? "Rejected";
      await api.post(`/admin/withdrawals/${id}/review`, { approve, rejectionReason });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Review failed");
    }
  }

  return (
    <div>
      <h2>Pending withdrawals</h2>
      {error && <p className="form-error">{error}</p>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Rail</th>
            <th>Amount</th>
            <th>Destination</th>
            <th>Requested</th>
            <th>Actions</th>
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
                <button onClick={() => review(w.id, true)}>Approve &amp; pay</button>
                <button onClick={() => review(w.id, false)}>Reject</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6}>No pending withdrawals.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
