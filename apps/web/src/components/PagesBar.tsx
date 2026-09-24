import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const PAGES = [
  { to: "/referral", key: "referral" },
  { to: "/prizes", key: "prizes" },
  { to: "/bonuses", key: "bonuses" },
  { to: "/faq", key: "faq" },
] as const;

/** Secondary nav bar for informational/account pages, shown below the header on every page. */
export function PagesBar() {
  const { t } = useTranslation();

  return (
    <nav className="pages-bar">
      {PAGES.map(({ to, key }) => (
        <NavLink key={to} to={to} className="pages-bar-link">
          {t(`nav.pagesBar.${key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
