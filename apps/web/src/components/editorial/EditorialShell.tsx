import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { api, API_URL } from "../../lib/api";
import type { WalletDto } from "../../lib/types";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { Money } from "../Money";
import { IconExternalLink, IconGift, IconInventory, IconProfile, IconSearch, IconWallet, mainNavItems } from "../navIcons";
import { CaseCrowLogo } from "../CaseCrowLogo";
import { BottomNav } from "../BottomNav";
import { ThemeSwitcher } from "../ThemeSwitcher";
import "../../styles/design-lab.css";
import "../../styles/editorial-sections.css";
import "../../styles/casecrow-dark.css";
import "../../styles/casecrow-polish.css";
import "../../styles/casecrow-critical-ui.css";
import "../../styles/casecrow-visual-audit.css";

const topNav = mainNavItems.slice(0, 4);
const sidebarNav = [
  ...mainNavItems.slice(0, 4),
  { to: "/inventory", key: "inventory" as const, icon: IconInventory, end: false },
  ...mainNavItems.slice(4),
];

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
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [localSearch, setLocalSearch] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  const query = searchValue ?? localSearch;

  useEffect(() => {
    if (!user) return setBalanceMinor(null);
    let active = true;
    let revision = 0;
    const refresh = () => {
      const current = ++revision;
      api.get<WalletDto>("/wallet/me").then((wallet) => {
        if (active && current === revision) setBalanceMinor(wallet.balanceMinor);
      }).catch(() => { if (active && current === revision) setBalanceMinor(null); });
    };
    refresh();
    let lastForegroundRefresh = Date.now();
    const onFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - lastForegroundRefresh > 5_000) {
        lastForegroundRefresh = Date.now();
        refresh();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "casecrow:wallet-revision") refresh();
    };
    window.addEventListener("casecrow:wallet-updated", refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      window.removeEventListener("casecrow:wallet-updated", refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user?.id]);

  useEffect(() => setProfileOpen(false), [location.pathname]);
  useEffect(() => { setLocalSearch(new URLSearchParams(location.search).get("q") ?? ""); }, [location.search]);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileMenuRef.current?.querySelector<HTMLButtonElement>(".fidelity-profile")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  const updateSearch = (value: string) => {
    onSearchChange?.(value);
    if (searchValue === undefined) setLocalSearch(value);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (onSearchChange) return;
    const value = query.trim();
    navigate(value ? `/?q=${encodeURIComponent(value)}#catalog` : "/#catalog");
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
          <IconSearch />
          <input type="search" value={query} onChange={(event) => updateSearch(event.target.value)} placeholder={t("home.searchPlaceholder")} aria-label={t("home.searchCases")} />
        </form>
        {user ? (
          <>
            <NavLink className="fidelity-wallet" to="/wallet"><IconWallet />{balanceMinor === null ? "—" : <Money minor={balanceMinor} />}</NavLink>
            <NavLink className="fidelity-plus" to="/wallet" aria-label={t("wallet.topUp", { defaultValue: "Пополнить баланс" })}>+</NavLink>
            <div ref={profileMenuRef} className={`fidelity-user${profileOpen ? " is-open" : ""}`}>
              <button className="fidelity-profile" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu" aria-label={t("nav.profile")}>
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
            <NavLink className="fidelity-profile" to="/login" aria-label={t("nav.profile")}><IconProfile /></NavLink>
          </>
        )}
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function EditorialSidebar({ activeSection, sections }: { activeSection?: "cases"; sections?: boolean }) {
  const { t } = useTranslation();
  return <aside className="fidelity-rail">
    <nav aria-label={t("nav.sections", { defaultValue: "Разделы" })}>
      {sidebarNav.map(({ to, key, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive || (activeSection === "cases" && key === "cases") ? "active" : undefined}>
          <Icon /><span>{t(`nav.sidebar.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
    <NavLink className="fidelity-reward" to="/bonuses"><IconGift /><b>{t("nav.dailyRewards", { defaultValue: "Ежедневные награды" })}</b><IconExternalLink size={14} /></NavLink>
    {sections && <div className="edv2-side-brand"><CaseCrowLogo /><span>PREMIUM CASE OPENING<br />EVERY SKIN. A NEW STORY.</span></div>}
  </aside>;
}

type EditorialAppShellProps = { children: ReactNode; activeSection?: "cases"; sections?: boolean };

export function EditorialAppShell({ children, activeSection, sections }: EditorialAppShellProps) {
  return <div className={`fidelity-page editorial-production${sections ? " editorial-sections" : ""}`}>
    {import.meta.env.VITE_CASECROW_AUDIT === "1" && <div className="cc-audit-banner" role="status">Тестовый preview · баланс и предметы вымышлены · без платежей и боевой базы <button type="button" onClick={() => { void import("../../lib/auditSandbox").then(module => module.resetAuditSandbox()); }}>Сбросить тестовые данные</button></div>}
    <EditorialHeader activeSection={activeSection} />
    <div className="fidelity-shell">
      <EditorialSidebar activeSection={activeSection} sections={sections} />
      <main className="fidelity-main">{children}</main>
    </div>
    <BottomNav />
  </div>;
}

export function EditorialLayout() {
  return <EditorialAppShell activeSection="cases"><Outlet /></EditorialAppShell>;
}

export function EditorialSectionsLayout() {
  return <EditorialAppShell sections><Outlet /></EditorialAppShell>;
}
