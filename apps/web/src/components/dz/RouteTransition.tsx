import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Entrance transition between routes.
 *
 * Entrance only, deliberately. An exit animation means keeping the outgoing
 * tree mounted while it plays, which delays the page the user asked for — the
 * brief's "don't make every screen slow for the sake of a transition".
 *
 * The first paint is never animated: starting the initial render at opacity 0
 * would push LCP out by the animation's duration for a flourish nobody asked
 * for. Only navigations animate.
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  const location = useLocation();
  // The previous path, not a "have I rendered yet" flag. StrictMode invokes
  // effects twice on purpose, and a flag flipped inside the effect is not
  // idempotent under that — the second invocation saw it already cleared and
  // animated the very first paint, which is the LCP cost this exists to
  // avoid. Comparing paths gives the same answer however many times it runs.
  const previousPath = useRef(location.pathname);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (location.pathname === previousPath.current) return;
    previousPath.current = location.pathname;
    setAnimate(true);

    // A hash target is an in-page jump the user aimed at, so leave the scroll
    // alone; a plain path change should start at the top of the new page.
    if (!location.hash) window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return (
    <div
      // Keyed so each navigation restarts the animation rather than reusing a
      // finished one.
      key={animate ? location.pathname : "initial"}
      className={animate ? "dz-route dz-route--enter" : "dz-route"}
    >
      {children}
    </div>
  );
}
