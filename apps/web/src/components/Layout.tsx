import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, API_URL } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { WalletDto } from "../lib/types";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
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
          aria-label="Меню"
          aria-expanded={menuOpen}
        >
          <MenuIcon />
        </button>
        <NavLink to="/" className="brand">
          <span className="brand-sigil" aria-hidden="true"><span>D</span><i /></span>
          <span className="brand-word">
            DROP<span className="brand-suffix">ZONE</span>
          </span>
        </NavLink>
        <div className="nav-right">
          {user ? (
            <>
              {balanceMinor !== null && (
                <NavLink to="/wallet" className="balance-pill">
                  {formatMinor(balanceMinor)}
                </NavLink>
              )}
              <details className="account-menu" key={location.pathname}>
                <summary aria-label={t("nav.profile")} title={t("nav.profile")}>
                  {user.steamAvatarUrl ? <img src={user.steamAvatarUrl} alt="" /> : <span>{(user.displayName ?? user.email).slice(0, 1).toUpperCase()}</span>}
                </summary>
                <div className="account-menu-panel">
                  <p className="account-menu-name">{user.displayName ?? user.email}</p>
                  <NavLink to="/profile">{t("nav.profile")}</NavLink>
                  <NavLink to="/inventory">{t("nav.sidebar.inventory")}</NavLink>
                  <NavLink to="/history">{t("nav.sidebar.history")}</NavLink>
                  <NavLink to="/wallet">{t("nav.pagesBar.wallet", { defaultValue: "Кошелёк" })}</NavLink>
                  <button type="button" onClick={logout}>{t("nav.logOut")}</button>
                </div>
              </details>
            </>
          ) : (
            <>
              <a href={`${API_URL}/auth/steam`} className="steam-login-button">
                {t("nav.logInSteam")}
              </a>
              <NavLink to="/login" className="account-guest" aria-label={t("nav.profile")} title={t("nav.profile")}>
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M4.8 20c.5-4.3 3-6.4 7.2-6.4s6.7 2.1 7.2 6.4"/></svg>
              </NavLink>
            </>
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
      <footer className="site-footer">
        <div className="site-footer-heading"><strong>DROP<span>ZONE</span></strong><span>18+</span></div>
        <p>{t("nav.footer")}</p>
      </footer>
      <BottomNav />
    </div>
  );
}
