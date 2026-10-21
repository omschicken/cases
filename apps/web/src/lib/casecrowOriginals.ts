/** Original artwork names and public asset paths. Kept separate from server-authoritative pricing and odds. */
export const CASECROW_ORIGINALS = [
  {
    "slug": "raven",
    "name": "Raven",
    "series": "originals",
    "accent": "#363536",
    "keywords": [
      "Night",
      "Black",
      "Slate",
      "Dark",
      "Raven"
    ],
    "order": 1,
    "imageUrl": "/casecrow-originals/raven.webp"
  },
  {
    "slug": "ancient",
    "name": "Ancient",
    "series": "originals",
    "accent": "#d0ae67",
    "keywords": [
      "Ancient",
      "Lore",
      "Medusa",
      "Apep",
      "King"
    ],
    "order": 2,
    "imageUrl": "/casecrow-originals/ancient.webp"
  },
  {
    "slug": "blackout",
    "name": "Blackout",
    "series": "originals",
    "accent": "#34373d",
    "keywords": [
      "Graphite",
      "Black",
      "Night",
      "Carbon",
      "Slate"
    ],
    "order": 3,
    "imageUrl": "/casecrow-originals/blackout.webp"
  },
  {
    "slug": "anubis",
    "name": "Anubis",
    "series": "originals",
    "accent": "#bb934c",
    "keywords": [
      "Anubis",
      "Apep",
      "Pharaoh",
      "Egypt",
      "Temple"
    ],
    "order": 4,
    "imageUrl": "/casecrow-originals/anubis.webp"
  },
  {
    "slug": "ice-vein",
    "name": "Ice Vein",
    "series": "originals",
    "accent": "#78b6ea",
    "keywords": [
      "Ice",
      "Cold",
      "Blue",
      "Water",
      "Frost"
    ],
    "order": 5,
    "imageUrl": "/casecrow-originals/ice-vein.webp"
  },
  {
    "slug": "dragon-fire",
    "name": "Dragon Fire",
    "series": "originals",
    "accent": "#f5682a",
    "keywords": [
      "Dragon",
      "Fire",
      "Blaze",
      "Flame",
      "Heat"
    ],
    "order": 6,
    "imageUrl": "/casecrow-originals/dragon-fire.webp"
  },
  {
    "slug": "eco-round",
    "name": "Eco Round",
    "series": "originals",
    "accent": "#7c885b",
    "keywords": [
      "Sand",
      "Forest",
      "Urban",
      "Army",
      "Groundwater"
    ],
    "order": 7,
    "imageUrl": "/casecrow-originals/eco-round.webp"
  },
  {
    "slug": "headshot",
    "name": "Headshot",
    "series": "originals",
    "accent": "#bd4749",
    "keywords": [
      "Head",
      "Redline",
      "Bullet",
      "Kill",
      "Blood"
    ],
    "order": 8,
    "imageUrl": "/casecrow-originals/headshot.webp"
  },
  {
    "slug": "fade",
    "name": "Fade",
    "series": "originals",
    "accent": "#a964d9",
    "keywords": [
      "Fade",
      "Spectrum",
      "Gradient",
      "Neo-Noir",
      "Marble"
    ],
    "order": 9,
    "imageUrl": "/casecrow-originals/fade.webp"
  },
  {
    "slug": "gold-rush",
    "name": "Gold Rush",
    "series": "originals",
    "accent": "#d8ac3e",
    "keywords": [
      "Gold",
      "Golden",
      "Tiger Tooth",
      "Amber",
      "Brass"
    ],
    "order": 10,
    "imageUrl": "/casecrow-originals/gold-rush.webp"
  },
  {
    "slug": "blood-money",
    "name": "Blood Money",
    "series": "originals",
    "accent": "#bb2435",
    "keywords": [
      "Blood",
      "Crimson",
      "Red",
      "Slaughter",
      "Scarlet"
    ],
    "order": 11,
    "imageUrl": "/casecrow-originals/blood-money.webp"
  },
  {
    "slug": "toxic",
    "name": "Toxic",
    "series": "originals",
    "accent": "#66a832",
    "keywords": [
      "Toxic",
      "Green",
      "Radiation",
      "Jungle",
      "Poison"
    ],
    "order": 12,
    "imageUrl": "/casecrow-originals/toxic.webp"
  },
  {
    "slug": "doppler",
    "name": "Doppler",
    "series": "originals",
    "accent": "#86b0d8",
    "keywords": [
      "Doppler",
      "Marble",
      "Phase",
      "Sapphire",
      "Ruby"
    ],
    "order": 13,
    "imageUrl": "/casecrow-originals/doppler.webp"
  },
  {
    "slug": "ruby-crystal",
    "name": "Ruby Crystal",
    "series": "crystals",
    "accent": "#df2950",
    "keywords": [
      "Ruby",
      "Crimson",
      "Red",
      "Blood",
      "Slaughter"
    ],
    "order": 14,
    "imageUrl": "/casecrow-originals/ruby-crystal.webp"
  },
  {
    "slug": "sapphire-crystal",
    "name": "Sapphire Crystal",
    "series": "crystals",
    "accent": "#2768db",
    "keywords": [
      "Sapphire",
      "Blue",
      "Doppler",
      "Bright Water",
      "Ice"
    ],
    "order": 15,
    "imageUrl": "/casecrow-originals/sapphire-crystal.webp"
  }
] as const;

export type CasecrowOriginalSlug = typeof CASECROW_ORIGINALS[number]["slug"];
export const CASECROW_ORIGINALS_BY_SLUG = new Map<string, typeof CASECROW_ORIGINALS[number]>(
  CASECROW_ORIGINALS.map((entry) => [entry.slug, entry]),
);
export const CASECROW_ART_COLLECTIONS = [
  { key: "originals", title: "Авторская коллекция", subtitle: "13 историй, 13 уникальных кейсов." },
  { key: "crystals", title: "Кристальная коллекция", subtitle: "Рубин и сапфир. Два особенных кейса." },
] as const;
