import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { mainNavItems } from "./navIcons";

/** Fixed thumb-reach tab bar for small screens — mirrors the sidebar's
 * primary destinations so mobile doesn't rely on the hamburger drawer for
 * the pages people actually jump between most. */
export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav">
      {mainNavItems.map(({ to, key, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav-link">
          <Icon />
          <span>{t(`nav.sidebar.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
