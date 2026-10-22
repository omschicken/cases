import { Suspense, useEffect, useRef, useState } from "react";
import { LogIn, Menu, X } from "lucide-react";
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
import "../../styles/app-shell.css";

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
  menuOpen?: boolean;
  onToggleMenu?: () => void;
};

export function EditorialHeader({ searchValue, onSearchChange, activeSection, menuOpen, onToggleMenu }: HeaderProps) {
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
            {import.meta.env.VITE_CASECROW_READONLY_PREVIEW === "1" ? <span className="fidelity-steam" aria-disabled="true" title="Вход отключён в preview"><LogIn size={17} /><span>{t("nav.logInSteam")}</span></span> : <a className="fidelity-steam" href={`${API_URL}/auth/steam`} aria-label={t("nav.logInSteam")}><LogIn size={17} /><span>{t("nav.logInSteam")}</span></a>}
            <NavLink className="fidelity-profile" to="/login" aria-label={t("nav.profile")}><IconProfile /></NavLink>
          </>
        )}
        <ThemeSwitcher />
        <LanguageSwitcher />
        <button type="button" className="cc-menu-toggle" aria-label="Меню разделов" aria-controls="cc-sidebar" aria-expanded={menuOpen ?? false} onClick={onToggleMenu}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </header>
  );
}

export function EditorialSidebar({ activeSection, open, close }: { activeSection?: "cases"; open?: boolean; close?: () => void }) {
  const { t } = useTranslation();
  return <aside id="cc-sidebar" className={`fidelity-rail${open ? " is-open" : ""}`} onClick={(event) => { if ((event.target as Element).closest("a")) close?.(); }}>
    <nav aria-label={t("nav.sections", { defaultValue: "Разделы" })}>
      {sidebarNav.map(({ to, key, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive || (activeSection === "cases" && key === "cases") ? "active" : undefined}>
          <Icon /><span>{t(`nav.sidebar.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
    <NavLink className="fidelity-reward" to="/bonuses"><IconGift /><b>{t("nav.dailyRewards", { defaultValue: "Ежедневные награды" })}</b><IconExternalLink size={14} /></NavLink>
    <div className="edv2-side-brand"><CaseCrowLogo /><span>CASES · SKINS · COLLECT<br />КОЛЛЕКЦИИ С ХАРАКТЕРОМ</span></div>
  </aside>;
}

type EditorialAppShellProps = { children: ReactNode; activeSection?: "cases"; sections?: boolean };

export function EditorialAppShell({ children }: EditorialAppShellProps) {
  const location = useLocation();
  const activeSection = location.pathname === "/" || location.pathname.startsWith("/cases/") ? "cases" : undefined;
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" }); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  return <div className="fidelity-page editorial-production editorial-sections cc-app">
    {import.meta.env.VITE_CASECROW_AUDIT === "1" && <div className="cc-audit-banner" role="status">Тестовый preview · баланс и предметы вымышлены · без платежей и боевой базы <button type="button" onClick={() => { void import("../../lib/auditSandbox").then(module => module.resetAuditSandbox()); }}>Сбросить тестовые данные</button></div>}
    <EditorialHeader activeSection={activeSection} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(value => !value)} />
    {menuOpen && <button className="cc-nav-backdrop" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
    <div className="fidelity-shell">
      <EditorialSidebar activeSection={activeSection} open={menuOpen} close={() => setMenuOpen(false)} />
      <main className="fidelity-main"><Suspense fallback={<div className="cc-route-loading" role="status">Загружаем раздел…</div>}>{children}</Suspense></main>
    </div>
    <BottomNav />
    {import.meta.env.VITE_CASECROW_READONLY_PREVIEW === "1" && <span className="cc-preview-note">Preview · операции отключены</span>}
  </div>;
}

export function EditorialLayout() {
  return <EditorialAppShell><Outlet /></EditorialAppShell>;
}

export function EditorialSectionsLayout() {
  return <Outlet />;
}
