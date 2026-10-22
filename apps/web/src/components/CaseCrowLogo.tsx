import lockup from "../assets/casecrow-approved/brand/casecrow-lockup-transparent.png";
import graphiteMark from "../assets/casecrow-approved/brand/crow-mark-graphite.svg";
import whiteMark from "../assets/casecrow-approved/brand/crow-mark-white.svg";

type CaseCrowLogoProps = {
  compact?: boolean;
  className?: string;
};

/** Approved CaseCrow signature extracted from the supplied brand foundation. */
export function CaseCrowLogo({ compact = false, className }: CaseCrowLogoProps) {
  const classes = ["casecrow-logo", compact ? "casecrow-logo--compact" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {compact ? (
        <>
          <img className="casecrow-logo__mark casecrow-logo__mark--light" src={graphiteMark} alt="" />
          <img className="casecrow-logo__mark casecrow-logo__mark--dark" src={whiteMark} alt="" />
        </>
      ) : (
        <img className="casecrow-logo__lockup" src={lockup} alt="casecrow" />
      )}
    </span>
  );
}
