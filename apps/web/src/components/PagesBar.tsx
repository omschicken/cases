import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const PAGES = [
  { to: "/referral", key: "referral" },
  { to: "/prizes", key: "prizes" },
  { to: "/bonuses", key: "bonuses" },
  { to: "/fair", key: "fair" },
  { to: "/faq", key: "faq" },
] as const;

const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === "true";

/** Secondary nav bar for informational/account pages, shown below the header on every page. */
export function PagesBar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const pages = user && paymentsEnabled ? [{ to: "/wallet", key: "wallet" } as const, ...PAGES] : PAGES;

  return (
    <nav className="pages-bar" aria-label="Дополнительная навигация">
      {pages.map(({ to, key }) => (
        <NavLink key={to} to={to} className="pages-bar-link">
          {t(`nav.pagesBar.${key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
