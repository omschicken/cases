import { ComingSoon } from "../components/ComingSoon";

export function BonusesPage() {
  return (
    <ComingSoon
      title="Bonuses"
      description="Deposit bonuses, free case drops, and daily rewards. Coming soon."
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <rect x="2.5" y="8" width="15" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 8 L17.5 8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 8 L10 17" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 8 C10 8 7 8 6 6.5 C5.3 5.5 6 4 7.2 4 C8.8 4 10 6 10 8 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M10 8 C10 8 13 8 14 6.5 C14.7 5.5 14 4 12.8 4 C11.2 4 10 6 10 8 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      }
    />
  );
}
