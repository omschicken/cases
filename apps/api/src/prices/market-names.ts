/**
 * Case items were seeded with short names ("AK-47 | Slate (FN)", "Karambit | Fade (FN)").
 * Market prices, images and delivery all need the exact market_hash_name, so this
 * maps a legacy name onto one that exists in the Market.CSGO catalog.
 */
const WEAR_SHORT: Record<string, string> = {
  FN: "Factory New",
  MW: "Minimal Wear",
  FT: "Field-Tested",
  WW: "Well-Worn",
  BS: "Battle-Scarred",
};
const WEAR_ORDER = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"];

/** Short knife name -> catalog name (without the ★ prefix). */
const KNIFE_NAMES: Record<string, string> = {
  Butterfly: "Butterfly Knife",
  Flip: "Flip Knife",
  Gut: "Gut Knife",
  Huntsman: "Huntsman Knife",
  Falchion: "Falchion Knife",
  Bowie: "Bowie Knife",
  Navaja: "Navaja Knife",
  Stiletto: "Stiletto Knife",
  Talon: "Talon Knife",
  Ursus: "Ursus Knife",
  Classic: "Classic Knife",
  Paracord: "Paracord Knife",
  Survival: "Survival Knife",
  Nomad: "Nomad Knife",
  Skeleton: "Skeleton Knife",
  Kukri: "Kukri Knife",
};

export function resolveMarketName(name: string, has: (candidate: string) => boolean): string | null {
  const m = /^(.*) \((FN|MW|FT|WW|BS|Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/.exec(name);
  if (!m) return has(name) ? name : null;
  const [, base, rawWear] = m;
  const wear = WEAR_SHORT[rawWear] ?? rawWear;

  const [weapon, ...rest] = base.split(" | ");
  const skin = rest.join(" | ");
  const weapons = [weapon];
  if (KNIFE_NAMES[weapon]) weapons.push(`★ ${KNIFE_NAMES[weapon]}`);
  weapons.push(`★ ${weapon}`);
  const bases = weapons.map((w) => (skin ? `${w} | ${skin}` : w));

  // Exact wear first, then the closest wear that is actually sold (a few skins
  // do not exist in every wear, e.g. Asiimov has no Factory New).
  const idx = WEAR_ORDER.indexOf(wear);
  const wears = [wear, ...WEAR_ORDER.filter((w) => w !== wear).sort((a, b) => Math.abs(WEAR_ORDER.indexOf(a) - idx) - Math.abs(WEAR_ORDER.indexOf(b) - idx))];
  for (const w of wears) {
    for (const b of bases) {
      const candidate = `${b} (${w})`;
      if (has(candidate)) return candidate;
    }
  }
  return null;
}
