import { ComingSoon } from "../components/ComingSoon";

export function UpgraderPage() {
  return (
    <ComingSoon
      title="Upgrader"
      description="Risk an item (or your balance) for a chance at something rarer, with the odds shown up front. Coming soon."
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 14 L10 6 M6.5 9.5 L10 6 L13.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    />
  );
}
