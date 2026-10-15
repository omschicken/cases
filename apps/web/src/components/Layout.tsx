import { NavLink, Outlet, useLocation } from "react-router-dom";
import { RouteTransition } from "./dz/RouteTransition";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, API_URL } from "../lib/api";
import { formatMinor } from "../lib/money";
import { initEffects } from "../lib/effects";
import type { WalletDto } from "../lib/types";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { DropsTicker } from "./DropsTicker";
import { PagesBar } from "./PagesBar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { OnboardingModal } from "./OnboardingModal";

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
  const [profileOpen, setProfileOpen] = useState(false);

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

  // Close drawers whenever the route changes.
  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [location.pathname]);

  // Global visual effects (3D tilt, cursor glow) — init once, cleaned up on unmount.
  useEffect(() => initEffects(), []);

  return (
    <div className="dz-shell">
      <DropsTicker />

      <header className="dz-topbar">
        <button
          className="dz-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Меню"
          aria-expanded={menuOpen}
        >
          <MenuIcon />
        </button>

        <NavLink to="/" className="dz-brand">
          <span className="dz-brand__sigil" aria-hidden="true">
            <span>D</span><i />
          </span>
          <span className="dz-brand__word">
            DROP<span className="dz-brand__suffix">ZONE</span>
          </span>
        </NavLink>

        <div className="dz-topbar__right">
          {user ? (
            <>
              {balanceMinor !== null && (
                <NavLink to="/wallet" className="dz-balance">
                  {formatMinor(balanceMinor)}
                </NavLink>
              )}
              <div className={`dz-account${profileOpen ? " dz-account--open" : ""}`}>
                <button
                  type="button"
                  className="dz-account__trigger"
                  aria-label={t("nav.profile")}
                  title={t("nav.profile")}
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  {user.steamAvatarUrl
                    ? <img src={user.steamAvatarUrl} alt="" />
                    : <span>{(user.displayName ?? user.email).slice(0, 1).toUpperCase()}</span>
                  }
                </button>
                {profileOpen && (
                  <>
                    <div className="dz-account__backdrop" onClick={() => setProfileOpen(false)} />
                    <div className="dz-account__panel">
                      <p className="dz-account__name">{user.displayName ?? user.email}</p>
                      <NavLink to="/profile">{t("nav.profile")}</NavLink>
                      <NavLink to="/inventory">{t("nav.sidebar.inventory")}</NavLink>
                      <NavLink to="/history">{t("nav.sidebar.history")}</NavLink>
                      <NavLink to="/wallet">{t("nav.pagesBar.wallet", { defaultValue: "Кошелёк" })}</NavLink>
                      <button type="button" onClick={logout}>{t("nav.logOut")}</button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <a href={`${API_URL}/auth/steam`} className="dz-steam-btn">
                {t("nav.logInSteam")}
              </a>
              <NavLink to="/login" className="dz-guest-btn" aria-label={t("nav.profile")} title={t("nav.profile")}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.4" />
                  <path d="M4.8 20c.5-4.3 3-6.4 7.2-6.4s6.7 2.1 7.2 6.4" />
                </svg>
              </NavLink>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      <PagesBar />

      <div className="dz-body">
        {menuOpen && <div className="dz-sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
        <Sidebar open={menuOpen} />
        <main className="dz-main">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </main>
      </div>

      <footer className="dz-footer">
        <div className="dz-footer__heading">
          <strong className="dz-footer__brand">DROP<span>ZONE</span></strong>
          <span className="dz-footer__age">18+</span>
        </div>
        <p>{t("nav.footer")}</p>
      </footer>

      <BottomNav />
      <OnboardingModal />
    </div>
  );
}
