import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api";
import { formatMinor } from "../../lib/money";

interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  kycStatus: string;
  createdAt: string;
  wallet: { balanceMinor: string; currency: string } | null;
}

export function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [target, setTarget] = useState<AdminUserRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.get<AdminUserRow[]>("/admin/users").then(setUsers).catch(() => undefined);
  }, []);

  async function submit() {
    if (!target) return;
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value === 0) {
      setMessage({ text: "Введи сумму, не ноль (минус — списать)", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.post<{ balanceMinor: string; currency: string }>(`/admin/users/${target.id}/balance`, {
        amount: value,
        note: note.trim() || undefined,
      });
      setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, wallet: res } : u)));
      setMessage({ text: `Готово. Новый баланс ${target.email}: ${formatMinor(res.balanceMinor, res.currency)}`, ok: true });
      setAmount("");
      setNote("");
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : "Не удалось изменить баланс", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>{t("admin.users.heading")}</h2>

      {target && (
        <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <strong>{target.email}</strong>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Сумма, ₽ (минус — списать)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input type="text" placeholder="Комментарий (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={submit} disabled={busy}>
            {busy ? "…" : "Применить"}
          </button>
          <button onClick={() => setTarget(null)} disabled={busy}>
            Закрыть
          </button>
        </div>
      )}
      {message && <p className={message.ok ? "hint" : "form-error"}>{message.text}</p>}

      <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.users.email")}</th>
            <th>{t("admin.users.role")}</th>
            <th>{t("admin.users.kyc")}</th>
            <th>{t("admin.users.balance")}</th>
            <th>{t("admin.users.joined")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.kycStatus}</td>
              <td>{u.wallet ? formatMinor(u.wallet.balanceMinor, u.wallet.currency) : "-"}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                <button
                  onClick={() => {
                    setTarget(u);
                    setMessage(null);
                  }}
                  disabled={!u.wallet}
                >
                  Баланс
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
