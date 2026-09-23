import { NavLink, Route, Routes } from "react-router-dom";
import { AdminKycQueue } from "./AdminKycQueue";
import { AdminWithdrawals } from "./AdminWithdrawals";
import { AdminCases } from "./AdminCases";
import { AdminUsers } from "./AdminUsers";

export function AdminDashboardPage() {
  return (
    <div className="admin-shell">
      <h1>Admin</h1>
      <nav className="admin-nav">
        <NavLink to="/admin/kyc" end>
          KYC queue
        </NavLink>
        <NavLink to="/admin/withdrawals" end>
          Withdrawals
        </NavLink>
        <NavLink to="/admin/cases" end>
          Cases
        </NavLink>
        <NavLink to="/admin/users" end>
          Users
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
