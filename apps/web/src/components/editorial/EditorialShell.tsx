import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api, API_URL } from "../../lib/api";
import type { WalletDto } from "../../lib/types";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { Money } from "../Money";
import { mainNavItems } from "../navIcons";
import { CaseCrowLogo } from "../CaseCrowLogo";
import "../../styles/design-lab.css";

const topNav = mainNavItems.slice(0, 4);

type HeaderProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  activeSection?: "cases";
};

export function EditorialHeader({ searchValue, onSearchChange, activeSection }: HeaderProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const query = searchValue ?? localSearch;

  useEffect(() => {
    if (!user) return setBalanceMinor(null);
    api.get<WalletDto>("/wallet/me").then((wallet) => setBalanceMinor(wallet.balanceMinor)).catch(() => setBalanceMinor(null));
  }, [user]);

  useEffect(() => setProfileOpen(false), [location.pathname]);

  const updateSearch = (value: string) => {
    onSearchChange?.(value);
    if (searchValue === undefined) setLocalSearch(value);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (onSearchChange) return;
    const value = query.trim();
    navigate(value ? `/?q=${encodeURIComponent(value)}#collections` : "/#collections");
  };

  return (
    <header className="fidelity-header">
      <NavLink className="fidelity-logo" to="/" aria-label="CaseCrow"><CaseCrowLogo /></NavLink>
      <nav className="fidelity-topnav" aria-label={t("nav.main", { defaultValue: "Основная навигация" })}>
        {topNav.map(({ to, key, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive || (activeSection === "cases" && key === "cases") ? "active" : undefined}>
            {t(`nav.sidebar.${key}`)}
          </NavLink>
        ))}
        <NavLink to="/inventory">{t("nav.sidebar.inventory")}</NavLink>
        <NavLink to="/referral">{t("nav.sidebar.referral", { defaultValue: "Рефералы" })}</NavLink>
      </nav>
      <div className="fidelity-account">
        <form className="fidelity-search" role="search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => updateSearch(event.target.value)} placeholder={t("home.searchPlaceholder")} aria-label={t("home.searchCases")} />
        </form>
        {user ? (
          <>
            <NavLink className="fidelity-wallet" to="/wallet"><span aria-hidden="true">▤</span>{balanceMinor === null ? "—" : <Money minor={balanceMinor} />}</NavLink>
            <NavLink className="fidelity-plus" to="/wallet" aria-label={t("wallet.topUp", { defaultValue: "Пополнить баланс" })}>+</NavLink>
            <div className={`fidelity-user${profileOpen ? " is-open" : ""}`}>
              <button className="fidelity-profile" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-label={t("nav.profile")}>
                {user.steamAvatarUrl ? <img src={user.steamAvatarUrl} alt="" /> : (user.displayName ?? user.email).slice(0, 1).toUpperCase()}
              </button>
              {profileOpen && <div className="fidelity-user-menu">
                <strong>{user.displayName ?? user.email}</strong>
                <NavLink to="/profile">{t("nav.profile")}</NavLink>
                <NavLink to="/inventory">{t("nav.sidebar.inventory")}</NavLink>
                <NavLink to="/history">{t("nav.sidebar.history")}</NavLink>
                <button type="button" onClick={logout}>{t("nav.logOut")}</button>
              </div>}
            </div>
          </>
        ) : (
          <>
            <a className="fidelity-steam" href={`${API_URL}/auth/steam`}>{t("nav.logInSteam")}</a>
            <NavLink className="fidelity-profile" to="/login" aria-label={t("nav.profile")}><CaseCrowLogo compact /></NavLink>
          </>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function EditorialSidebar({ activeSection }: { activeSection?: "cases" }) {
  const { t } = useTranslation();
  return <aside className="fidelity-rail">
    <nav aria-label={t("nav.sections", { defaultValue: "Разделы" })}>
      {mainNavItems.map(({ to, key, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive || (activeSection === "cases" && key === "cases") ? "active" : undefined}>
          <Icon /><span>{t(`nav.sidebar.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
    <NavLink className="fidelity-reward" to="/bonuses"><span aria-hidden="true">♙</span><b>{t("nav.dailyRewards", { defaultValue: "Ежедневные награды" })}</b><i>↗</i></NavLink>
  </aside>;
}

export function EditorialLayout() {
  return <div className="fidelity-page editorial-production">
    <EditorialHeader activeSection="cases" />
    <div className="fidelity-shell">
      <EditorialSidebar activeSection="cases" />
      <main className="fidelity-main"><Outlet /></main>
    </div>
  </div>;
}
