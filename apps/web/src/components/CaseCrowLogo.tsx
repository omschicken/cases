type CaseCrowLogoProps = {
  compact?: boolean;
  className?: string;
};

/** Public CaseCrow signature. CSS classes keep legacy names where required to
 * avoid coupling the visual migration to a risky internal rename. */
export function CaseCrowLogo({ compact = false, className }: CaseCrowLogoProps) {
  return (
    <span className={["casecrow-logo", compact ? "casecrow-logo--compact" : "", className ?? ""].filter(Boolean).join(" ")}>
      <svg className="casecrow-logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 8.5 15.8 4l10.7 4.5-5.1 4.1 4.2 11.2-9.8 4.2L6 23.8l4.3-11.2L5 8.5Z" fill="currentColor" />
        <path d="m10.3 12.6 5.5 3.7 5.6-3.7-1.9 8.1-3.7 2.1-3.6-2.1-1.9-8.1Z" fill="var(--casecrow-mark-cut, #f5f2ea)" />
        <circle cx="12.8" cy="11.2" r="1" fill="var(--casecrow-sage, #879184)" />
        <circle cx="18.9" cy="11.2" r="1" fill="var(--casecrow-sage, #879184)" />
      </svg>
      {!compact && <span className="casecrow-logo__word">casecrow</span>}
    </span>
  );
}
