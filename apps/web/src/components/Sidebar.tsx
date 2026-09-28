import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { mainNavItems, IconInventory, IconAdmin } from "./navIcons";

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
