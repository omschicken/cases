import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { CaseListPage } from "./pages/CaseList";
import { CaseDetailPage } from "./pages/CaseDetail";
import { VerifyPage } from "./pages/Verify";
import { InventoryPage } from "./pages/Inventory";
import { WalletPage } from "./pages/Wallet";
import { ProfilePage } from "./pages/Profile";
import { ReferralPage } from "./pages/Referral";
import { AdminDashboardPage } from "./pages/admin/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<CaseListPage />} />
            <Route path="/cases/:slug" element={<CaseDetailPage />} />
            <Route path="/verify/:openEventId" element={<VerifyPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/referral" element={<ReferralPage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin/*" element={<AdminDashboardPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
