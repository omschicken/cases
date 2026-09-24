import { NavLink, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminKycQueue } from "./AdminKycQueue";
import { AdminWithdrawals } from "./AdminWithdrawals";
import { AdminCases } from "./AdminCases";
import { AdminUsers } from "./AdminUsers";

export function AdminDashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="admin-shell">
      <h1>{t("admin.title")}</h1>
      <nav className="admin-nav">
        <NavLink to="/admin/kyc" end>
          {t("admin.nav.kyc")}
        </NavLink>
        <NavLink to="/admin/withdrawals" end>
          {t("admin.nav.withdrawals")}
        </NavLink>
        <NavLink to="/admin/cases" end>
          {t("admin.nav.cases")}
        </NavLink>
        <NavLink to="/admin/users" end>
          {t("admin.nav.users")}
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<AdminKycQueue />} />
        <Route path="kyc" element={<AdminKycQueue />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="cases" element={<AdminCases />} />
        <Route path="users" element={<AdminUsers />} />
      </Routes>
    </div>
  );
}
