import { Outlet } from "react-router-dom";
import { RouteTransition } from "./dz/RouteTransition";
import "../styles/legacy-pages.css";

/**
 * Shared application layout for the existing game routes. The page content
 * remains untouched, while the public chrome is the same CaseCrow Editorial
 * shell used by the catalog and case detail routes.
 */
export function Layout() {
  return (
    <>
      <RouteTransition>
        <Outlet />
      </RouteTransition>
    </>
  );
}
