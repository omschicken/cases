import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { RouteTransition } from "./dz/RouteTransition";
import { initEffects } from "../lib/effects";
import { OnboardingModal } from "./OnboardingModal";
import { EditorialAppShell } from "./editorial/EditorialShell";

/**
 * Shared application layout for the existing game routes. The page content
 * remains untouched, while the public chrome is the same CaseCrow Editorial
 * shell used by the catalog and case detail routes.
 */
export function Layout() {
  useEffect(() => initEffects(), []);

  return (
    <EditorialAppShell>
      <RouteTransition>
        <Outlet />
      </RouteTransition>
      <OnboardingModal />
    </EditorialAppShell>
  );
}
