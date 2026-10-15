import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { mainNavItems, IconInventory, IconAdmin } from "./navIcons";

interface SidebarProps {
  /** Only affects the mobile drawer — the sidebar is always visible on desktop. */
  open?: boolean;
}

function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.49-6.01L3.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4.5v4h4M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({ open = false }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <aside className={`dz-sidebar${open ? " dz-sidebar--open" : ""}`}>
      <nav className="dz-sidebar__nav">
        {mainNavItems.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="dz-sidebar__link">
            <Icon />
            <span>{t(`nav.sidebar.${key}`)}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <>
          <div className="dz-sidebar__divider" />
          <nav className="dz-sidebar__nav">
            <NavLink to="/inventory" className="dz-sidebar__link">
              <IconInventory />
              <span>{t("nav.sidebar.inventory")}</span>
            </NavLink>
            <NavLink to="/history" className="dz-sidebar__link">
              <IconHistory />
              <span>{t("nav.sidebar.history")}</span>
            </NavLink>
            {user.role === "ADMIN" && (
              <NavLink to="/admin" className="dz-sidebar__link">
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
