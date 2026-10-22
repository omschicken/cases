import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import { EditorialLayout } from "./components/editorial/EditorialShell";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";

import { CaseListPage } from "./pages/CaseList";

const LoginPage = lazy(() => import("./pages/Login").then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("./pages/Register").then(module => ({ default: module.RegisterPage })));
const OriginalCaseDetailPage = lazy(() => import("./pages/OriginalCaseDetail").then(module => ({ default: module.OriginalCaseDetailPage })));
const CaseDetailPage = lazy(() => import("./pages/CaseDetail").then(module => ({ default: module.CaseDetailPage })));
const VerifyPage = lazy(() => import("./pages/Verify").then(module => ({ default: module.VerifyPage })));
const InventoryPage = lazy(() => import("./pages/Inventory").then(module => ({ default: module.InventoryPage })));
const HistoryPage = lazy(() => import("./pages/History").then(module => ({ default: module.HistoryPage })));
const WalletPage = lazy(() => import("./pages/Wallet").then(module => ({ default: module.WalletPage })));
const ProfilePage = lazy(() => import("./pages/Profile").then(module => ({ default: module.ProfilePage })));
const ReferralPage = lazy(() => import("./pages/Referral").then(module => ({ default: module.ReferralPage })));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboard").then(module => ({ default: module.AdminDashboardPage })));
const BattlesPage = lazy(() => import("./pages/Battles").then(module => ({ default: module.BattlesPage })));
const UpgraderPage = lazy(() => import("./pages/Upgrader").then(module => ({ default: module.UpgraderPage })));
const ContractsPage = lazy(() => import("./pages/Contracts").then(module => ({ default: module.ContractsPage })));
const CardsPage = lazy(() => import("./pages/Cards").then(module => ({ default: module.CardsPage })));
const PrizesPage = lazy(() => import("./pages/Prizes").then(module => ({ default: module.PrizesPage })));
const BonusesPage = lazy(() => import("./pages/Bonuses").then(module => ({ default: module.BonusesPage })));
const FAQPage = lazy(() => import("./pages/FAQ").then(module => ({ default: module.FAQPage })));
const FairPage = lazy(() => import("./pages/Fair").then(module => ({ default: module.FairPage })));
const LeaderboardPage = lazy(() => import("./pages/Leaderboard").then(module => ({ default: module.LeaderboardPage })));
const NotFoundPage = lazy(() => import("./pages/NotFound").then(module => ({ default: module.NotFoundPage })));
const SteamCallbackPage = lazy(() => import("./pages/SteamCallback").then(module => ({ default: module.SteamCallbackPage })));
const SteamCompletePage = lazy(() => import("./pages/SteamComplete").then(module => ({ default: module.SteamCompletePage })));
const Layout = lazy(() => import("./components/Layout").then(module => ({ default: module.Layout })));

const DesignLabPage = import.meta.env.DEV
  ? lazy(() => import("./pages/DesignLab").then((module) => ({ default: module.DesignLabPage })))
  : null;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<EditorialLayout />}>
            <Route path="/" element={<CaseListPage />} />
            <Route path="/cases/:slug" element={<CaseDetailPage />} />
            <Route path="/collections/:slug" element={<OriginalCaseDetailPage />} />
            {DesignLabPage && (
              <Route
                path="/design-lab"
                element={<Suspense fallback={null}><DesignLabPage /></Suspense>}
              />
            )}

            <Route path="/battles" element={<BattlesPage />} />
            <Route path="/upgrader" element={<UpgraderPage />} />
            <Route path="/upgrade" element={<Navigate to="/upgrader" replace />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/inventory" element={<InventoryPage />} />
            </Route>
          <Route element={<Layout />}>
            <Route path="/verify/:openEventId" element={<VerifyPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/steam/callback" element={<SteamCallbackPage />} />
            <Route path="/auth/steam/complete" element={<SteamCompletePage />} />

            <Route path="/cards" element={<CardsPage />} />
            <Route path="/prizes" element={<PrizesPage />} />
            <Route path="/bonuses" element={<BonusesPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/fair" element={<FairPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<NotFoundPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/referral" element={<ReferralPage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin/*" element={<AdminDashboardPage />} />
            </Route>
          </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
