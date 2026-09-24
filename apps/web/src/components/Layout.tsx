import { NavLink, Outlet, useLocation } from "react-router-dom";
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

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <path d="M3 5.5 L17 5.5 M3 10 L17 10 M3 14.5 L17 14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      <DropsTicker />
      <header className="top-nav">
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <MenuIcon />
        </button>
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
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
        <Sidebar open={menuOpen} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      <footer className="site-footer">{t("nav.footer")}</footer>
    </div>
  );
}
