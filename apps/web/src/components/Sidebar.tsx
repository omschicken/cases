import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { mainNavItems, IconInventory, IconAdmin } from "./navIcons";

function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.49-6.01L3.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4.5v4h4M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 56px rail that opens to 200px on hover/focus, or stays open once pinned
 *  with a click. The rail itself keeps its 56px of layout space so opening
 *  overlays the page instead of shoving it sideways. */
export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pinned, setPinned] = useState(false);

  return (
    <aside className={`dz-sidebar${pinned ? " dz-sidebar--pinned" : ""}`}>
      <div className="dz-sidebar__inner">
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

        <button
          type="button"
          className="dz-sidebar__pin"
          aria-pressed={pinned}
          aria-label="Закрепить меню"
          onClick={() => setPinned((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={pinned ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
