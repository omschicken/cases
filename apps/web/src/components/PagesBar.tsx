import { NavLink } from "react-router-dom";

const PAGES = [
  { to: "/referral", label: "Referral" },
  { to: "/prizes", label: "Prizes" },
  { to: "/bonuses", label: "Bonuses" },
  { to: "/faq", label: "FAQ" },
];

/** Secondary nav bar for informational/account pages, shown below the header on every page. */
export function PagesBar() {
  return (
    <nav className="pages-bar">
      {PAGES.map(({ to, label }) => (
        <NavLink key={to} to={to} className="pages-bar-link">
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
