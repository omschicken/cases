import { ComingSoon } from "../components/ComingSoon";

export function CardsPage() {
  return (
    <ComingSoon
      title="Cards"
      description="A fast-paced pick-a-card game with rarity-weighted prizes. Coming soon."
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <rect x="2.5" y="5" width="9" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4" transform="rotate(-8 7 11)" />
          <rect x="8.5" y="5" width="9" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4" transform="rotate(8 13 11)" />
        </svg>
      }
    />
  );
}
