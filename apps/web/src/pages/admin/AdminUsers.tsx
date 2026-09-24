import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
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

  useEffect(() => {
    api.get<AdminUserRow[]>("/admin/users").then(setUsers).catch(() => undefined);
  }, []);

  return (
    <div>
      <h2>{t("admin.users.heading")}</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.users.email")}</th>
            <th>{t("admin.users.role")}</th>
            <th>{t("admin.users.kyc")}</th>
            <th>{t("admin.users.balance")}</th>
            <th>{t("admin.users.joined")}</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
