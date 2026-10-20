import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconInventory, mainNavItems } from "./navIcons";

/** 52px bottom bar for small screens — the same five destinations as the
 *  desktop rail, icon-only, with the label kept for assistive tech. */
export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {[...mainNavItems.slice(0, 4), { to: "/inventory", key: "inventory", icon: IconInventory, end: false }].map(({ to, key, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav-link" aria-label={t(`nav.sidebar.${key}`)}>
          <Icon />
          <span>{t(`nav.sidebar.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
