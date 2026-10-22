import type { ItemRarity } from "./types";

// Authentic CS2 rarity colors — recognizable to anyone who's opened a case
// on Steam, which is exactly the audience here.
export const RARITY_COLORS: Record<ItemRarity, string> = {
  CONSUMER: "#b0c3d9",
  INDUSTRIAL: "#5e98d9",
  MIL_SPEC: "#4b69ff",
  RESTRICTED: "#8847ff",
  CLASSIFIED: "#d32ce6",
  COVERT: "#eb4b4b",
  GOLD: "#e4ae39",
};

export const RARITY_LABELS: Record<ItemRarity, string> = {
  CONSUMER: "Consumer",
  INDUSTRIAL: "Industrial",
  MIL_SPEC: "Mil-Spec",
  RESTRICTED: "Restricted",
  CLASSIFIED: "Classified",
  COVERT: "Covert",
  GOLD: "Gold",
};

export function rarityColor(rarity: ItemRarity): string {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.MIL_SPEC;
}

// Highest tier first — used to rank a case's contents at a glance and to
// decide which drops earn the big reveal treatment.
export const RARITY_RANK: ItemRarity[] = [
  "GOLD",
  "COVERT",
  "CLASSIFIED",
  "RESTRICTED",
  "MIL_SPEC",
  "INDUSTRIAL",
  "CONSUMER",
];

export function highestRarity(rarities: ItemRarity[]): ItemRarity | null {
  for (const tier of RARITY_RANK) {
    if (rarities.includes(tier)) return tier;
  }
  return null;
}

/** Top-tier drops (Classified and above) earn the big celebratory reveal. */
export function isChaseRarity(rarity: ItemRarity): boolean {
  return rarity === "CLASSIFIED" || rarity === "COVERT" || rarity === "GOLD";
}
