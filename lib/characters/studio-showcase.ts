export interface StudioShowcaseItem {
  id: string;
  title: string;
  subtitle: string;
  heroFanOrder?: number; // 0..4 for the 5-card fanned hero deck
  url: string;
  sha256: string;
}

export const STUDIO_SHOWCASE_ORIGIN =
  "https://storage.googleapis.com/ugcsaas-media/catalog/character-studio/showcase/v1/";

export const STUDIO_SHOWCASE_ITEMS: readonly StudioShowcaseItem[] = [
  {
    id: "showcase_male_textured_crop",
    title: "Textured Crop · Streetwear",
    subtitle: "Extreme · Studio Wall · Male 25",
    heroFanOrder: 1,
    sha256: "a4cb2e2e42ccb38d599d3d870b5932df32979c6a5dd003b9acbd91b87e61a7f6",
    url: `${STUDIO_SHOWCASE_ORIGIN}a4cb2e2e42ccb38d599d3d870b5932df32979c6a5dd003b9acbd91b87e61a7f6.jpg`,
  },
  {
    id: "showcase_female_natural_bob",
    title: "Natural Bob · Cream Room",
    subtitle: "Average · Latina · Female 24",
    heroFanOrder: 2, // Center hero card
    sha256: "c391eeb599184f38f308f50e0f5e31cd84efe227271518b89f9ca47affb5fcdb",
    url: `${STUDIO_SHOWCASE_ORIGIN}c391eeb599184f38f308f50e0f5e31cd84efe227271518b89f9ca47affb5fcdb.jpg`,
  },
  {
    id: "showcase_male_split_dye",
    title: "Split-Dye Curls · Streetwear",
    subtitle: "Extreme · Studio Wall · Male 25",
    heroFanOrder: 3,
    sha256: "457496842bec05dbfac8741a3e3bb3c296bcf3e8ff8bc269673695dab2fed42d",
    url: `${STUDIO_SHOWCASE_ORIGIN}457496842bec05dbfac8741a3e3bb3c296bcf3e8ff8bc269673695dab2fed42d.jpg`,
  },
  {
    id: "showcase_female_gasp_reaction",
    title: "Candid Gasp Reaction",
    subtitle: "Natural Bob · Cream Tee · Close-up",
    heroFanOrder: 0,
    sha256: "2c4821152f0cc9e8565bf3c147fdc99830f7de362486971ab4b4d56ee0618d34",
    url: `${STUDIO_SHOWCASE_ORIGIN}2c4821152f0cc9e8565bf3c147fdc99830f7de362486971ab4b4d56ee0618d34.jpg`,
  },
  {
    id: "showcase_female_expressive_talk",
    title: "Expressive Creator Hook",
    subtitle: "Natural Bob · Cream Room · Talking Head",
    heroFanOrder: 4,
    sha256: "0cd42061244a6ce6303de84bb645a14aff9cbc17e53987d694dd6317966eef79",
    url: `${STUDIO_SHOWCASE_ORIGIN}0cd42061244a6ce6303de84bb645a14aff9cbc17e53987d694dd6317966eef79.jpg`,
  },
  {
    id: "showcase_male_soda_shock",
    title: "Shocked Creator · Soda Can",
    subtitle: "Textured Crop · Dark Hoodie · Viral Hook",
    sha256: "c772cd5b756d50a8fa018e56daa1e43d22523d5ad218cfbdf2e2ddcdc5eac0c5",
    url: `${STUDIO_SHOWCASE_ORIGIN}c772cd5b756d50a8fa018e56daa1e43d22523d5ad218cfbdf2e2ddcdc5eac0c5.png`,
  },
  {
    id: "showcase_female_forehead_shock",
    title: "Surprised Creator · Warm Interior",
    subtitle: "Natural Bob · Cream Room · Viral Hook",
    sha256: "a64cf96e23b71250410c5a23f9a8f9fa42cac398ee96755d893e60f35aa39c0f",
    url: `${STUDIO_SHOWCASE_ORIGIN}a64cf96e23b71250410c5a23f9a8f9fa42cac398ee96755d893e60f35aa39c0f.png`,
  },
] as const;

export const STUDIO_HERO_FAN_CARDS: readonly StudioShowcaseItem[] = [
  ...STUDIO_SHOWCASE_ITEMS,
]
  .filter((item) => typeof item.heroFanOrder === "number")
  .sort((a, b) => (a.heroFanOrder ?? 0) - (b.heroFanOrder ?? 0));
