import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface RouteTransitionProps {
  children: ReactNode;
}

/** Preserve the route tree and scroll position without delaying navigation. */
export function RouteTransition({ children }: RouteTransitionProps) {
  const location = useLocation();
  useEffect(() => {
    // A hash target is an in-page jump the user aimed at, so leave the scroll
    // alone; a plain path change should start at the top of the new page.
    if (!location.hash) window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return <div className="dz-route">{children}</div>;
}
