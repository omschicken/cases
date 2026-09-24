import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, API_URL } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { WalletDto } from "../lib/types";
import ak47 from "../assets/ak47.png";
import { Sidebar } from "./Sidebar";
import { DropsTicker } from "./DropsTicker";
import { PagesBar } from "./PagesBar";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBalanceMinor(null);
      return;
    }
    api
      .get<WalletDto>("/wallet/me")
      .then((w) => setBalanceMinor(w.balanceMinor))
      .catch(() => setBalanceMinor(null));
  }, [user]);

  return (
    <div className="app-shell">
      <DropsTicker />
      <header className="top-nav">
        <NavLink to="/" className="brand">
          <img src={ak47} alt="" className="brand-mark" aria-hidden="true" />
          <span className="brand-word">
            DONE<span className="brand-suffix">.CASE</span>
          </span>
        </NavLink>
        <div className="nav-right">
          {user && <NavLink to="/profile">{t("nav.profile")}</NavLink>}
          {user ? (
            <>
              {balanceMinor !== null && (
                <NavLink to="/wallet" className="balance-pill">
                  {formatMinor(balanceMinor)}
                </NavLink>
              )}
              <span className="user-email">{user.displayName ?? user.email}</span>
              <button onClick={logout}>{t("nav.logOut")}</button>
            </>
          ) : (
            <a href={`${API_URL}/auth/steam`} className="steam-login-button">
              {t("nav.logInSteam")}
            </a>
          )}
          <LanguageSwitcher />
        </div>
      </header>
      <PagesBar />
      <div className="body-row">
        <Sidebar />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      <footer className="site-footer">{t("nav.footer")}</footer>
    </div>
  );
}
