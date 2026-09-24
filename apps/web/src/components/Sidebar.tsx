import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

function IconCases() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="7" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 7 L10 3 L17 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <line x1="10" y1="7" x2="10" y2="17" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
    </svg>
  );
}

function IconBattles() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <path d="M3 3 L11 11 M9 13 L3 19 M13 9 L11 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 3 L9 11 M11 13 L17 19 M7 9 L9 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconUpgrader() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 14 L10 6 M6.5 9.5 L10 6 L13.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconContracts() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="2.5" width="12" height="15" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 6.5 L13.5 6.5 M6.5 9.5 L13.5 9.5 M6.5 12.5 L11 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCards() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="5" width="9" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.5" transform="rotate(-8 7 11)" />
      <rect x="8.5" y="5" width="9" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.5" transform="rotate(8 13 11)" />
    </svg>
  );
}

function IconInventory() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5 L17 5.5 V10 C17 14 14 17 10 18 C6 17 3 14 3 10 V5.5 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const mainNavItems = [
  { to: "/", key: "cases", icon: IconCases, end: true },
  { to: "/battles", key: "battles", icon: IconBattles, end: false },
  { to: "/contracts", key: "contracts", icon: IconContracts, end: false },
  { to: "/upgrader", key: "upgrade", icon: IconUpgrader, end: false },
  { to: "/cards", key: "cards", icon: IconCards, end: false },
] as const;

interface SidebarProps {
  /** Only affects the mobile drawer — the sidebar is always visible on desktop. */
  open?: boolean;
}

export function Sidebar({ open = false }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <nav className="sidebar-nav">
        {mainNavItems.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="sidebar-link">
            <Icon />
            <span>{t(`nav.sidebar.${key}`)}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <>
          <div className="sidebar-divider" />
          <nav className="sidebar-nav">
            <NavLink to="/inventory" className="sidebar-link">
              <IconInventory />
              <span>{t("nav.sidebar.inventory")}</span>
            </NavLink>
            {user.role === "ADMIN" && (
              <NavLink to="/admin" className="sidebar-link">
                <IconAdmin />
                <span>{t("nav.sidebar.admin")}</span>
              </NavLink>
            )}
          </nav>
        </>
      )}
    </aside>
  );
}
