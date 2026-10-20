import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { mainNavItems, IconInventory, IconAdmin, IconHistory, IconChevronLeft, IconChevronRight } from "./navIcons";

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
          {pinned ? <IconChevronLeft /> : <IconChevronRight />}
        </button>
      </div>
    </aside>
  );
}
