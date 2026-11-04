export type TraitCategory =
  | "character_type"
  | "background"
  | "gender"
  | "ethnicity"
  | "age"
  | "skin_tone"
  | "head_shape"
  | "neck"
  | "eyes"
  | "eye_color"
  | "hair_style"
  | "hair_color"
  | "outfit"
  | "outfit_color"
  | "height"
  | "build"
  | "accessories";

export interface InfluencerTrait {
  id: string;
  label: string;
  category: TraitCategory;
  imagePath?: string;
  colorHex?: string;
  promptSnippet: string;
  negativePromptSnippet?: string;
  isDefault?: boolean;
  isCustomUpload?: boolean;
  group?: string;
}

export interface CategoryMeta {
  id: TraitCategory;
  title: string;
  iconName: string;
  multiSelect?: boolean;
}

export const CATEGORY_DEFINITIONS: readonly CategoryMeta[] = [
  { id: "character_type", title: "Character Type", iconName: "User" },
  { id: "background", title: "Background", iconName: "Image" },
  { id: "gender", title: "Gender", iconName: "User" },
  { id: "ethnicity", title: "Ethnicity", iconName: "Globe" },
  { id: "age", title: "Age", iconName: "Users" },
  { id: "skin_tone", title: "Skin Color", iconName: "Palette" },
  { id: "head_shape", title: "Head Shape", iconName: "Smile" },
  { id: "neck", title: "Neck", iconName: "UserCheck" },
  { id: "eyes", title: "Eye Shape", iconName: "Eye" },
  { id: "eye_color", title: "Eye Color", iconName: "Palette" },
  { id: "hair_style", title: "Hairstyle", iconName: "Scissors" },
  { id: "hair_color", title: "Hair Color", iconName: "Palette" },
  { id: "outfit", title: "Outfit", iconName: "Shirt" },
  { id: "outfit_color", title: "Outfit Color", iconName: "Palette" },
  { id: "height", title: "Height", iconName: "Ruler" },
  { id: "build", title: "Build", iconName: "Activity" },
  { id: "accessories", title: "Accessories", iconName: "Glasses", multiSelect: true },
] as const;

export const CHARACTER_TYPES: readonly InfluencerTrait[] = [
  {
    id: "char_average",
    label: "Average",
    category: "character_type",
    imagePath: "/explore/influencer-studio/characters/1.png",
    promptSnippet: "natural everyday facial proportions, balanced facial features, approachable realistic expression, subtle natural freckles",
    isDefault: true,
  },
  {
    id: "char_bold",
    label: "Bold",
    category: "character_type",
    imagePath: "/explore/influencer-studio/characters/2.png",
    promptSnippet: "bold editorial high-fashion facial features, prominent ears, sculpted full lips, high cheekbones, intense gaze",
  },
  {
    id: "char_extreme",
    label: "Extreme",
    category: "character_type",
    imagePath: "/explore/influencer-studio/characters/3.png",
    promptSnippet: "extreme expressive viral creator face, distinctive exaggerated masculine features, neatly groomed mustache, high-energy creator presence",
  },
];

export const LEGACY_CHARACTER_ALIASES: readonly InfluencerTrait[] = [
  { id: "char_playful_mustache", label: "Playful Mustache", category: "character_type", imagePath: "/explore/influencer-studio/characters/playful-mustache.png", promptSnippet: "playful expressive facial identity with large ears, rounded cheeks and a thick curled mustache. Use this image for facial identity only; apply the independently selected hairstyle, accessories, outfit and background." },
  // Retain lookup support for saved generations; omit from the live chooser.
  { id: "char_wide_eyed_mustache", label: "Wide-Eyed Mustache", category: "character_type", imagePath: "/explore/influencer-studio/characters/wide-eyed-mustache.png", promptSnippet: "distinctive expressive face with wide round eyes, prominent ears, long narrow nose and a curled mustache. Use this image for facial identity only; apply the independently selected hairstyle, accessories, outfit and background." },
  { ...CHARACTER_TYPES[0], id: "char_allura" },
  { ...CHARACTER_TYPES[1], id: "char_kora" },
  { ...CHARACTER_TYPES[2], id: "char_nico" },
];

export const SCRATCH_CHARACTER_FALLBACK: InfluencerTrait = {
  id: "char_scratch",
  label: "New Persona (From Scratch)",
  category: "character_type",
  promptSnippet: "unique authentic creator face synthesized from anatomical parameters, ultra-realistic believable human identity",
};

// Historical selections remain resolvable without offering these rooms again.
const LEGACY_BACKGROUNDS: readonly InfluencerTrait[] = [
  { id: "bg_car_interior", label: "Car Interior", category: "background", imagePath: "/explore/influencer-studio/backgrounds/car-interior.jpg", promptSnippet: "car cabin with cream seats, dark dashboard and side-window daylight; use the reference for the cabin and lighting only, omit readable branding. Use this photo for the environment only; keep the selected character and outfit." },
  { id: "bg_clean_studio", label: "Minimal Gray Room", category: "background", imagePath: "/explore/influencer-studio/backgrounds/clean-studio.jpg", promptSnippet: "minimal gray interior with neutral sofa, simple door and soft diffuse light. Use this photo for the environment only; keep the selected character and outfit." },
  { id: "bg_cozy_bedroom", label: "Loft Bedroom", category: "background", imagePath: "/explore/influencer-studio/backgrounds/cozy-bedroom.jpg", promptSnippet: "cozy loft bedroom with white bedding, tall multi-pane windows, exposed ceiling and natural daylight. Use this photo for the environment only; keep the selected character and outfit." },
  { id: "bg_cozy_living_room", label: "Warm Living Room", category: "background", imagePath: "/explore/influencer-studio/backgrounds/cozy-living-room.jpg", promptSnippet: "warm living room with tan leather sofa, plants, neutral framed wall art and soft window light. Use this photo for the environment only; keep the selected character and outfit." },
  { id: "bg_modern_kitchen", label: "Modern Kitchen", category: "background", imagePath: "/explore/influencer-studio/backgrounds/modern-kitchen.jpg", promptSnippet: "warm modern kitchen with dark cabinetry, island counter, bar stools and angled sunlight. Use this photo for the environment only; keep the selected character and outfit." },
  { id: "bg_office_desk", label: "Dark Home Office", category: "background", imagePath: "/explore/influencer-studio/backgrounds/office-desk.jpg", promptSnippet: "dark home office with wood desk, monitor, desk chair, potted plant and soft side-window daylight. Use this photo for the environment only; keep the selected character and outfit." },
];

export const BACKGROUNDS: readonly InfluencerTrait[] = [
  {
    id: "bg_modern_workspace",
    label: "Workspace",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/modern-workspace.png",
    promptSnippet: "authentic home office workspace environment, modern laptop open on white desk in foreground, ergonomic beige fabric office chair, warm ambient indoor lighting with visible doorway and espresso coffee station in soft focus background, candid tech creator setting",
    isDefault: true,
  },
  {
    id: "bg_cream_abstract",
    label: "Cream Room",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/cream-abstract-room.png",
    promptSnippet: "minimalist warm cream living interior, textured beige plaster wall with ambient backlit floating ledge, elegant minimalist abstract wall artwork, soft soothing warm architectural glow, serene domestic aesthetic",
  },
  {
    id: "bg_cozy_floral_bedroom",
    label: "Bedroom",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/cozy-floral-bedroom.png",
    promptSnippet: "authentic relatable creator bedroom setting, ergonomic desk chair back in foreground, cozy floral duvet bed with soft lavender accent pillow in background, gentle diffused daylight, candid everyday creator space",
  },
  {
    id: "bg_warm_wood_bedroom",
    label: "Wood Room",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/warm-wood-bedroom.png",
    promptSnippet: "warm inviting bedroom setting with rich dark wood fluted headboard, crisp white bedding with soft duvet, warm amber ambient lighting, cozy premium domestic atmosphere",
  },
  {
    id: "bg_minimalist_tv_bedroom",
    label: "Normal Wall",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/minimalist-tv-bedroom.png",
    promptSnippet: "clean modern minimalist interior, simple neutral warm-gray apartment wall, soft natural room daylight, clean residential setting",
  },
  {
    id: "bg_domestic_door_wall",
    label: "Entryway",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/domestic-door-wall.png",
    promptSnippet: "warm minimalist residential interior corner, clean cream wall with practical light switches, warm natural wood door frame on side, authentic lived-in home aesthetic",
  },
  {
    id: "bg_draped_curtain",
    label: "Curtains",
    category: "background",
    imagePath: "/explore/influencer-studio/backgrounds/draped-curtain-corner.png",
    promptSnippet: "cozy home room corner with elegant vertical pleated beige linen drapes hanging beside a warm wall, subtle fairy light accents, soft diffused window light, intimate creator room corner",
  },
];

export const GENDERS: readonly InfluencerTrait[] = [
  {
    id: "gender_female",
    label: "Female",
    category: "gender",
    promptSnippet: "photorealistic studio portrait of a young female influencer, feminine facial bone structure and proportions",
    isDefault: true,
  },
  {
    id: "gender_male",
    label: "Male",
    category: "gender",
    promptSnippet: "photorealistic studio portrait of a young male influencer, masculine jawline, strong brow ridge, fit male structure",
  },
];

export const ETHNICITIES: readonly InfluencerTrait[] = [
  {
    id: "ethnicity_african",
    label: "African",
    category: "ethnicity",
    imagePath: "/explore/influencer-studio/ethnicity/african.png",
    promptSnippet: "authentic African heritage, rich radiant deep brown skin with warm undertones, sculpted full lips, striking bone structure, high cheekbones, striking eyes",
  },
  {
    id: "ethnicity_east_asian",
    label: "East Asian",
    category: "ethnicity",
    imagePath: "/explore/influencer-studio/ethnicity/east-asian.png",
    promptSnippet: "authentic East Asian heritage, delicate facial bone structure, smooth porcelain-warm skin tone, soft defined jawline, sleek dark hair, refined contemporary beauty",
  },
  {
    id: "ethnicity_caucasian",
    label: "Caucasian",
    category: "ethnicity",
    imagePath: "/explore/influencer-studio/ethnicity/caucasian.png",
    promptSnippet: "authentic European Caucasian heritage, light natural skin undertones, soft cheekbone contour, natural facial symmetry, contemporary modern aesthetic",
  },
  {
    id: "ethnicity_indian",
    label: "Indian",
    category: "ethnicity",
    imagePath: "/explore/influencer-studio/ethnicity/indian.png",
    promptSnippet: "authentic South Asian heritage, distinctive Indian facial bone structure, warm golden-olive skin undertones, expressive gaze, naturally defined dark eyebrows, effortless modern creator styling",
  },
  {
    id: "ethnicity_middle_eastern",
    label: "Middle Eastern",
    category: "ethnicity",
    imagePath: "/explore/influencer-studio/ethnicity/middle-eastern.png",
    promptSnippet: "authentic Middle Eastern heritage, warm olive skin undertones, expressive gaze, prominent refined facial contour, natural dense eyebrows",
    isDefault: true,
  },
  {
    id: "ethnicity_latina",
    label: "Latina",
    category: "ethnicity",
    imagePath: "/explore/influencer-studio/ethnicity/latina.png",
    promptSnippet: "authentic Latin American heritage, warm caramel-bronze skin with healthy radiant glow, subtle sun-kissed freckles, expressive warm gaze, sculpted jawline",
  },
];

export const AGES: readonly InfluencerTrait[] = [
  {
    id: "age_genz",
    label: "Gen-Z (20)",
    category: "age",
    promptSnippet: "youthful 20-year-old Gen-Z creator, fresh luminous skin, energetic youthful gaze",
  },
  {
    id: "age_young_adult",
    label: "Adult (25)",
    category: "age",
    promptSnippet: "contemporary 25-year-old influencer, polished creator look, refined self-assured presence",
    isDefault: true,
  },
  {
    id: "age_mature",
    label: "Mature (35+)",
    category: "age",
    promptSnippet: "sophisticated 35-year-old influencer, mature confident beauty, subtle natural expression lines",
  },
];

export const SKIN_TONES: readonly InfluencerTrait[] = [
  {
    id: "skin_porcelain",
    label: "Fair Porcelain",
    category: "skin_tone",
    colorHex: "#F6E0D0",
    promptSnippet: "fair porcelain skin complexion, cool neutral undertones, authentic skin micro-texture with natural translucency",
  },
  {
    id: "skin_light_olive",
    label: "Light Olive",
    category: "skin_tone",
    colorHex: "#E5C8A8",
    promptSnippet: "light olive skin tone with soft neutral-warm undertones, healthy matte skin finish",
    isDefault: true,
  },
  {
    id: "skin_golden_tan",
    label: "Golden Tan",
    category: "skin_tone",
    colorHex: "#C69B7B",
    promptSnippet: "warm golden wheatish complexion, sun-kissed radiance, natural dermal skin pores",
  },
  {
    id: "skin_caramel",
    label: "Caramel Bronze",
    category: "skin_tone",
    colorHex: "#A26E4A",
    promptSnippet: "warm caramel bronze skin complexion with luminous undertones, natural non-reflective finish",
  },
  {
    id: "skin_deep_bronze",
    label: "Deep Bronze",
    category: "skin_tone",
    colorHex: "#7E5034",
    promptSnippet: "deep rich bronze skin complexion, warm undertones, authentic unretouched skin texture",
  },
  {
    id: "skin_espresso",
    label: "Deep Espresso",
    category: "skin_tone",
    colorHex: "#583927",
    promptSnippet: "rich deep espresso complexion, healthy skin glow, even melanin depth, fine facial pores",
  },
  {
    id: "skin_warm_sand",
    label: "Warm Sand",
    category: "skin_tone",
    colorHex: "#D7B596",
    promptSnippet: "warm sand complexion with balanced golden-peachy undertones, natural matte skin",
  },
  {
    id: "skin_rich_ebony",
    label: "Rich Ebony",
    category: "skin_tone",
    colorHex: "#392317",
    promptSnippet: "rich deep ebony skin with cool undertones, authentic natural skin texture, radiant healthy finish",
  },
];

export const HEAD_SHAPES: readonly InfluencerTrait[] = [
  {
    id: "head_keep_existing",
    label: "Keep head shape",
    category: "head_shape",
    promptSnippet: "Preserve the head shape from the selected character reference.",
    isDefault: true,
  },
  {
    id: "head_oval",
    label: "Classic Oval",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/classic-oval.png",
    promptSnippet: "classic symmetrical oval head shape, softly rounded balanced jawline, proportionate cheekbones",
  },
  {
    id: "head_diamond",
    label: "Diamond",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/diamond.png",
    promptSnippet: "sculpted diamond face shape, high angular cheekbones, narrow tapered jawline and pointed chin",
  },
  {
    id: "head_elongated",
    label: "Elongated Oblong",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/elongated-oblong.png",
    promptSnippet: "elongated oblong face shape, graceful vertical proportions, straight refined jawline",
  },
  {
    id: "head_square",
    label: "Strong Square",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/square.png",
    promptSnippet: "strong square face shape, crisp defined angular jawline, structured chin",
  },
  {
    id: "head_heart",
    label: "Heart",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/heart.png",
    promptSnippet: "heart-shaped face contour, delicate tapered chin, softly prominent cheekbones",
  },
  {
    id: "head_chiseled",
    label: "Chiseled Editorial",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/chiseled.png",
    promptSnippet: "high-fashion chiseled facial contour, hollowed cheekbones, razor-sharp jawline definition",
  },
  {
    id: "head_round",
    label: "Soft Round",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/round.png",
    promptSnippet: "soft rounded face shape, youthful gentle cheeks, softly curved jawline",
  },
  {
    id: "head_inverted_triangle",
    label: "Inverted Triangle",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/inverted-triangle.png",
    promptSnippet: "inverted triangle face shape, wider cheekbones tapering sharply to a delicate narrow chin",
  },
  {
    id: "head_avant_garde",
    label: "Avant-Garde Sharp",
    category: "head_shape",
    imagePath: "/explore/influencer-studio/head-shape/avant-garde.png",
    promptSnippet: "bold avant-garde editorial face contour, exaggerated angular facial architecture",
  },
  { id: "head_exaggerated_square", label: "Broad Square Jaw", category: "head_shape", imagePath: "/explore/influencer-studio/head-shape/broad-square-jaw.png", promptSnippet: "broad angular square jaw, wide chin and strong lower-face proportions. Use this photo for head shape only; preserve the selected character identity, eyes, hairstyle, skin tone and expression." },
  { id: "head_wide_eyed_mustache", label: "Long Narrow Face", category: "head_shape", imagePath: "/explore/influencer-studio/characters/wide-eyed-mustache.png", promptSnippet: "elongated narrow head silhouette with a tapered chin and prominent ears. Use this photo for head shape only; preserve the selected character identity, eye shape, hairstyle, facial hair, skin tone, accessories and expression." },
];

export const NECKS: readonly InfluencerTrait[] = [
  {
    id: "neck_standard",
    label: "Natural Athletic",
    category: "neck",
    imagePath: "/explore/influencer-studio/neck/natural-athletic.png",
    promptSnippet: "well-proportioned natural athletic neck, balanced trapezius line, relaxed confident posture",
    isDefault: true,
  },
  {
    id: "neck_editorial_swan",
    label: "Editorial Swan",
    category: "neck",
    imagePath: "/explore/influencer-studio/neck/editorial-swan.png",
    promptSnippet: "graceful elongated swan neck, refined upright posture, prominent delicate clavicle line",
  },
  {
    id: "neck_high_fashion_slender",
    label: "Slender High-Fashion",
    category: "neck",
    imagePath: "/explore/influencer-studio/neck/high-fashion-slender.png",
    promptSnippet: "high-fashion stylized slender neck, elevated chin posture, clean jaw-to-neck contour",
  },
  {
    id: "neck_defined_muscular",
    label: "Defined Muscular",
    category: "neck",
    imagePath: "/explore/influencer-studio/neck/defined-muscular.png",
    promptSnippet: "athletic muscular neck with defined sternocleidomastoid lines, powerful fit posture",
  },
];

export const EYE_SHAPES: readonly InfluencerTrait[] = [
  {
    id: "eye_almond",
    label: "Almond",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/almond.png",
    promptSnippet: "classic symmetrical almond-shaped eyes, subtle natural outer-corner lift, balanced eyelid crease",
    isDefault: true,
  },
  {
    id: "eye_round",
    label: "Round",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/round.png",
    promptSnippet: "large expressive round eyes, wide alert gaze, prominent iris exposure, dark lash line",
  },
  {
    id: "eye_hooded",
    label: "Hooded",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/hooded.png",
    promptSnippet: "subtle hooded eyelids, smoldering intense gaze, natural defined upper fold",
  },
  {
    id: "eye_upturned",
    label: "Upturned / Cat-Eye",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/upturned.png",
    promptSnippet: "striking upturned cat-eyes, winged outer corners, high-fashion confident gaze",
  },
  {
    id: "eye_downturned",
    label: "Downturned / Soft",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/downturned.png",
    promptSnippet: "soft downturned eyes, gentle emotive expression, softly curved lower eyelid",
  },
  {
    id: "eye_deep_set",
    label: "Deep-Set",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/deep-set.png",
    promptSnippet: "captivating deep-set eyes, subtle brow ridge shadow, piercing intense focus",
  },
  {
    id: "eye_soft_almond",
    label: "Soft Almond",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/soft-almond.png",
    promptSnippet: "soft almond eyes with relaxed natural eyelids and subtle gentle gaze",
  },
  {
    id: "eye_wide_doe",
    label: "Wide Doe Eyes",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/wide-doe.png",
    promptSnippet: "wide open doe-like eyes, radiant iris, youthful clarity and open expression",
  },
  {
    id: "eye_vibrant_open",
    label: "Vibrant Open",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/vibrant-open.png",
    promptSnippet: "bright alert eyes, glassy reflections with natural eye catchlights, engaged creator gaze",
  },
  {
    id: "eye_narrow_sharp",
    label: "Narrow Sharp",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/narrow-sharp.png",
    promptSnippet: "narrow sharp eyes, focused piercing gaze, sleek horizontal eyelid contour",
  },
  {
    id: "eye_relaxed",
    label: "Relaxed",
    category: "eyes",
    imagePath: "/explore/influencer-studio/eyes/relaxed.png",
    promptSnippet: "effortless relaxed eyes, calm self-assured expression, natural gaze",
  },
];

export const EYE_COLORS: readonly InfluencerTrait[] = [
  {
    id: "eye_color_brown",
    label: "Deep Espresso",
    category: "eye_color",
    colorHex: "#3B2219",
    promptSnippet: "deep rich espresso brown irises with realistic glassy depth and clear sclera",
    isDefault: true,
  },
  {
    id: "eye_color_hazel",
    label: "Warm Hazel",
    category: "eye_color",
    colorHex: "#8E6C3B",
    promptSnippet: "radiant warm hazel eyes with flecks of gold and green, luminous catchlights",
  },
  {
    id: "eye_color_green",
    label: "Emerald Green",
    category: "eye_color",
    colorHex: "#2E6F40",
    promptSnippet: "striking emerald green irises, vibrant realistic depth, dark limbal ring",
  },
  {
    id: "eye_color_blue",
    label: "Ice Blue",
    category: "eye_color",
    colorHex: "#4A90E2",
    promptSnippet: "piercing sky-blue eyes with intricate iris fiber patterns and dark outer limbal ring",
  },
  {
    id: "eye_color_amber",
    label: "Golden Amber",
    category: "eye_color",
    colorHex: "#B8860B",
    promptSnippet: "rare luminous honey-amber irises with warm golden undertones",
  },
  {
    id: "eye_color_grey",
    label: "Cool Slate Grey",
    category: "eye_color",
    colorHex: "#708090",
    promptSnippet: "captivating storm-grey irises with subtle steel-blue undertones",
  },
  {
    id: "eye_color_dark_choco",
    label: "Dark Chocolate",
    category: "eye_color",
    colorHex: "#231612",
    promptSnippet: "intense dark chocolate nearly black irises with glassy reflective surface",
  },
  {
    id: "eye_color_honey",
    label: "Honey Hazel",
    category: "eye_color",
    colorHex: "#9C7A45",
    promptSnippet: "warm honey-colored hazel irises with radiant golden flecks",
  },
];

export const HAIR_STYLES: readonly InfluencerTrait[] = [
  { id: "hair_keep_existing", label: "Keep hairstyle", category: "hair_style", promptSnippet: "Preserve the hairstyle from the selected character reference: length, texture, parting and volume. Hair color is independent.", isDefault: true },
  { id: "hair_bob", label: "Natural Bob", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/natural-bob.png", promptSnippet: "chin-length natural bob haircut with a soft center part and face-framing ends. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_blunt_bob", label: "Blunt Bob", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/blunt-bob.png", promptSnippet: "blunt one-length bob haircut with a sharp hemline. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_vintage_waves", label: "Vintage Waves", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/vintage-waves.png", promptSnippet: "sculpted vintage waves with lifted crown volume. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_long_waves", label: "Long Waves", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/long-waves.png", promptSnippet: "long loose waves falling past the shoulders. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_layered_waves", label: "Layered Waves", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/layered-waves.png", promptSnippet: "layered waves with lived-in movement. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_soft_curls", label: "Soft Curls", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/soft-curls.png", promptSnippet: "soft rounded curls close to the head. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_sculpted_curls", label: "Sculpted Curls", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/sculpted-curls.png", promptSnippet: "polished sculpted curls with a defined silhouette. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_voluminous_curls", label: "Voluminous Curls", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/voluminous-curls.png", promptSnippet: "full voluminous curls with a rounded outline. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_pin_curls", label: "Pin Curls", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/pin-curls.png", promptSnippet: "retro pin-curl set arranged close to the scalp. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_updo", label: "Updo", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/updo.png", promptSnippet: "hair pinned up off the neck. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_messy_updo", label: "Messy Updo", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/messy-updo.png", promptSnippet: "loose curly updo with a few pieces left down. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_space_buns", label: "Space Buns", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/space-buns.png", promptSnippet: "two high space buns. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_flat_top", label: "Flat Top", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/flat-top.png", promptSnippet: "flat-top haircut with short sides. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_textured_crop", label: "Textured Crop", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/textured-crop.png", promptSnippet: "short textured crop. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_tousled_shag", label: "Tousled Shag", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/tousled-shag.png", promptSnippet: "layered medium-length shag with tousled separated strands, wispy fringe and longer nape. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_spiky_high_top", label: "Spiky High Top", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/spiky-high-top.png", promptSnippet: "tall upright textured high-top hairstyle with spiky strands and closely tapered sides. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_tall_flat_top", label: "Tall Flat Top", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/tall-flat-top.png", promptSnippet: "tall squared flat-top haircut with a level top, defined corners and closely faded sides. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_curly_mullet", label: "Curly Mullet", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/curly-mullet.png", promptSnippet: "curly mullet with a rounded curly fringe, shorter sides and longer curls at the nape. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_wavy_bowl_cut", label: "Wavy Bowl Cut", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/wavy-bowl-cut.png", promptSnippet: "rounded bowl haircut with a short blunt fringe, wavy texture and outward-flipped sides. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_classic_flat_top", label: "Classic Flat Top", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/curls-afro.png", promptSnippet: "tall tightly textured flat-top haircut with a level squared top and short sides. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_rugged_crop", label: "Rugged Crop", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/rugged-crop.png", promptSnippet: "short rugged textured crop with uneven choppy strands and a slightly tousled top. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_short_fringe_bob", label: "Short Fringe Bob", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/sleek-pixie.png", promptSnippet: "sleek chin-length bob with a straight short fringe and rounded ends. Use this photo for the haircut only, and apply the selected hair color" },
  { id: "hair_braided_updo", label: "Braided Updo", category: "hair_style", imagePath: "/explore/influencer-studio/hair-style/wavy-textured.png", promptSnippet: "large rope-like braids gathered into a high coiled updo. Use this photo for the haircut only, and apply the selected hair color" },
];

export const HAIR_COLORS: readonly InfluencerTrait[] = [
  {
    id: "hair_color_keep_existing",
    label: "Keep hair color",
    category: "hair_color",
    promptSnippet: "Preserve the original hair color from the selected character reference, including multicolor sections. A haircut reference must not change its color.",
    isDefault: true,
  },
  {
    id: "hair_color_black",
    label: "Jet Black",
    category: "hair_color",
    colorHex: "#0B0B0B",
    promptSnippet: "glossy jet-black hair with natural sheen and deep rich dimensional shadows",
  },
  {
    id: "hair_color_espresso",
    label: "Dark Espresso",
    category: "hair_color",
    colorHex: "#2C1B18",
    promptSnippet: "rich dark espresso brown hair with subtle warm chestnut undertones",
  },
  {
    id: "hair_color_blonde",
    label: "Honey Blonde",
    category: "hair_color",
    colorHex: "#D4AF37",
    promptSnippet: "sun-kissed honey-blonde hair with natural multidimensional highlights",
  },
  {
    id: "hair_color_platinum",
    label: "Platinum Ash",
    category: "hair_color",
    colorHex: "#E5E4E2",
    promptSnippet: "modern platinum ash-blonde hair with cool silvery undertones and dark root shadow",
  },
  {
    id: "hair_color_auburn",
    label: "Copper Auburn",
    category: "hair_color",
    colorHex: "#922724",
    promptSnippet: "vibrant natural auburn red hair with warm copper highlights and soft sheen",
  },
  {
    id: "hair_color_pastel",
    label: "Pastel Rose",
    category: "hair_color",
    colorHex: "#DDA0DD",
    promptSnippet: "trendy soft pastel rose-tinted hair with smoky roots, viral creator aesthetic",
  },
  {
    id: "hair_color_silver",
    label: "Silver Slate",
    category: "hair_color",
    colorHex: "#A9A9A9",
    promptSnippet: "striking cool metallic silver-grey hair with natural glossy reflections",
  },
  {
    id: "hair_color_caramel",
    label: "Caramel Melt",
    category: "hair_color",
    colorHex: "#8B5A2B",
    promptSnippet: "warm brunette base with rich hand-painted caramel balayage ribbons",
  },
];

const outfitOnly = "Use this photo for the clothing cut only. Do not copy its face, hair, pose, or white background.";

export const OUTFITS: readonly InfluencerTrait[] = [
  { id: "outfit_none", label: "No outfit", category: "outfit", promptSnippet: "", isDefault: true },
  { id: "outfit_1950s_bowling_shirt", label: "Bowling Shirt", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-bowling-shirt.png", promptSnippet: `1950s bowling shirt. ${outfitOnly}` },
  { id: "outfit_1950s_leather_jacket", label: "Leather Jacket", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-leather-jacket.png", promptSnippet: `1950s leather jacket. ${outfitOnly}` },
  { id: "outfit_1950s_grey_suit", label: "Grey Suit", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-grey-suit.png", promptSnippet: `1950s tailored suit with hat and tie. ${outfitOnly}` },
  { id: "outfit_1950s_sweater_vest", label: "Sweater Vest", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-sweater-vest.png", promptSnippet: `1950s sweater vest. ${outfitOnly}` },
  { id: "outfit_1950s_cardigan_capris", label: "Cardigan & Capris", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-cardigan-capris.png", promptSnippet: `cream cardigan, red top, dark capri trousers and saddle shoes. ${outfitOnly}` },
  { id: "outfit_1950s_floral_swing_dress", label: "Floral Swing Dress", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-floral-swing-dress.png", promptSnippet: `blue floral fitted-waist swing dress. ${outfitOnly}` },
  { id: "outfit_1950s_pencil_skirt", label: "Pencil Skirt", category: "outfit", group: "1950s", imagePath: "/explore/influencer-studio/outfits/1950s-pencil-skirt.png", promptSnippet: `pink cardigan, cream blouse and gray pencil skirt. ${outfitOnly}` },
  { id: "outfit_1980s_vintage_denim", label: "Vintage Denim", category: "outfit", group: "1980s", imagePath: "/explore/influencer-studio/outfits/1980s-vintage-denim.png", promptSnippet: `1980s denim jacket and high-waisted acid-wash jeans. ${outfitOnly}` },
  { id: "outfit_1980s_colorblock_sweater", label: "Colorblock Sweater", category: "outfit", group: "1980s", imagePath: "/explore/influencer-studio/outfits/1980s-colorblock-sweater.png", promptSnippet: `bright colorblock sweater with purple high-waisted trousers. ${outfitOnly}` },
  { id: "outfit_1980s_denim_graphic_tee", label: "Denim & Graphic Tee", category: "outfit", group: "1980s", imagePath: "/explore/influencer-studio/outfits/1980s-denim-graphic-tee.png", promptSnippet: `denim jacket, colorful graphic tee and high-waisted jeans. ${outfitOnly}` },
  { id: "outfit_1980s_pink_blouse_skirt", label: "Pink Blouse & Skirt", category: "outfit", group: "1980s", imagePath: "/explore/influencer-studio/outfits/1980s-pink-blouse-skirt.png", promptSnippet: `bright pink blouse and dark floral full skirt. ${outfitOnly}` },
  { id: "outfit_1980s_retro_denim", label: "Retro Denim", category: "outfit", group: "1980s", imagePath: "/explore/influencer-studio/outfits/1980s-retro-denim.png", promptSnippet: `faded denim jacket, graphic tee and high-waisted jeans. ${outfitOnly}` },
  { id: "outfit_2000s_striped_tee", label: "Striped Tee", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-striped-tee.png", promptSnippet: `2000s striped tee. ${outfitOnly}` },
  { id: "outfit_2000s_layered_polo", label: "Layered Polo", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-layered-polo.png", promptSnippet: `striped burgundy polo over a white long-sleeve shirt with baggy jeans. ${outfitOnly}` },
  { id: "outfit_2000s_pink_cardigan", label: "Pink Cardigan", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-pink-cardigan.png", promptSnippet: `pink cardigan over a white crop top with low-rise flared jeans. ${outfitOnly}` },
  { id: "outfit_2000s_pink_tracksuit", label: "Pink Tracksuit", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-pink-tracksuit.png", promptSnippet: `pink zip-up tracksuit with matching flared trousers. ${outfitOnly}` },
  { id: "outfit_2000s_denim_mini_skirt", label: "Denim Mini Skirt", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-denim-mini-skirt.png", promptSnippet: `pink cardigan, white crop top, denim mini skirt and brown knee-high boots. ${outfitOnly}` },
  { id: "outfit_2000s_baggy_denim_shirt", label: "Baggy Denim & Shirt", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-baggy-denim-shirt.png", promptSnippet: `navy short-sleeve overshirt, white tee and very loose cargo jeans. ${outfitOnly}` },
  { id: "outfit_2000s_relaxed_striped_polo", label: "Relaxed Striped Polo", category: "outfit", group: "2000s", imagePath: "/explore/influencer-studio/outfits/2000s-relaxed-striped-polo.png", promptSnippet: `navy striped polo and loose blue jeans. ${outfitOnly}` },
  { id: "outfit_2025_day_dress", label: "Day Dress", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-day-dress.png", promptSnippet: `2025 short-sleeve day dress. ${outfitOnly}` },
  { id: "outfit_2025_satin_dress", label: "Satin Dress", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-satin-dress.png", promptSnippet: `2025 satin dress. ${outfitOnly}` },
  { id: "outfit_2025_streetwear", label: "Streetwear Hoodie", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-streetwear-hoodie.png", promptSnippet: `2025 streetwear hoodie and cargos. ${outfitOnly}` },
  { id: "outfit_2025_cream_linen", label: "Cream Linen", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-cream-linen.png", promptSnippet: `2025 cream linen outfit. ${outfitOnly}` },
  { id: "outfit_2025_leather_jacket", label: "Leather Jacket", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-leather-jacket.png", promptSnippet: `2025 leather jacket with denim. ${outfitOnly}` },
  { id: "outfit_2025_knit_layer", label: "Knit Layer", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-knit-layer.png", promptSnippet: `2025 knit layer. ${outfitOnly}` },
  { id: "outfit_2025_floral_maxi_dress", label: "Floral Maxi Dress", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-floral-maxi-dress.png", promptSnippet: `floral short-sleeve maxi dress. ${outfitOnly}` },
  { id: "outfit_2025_cargo_tank", label: "Cargo Jeans & Tank", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-cargo-tank.png", promptSnippet: `brown sleeveless tank with loose light-blue cargo jeans. ${outfitOnly}` },
  { id: "outfit_2025_plaid_pajamas", label: "Plaid Pajamas", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-plaid-pajamas.png", promptSnippet: `cream sweatshirt with pink plaid pajama trousers. ${outfitOnly}` },
  { id: "outfit_2025_white_tee_jeans", label: "White Tee & Jeans", category: "outfit", group: "2025", imagePath: "/explore/influencer-studio/outfits/2025-white-tee-jeans.png", promptSnippet: `fitted white short-sleeve tee and loose light-blue jeans. ${outfitOnly}` },
];

export const OUTFIT_COLORS: readonly InfluencerTrait[] = [
  { id: "outfit_color_as_shown", label: "As shown", category: "outfit_color", promptSnippet: "", isDefault: true },
  { id: "outfit_color_black", label: "Black", category: "outfit_color", colorHex: "#111111", promptSnippet: "Dye the main garment black. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_white", label: "White", category: "outfit_color", colorHex: "#F4F4F5", promptSnippet: "Dye the main garment white. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_navy", label: "Navy", category: "outfit_color", colorHex: "#1B2A4A", promptSnippet: "Dye the main garment navy. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_red", label: "Red", category: "outfit_color", colorHex: "#B42318", promptSnippet: "Dye the main garment red. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_pink", label: "Pink", category: "outfit_color", colorHex: "#E35D8A", promptSnippet: "Dye the main garment pink. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_sage", label: "Sage", category: "outfit_color", colorHex: "#8A9A7B", promptSnippet: "Dye the main garment sage green. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_burgundy", label: "Burgundy", category: "outfit_color", colorHex: "#6E2430", promptSnippet: "Dye the main garment burgundy. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_beige", label: "Beige", category: "outfit_color", colorHex: "#D8C3A5", promptSnippet: "Dye the main garment beige. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
  { id: "outfit_color_denim", label: "Denim", category: "outfit_color", colorHex: "#3D5A80", promptSnippet: "Dye the main garment denim blue. Keep the garment cut, small patterns, belt, and shoes from the outfit photo." },
];

export const HEIGHTS: readonly InfluencerTrait[] = [
  {
    id: "height_petite",
    label: "Petite (~5'2\")",
    category: "height",
    imagePath: "/explore/influencer-studio/height/petite.png",
    promptSnippet: "petite compact stature, natural 5'2\" frame, 1:6 head-to-body scale ratio, natural eye-level camera perspective",
  },
  {
    id: "height_regular",
    label: "Regular (~5'7\")",
    category: "height",
    imagePath: "/explore/influencer-studio/height/regular.png",
    promptSnippet: "balanced natural human height, 5'7\" frame, proportionate body scale, eye-level framing",
  },
  {
    id: "height_tall",
    label: "Tall / Statuesque (~5'11\")",
    category: "height",
    imagePath: "/explore/influencer-studio/height/tall.png",
    promptSnippet: "statuesque tall frame, 5'11\" height, elongated leg-to-torso proportions, 1:8 head-to-body ratio, commanding vertical presence",
    isDefault: true,
  },
];

export const BUILDS: readonly InfluencerTrait[] = [
  {
    id: "build_athletic",
    label: "Athletic & Toned",
    category: "build",
    imagePath: "/explore/influencer-studio/build/athletic.png",
    promptSnippet: "athletic toned build, fit sculpted shoulders, natural posture, healthy fitness physique",
    isDefault: true,
  },
  {
    id: "build_curvy",
    label: "Curvy",
    category: "build",
    imagePath: "/explore/influencer-studio/build/curvy.png",
    promptSnippet: "naturally curvy silhouette with balanced hourglass proportions and soft feminine curves",
  },
  {
    id: "build_slim",
    label: "Slender / Slim",
    category: "build",
    imagePath: "/explore/influencer-studio/build/slim.png",
    promptSnippet: "slender slim physique, refined high-fashion silhouette, lean limbs",
  },
  {
    id: "build_natural",
    label: "Natural / Casual",
    category: "build",
    imagePath: "/explore/influencer-studio/build/natural-casual.png",
    promptSnippet: "natural everyday healthy body build, realistic relatable creator frame",
  },
  {
    id: "build_heavy",
    label: "Plus-Size / Full",
    category: "build",
    imagePath: "/explore/influencer-studio/build/heavy.png",
    promptSnippet: "confident full-figured plus-size body build, natural full curves, radiant presence",
  },
  {
    id: "build_ultra_muscular",
    label: "Ultra Muscular",
    category: "build",
    imagePath: "/explore/influencer-studio/build/ultra-muscular.png",
    promptSnippet: "powerful muscular build with pronounced athletic muscle definition and broad frame",
  },
];

export const ACCESSORIES: readonly InfluencerTrait[] = [
  { id: "accessory_none", label: "No accessories", category: "accessories", promptSnippet: "", isDefault: true },
  {
    id: "accessory_headphones",
    label: "Matte Black Headphones",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/over-ear-headphones.png",
    promptSnippet: "wearing sleek minimalist matte-black over-ear headphones resting comfortably around ears, modern tech creator vibe",
  },
  {
    id: "accessory_earbuds",
    label: "Wireless Earbuds",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/in-ear-earbuds.png",
    promptSnippet: "wearing discreet sleek white wireless in-ear earbuds, modern everyday creator styling",
  },
  {
    id: "accessory_glasses",
    label: "Designer Wire Glasses",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/designer-glasses.png",
    promptSnippet: "wearing elegant thin-frame geometric wire designer eyeglasses, stylish intellectual creator look",
  },
  {
    id: "accessory_headband",
    label: "Athletic White Headband",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/athletic-headband.png",
    promptSnippet: "wearing clean sporty white fabric headband across hairline, athleisure creator styling",
  },
  {
    id: "accessory_gold_patches",
    label: "Gold Hydrogel Patches",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/gold-under-eye-patches.png",
    promptSnippet: "wearing luxury shimmering gold hydrogel skincare eye patches under eyes, morning self-care creator routine",
  },
  {
    id: "accessory_clear_patches",
    label: "Clear Hydrogel Patches",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/clear-hydrogel-patches.png",
    promptSnippet: "wearing clear dewy hydrogel skincare patches under eyes, fresh skincare routine aesthetic",
  },
  {
    id: "accessory_rose_patches",
    label: "Rose Pink Patches",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/rose-pink-patches.png",
    promptSnippet: "wearing playful pastel rose-pink under-eye patches, cute morning skincare creator aesthetic",
  },
  {
    id: "accessory_smudged_noir",
    label: "Smudged Noir Under-Eye",
    category: "accessories",
    imagePath: "/explore/influencer-studio/accessories/smudged-noir.png",
    promptSnippet: "subtle grunge-chic smudged noir eyeliner along lower lash line, edgy viral creator aesthetic",
  },
  { id: "accessory_amber_aviators", label: "Amber Aviators", category: "accessories", imagePath: "/explore/influencer-studio/accessories/amber-aviators.png", promptSnippet: "wearing amber-tinted aviator sunglasses with thin metal frames. Use this photo for the accessory only; keep the selected character identity, hair, outfit and background." },
  { id: "accessory_black_sunglasses", label: "Black Sunglasses", category: "accessories", imagePath: "/explore/influencer-studio/accessories/black-sunglasses.png", promptSnippet: "wearing black sunglasses with dark lenses and thick angular frames. Use this photo for the accessory only; keep the selected character identity, hair, outfit and background." },
  { id: "accessory_pink_star_patches", label: "Pink Star Patches", category: "accessories", imagePath: "/explore/influencer-studio/accessories/pink-star-patches.png", promptSnippet: "wearing pastel pink under-eye skincare patches with a small star pattern. Use this photo for the accessory only; keep the selected character identity, hair, outfit and background." },
];

export const ALL_TRAITS: readonly InfluencerTrait[] = [
  ...CHARACTER_TYPES,
  ...LEGACY_CHARACTER_ALIASES,
  SCRATCH_CHARACTER_FALLBACK,
  ...BACKGROUNDS,
  ...LEGACY_BACKGROUNDS,
  ...GENDERS,
  ...ETHNICITIES,
  ...AGES,
  ...SKIN_TONES,
  ...HEAD_SHAPES,
  ...NECKS,
  ...EYE_SHAPES,
  ...EYE_COLORS,
  ...HAIR_STYLES,
  ...HAIR_COLORS,
  ...OUTFITS,
  ...OUTFIT_COLORS,
  ...HEIGHTS,
  ...BUILDS,
  ...ACCESSORIES,
];

export function findTraitById(
  id: string,
  customTraits: readonly InfluencerTrait[] = []
): InfluencerTrait | undefined {
  return customTraits.find((trait) => trait.id === id) ?? ALL_TRAITS.find((trait) => trait.id === id);
}

export function getTraitsByCategory(category: TraitCategory): readonly InfluencerTrait[] {
  switch (category) {
    case "character_type": return CHARACTER_TYPES;
    case "background": return BACKGROUNDS;
    case "gender": return GENDERS;
    case "ethnicity": return ETHNICITIES;
    case "age": return AGES;
    case "skin_tone": return SKIN_TONES;
    case "head_shape": return HEAD_SHAPES;
    case "neck": return NECKS;
    case "eyes": return EYE_SHAPES;
    case "eye_color": return EYE_COLORS;
    case "hair_style": return HAIR_STYLES;
    case "hair_color": return HAIR_COLORS;
    case "outfit": return OUTFITS;
    case "outfit_color": return OUTFIT_COLORS;
    case "height": return HEIGHTS;
    case "build": return BUILDS;
    case "accessories": return ACCESSORIES;
  }
}

export type PortraitFraming = "full" | "half";

export interface InfluencerSelectionState {
  characterTypeId: string;
  backgroundId: string;
  genderId: string;
  ethnicityId: string;
  ageId: string;
  skinToneId: string;
  headShapeId: string;
  neckId: string;
  eyeShapeId: string;
  eyeColorId: string;
  hairStyleId: string;
  hairColorId: string;
  outfitId: string;
  outfitColorId: string;
  heightId: string;
  buildId: string;
  accessoryIds: string[];
  framing: PortraitFraming;
}

export const DEFAULT_INFLUENCER_SELECTION: InfluencerSelectionState = {
  characterTypeId: "char_average",
  backgroundId: "bg_modern_workspace",
  genderId: "gender_female",
  ethnicityId: "ethnicity_middle_eastern",
  ageId: "age_young_adult",
  skinToneId: "skin_light_olive",
  headShapeId: "head_keep_existing",
  neckId: "neck_standard",
  eyeShapeId: "eye_almond",
  eyeColorId: "eye_color_brown",
  hairStyleId: "hair_keep_existing",
  hairColorId: "hair_color_keep_existing",
  outfitId: "outfit_none",
  outfitColorId: "outfit_color_as_shown",
  heightId: "height_tall",
  buildId: "build_athletic",
  accessoryIds: [],
  framing: "full",
};

export function randomizeInfluencerSelection(framing: PortraitFraming = "full"): InfluencerSelectionState {
  function pickRandom<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }
  const accessory = pickRandom(ACCESSORIES);
  return {
    characterTypeId: pickRandom(CHARACTER_TYPES).id,
    backgroundId: pickRandom(BACKGROUNDS).id,
    genderId: pickRandom(GENDERS).id,
    ethnicityId: pickRandom(ETHNICITIES).id,
    ageId: pickRandom(AGES).id,
    skinToneId: pickRandom(SKIN_TONES).id,
    headShapeId: pickRandom(HEAD_SHAPES).id,
    neckId: pickRandom(NECKS).id,
    eyeShapeId: pickRandom(EYE_SHAPES).id,
    eyeColorId: pickRandom(EYE_COLORS).id,
    hairStyleId: pickRandom(HAIR_STYLES).id,
    hairColorId: pickRandom(HAIR_COLORS).id,
    outfitId: pickRandom(OUTFITS).id,
    outfitColorId: "outfit_color_as_shown",
    heightId: pickRandom(HEIGHTS).id,
    buildId: pickRandom(BUILDS).id,
    accessoryIds: accessory.id === "accessory_none" ? [] : [accessory.id],
    framing,
  };
}



/** An empty list is the existing no-accessory representation; never submit the UI-only choice as a reference. */
export function toggleInfluencerAccessory(current: readonly string[], id: string): string[] {
  if (id === "accessory_none") return [];
  const selected = current.filter(value => value !== "accessory_none");
  return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
}

export function isInfluencerAccessorySelected(current: readonly string[], id: string) {
  const selected = current.filter(value => value !== "accessory_none");
  return id === "accessory_none" ? selected.length === 0 : selected.includes(id);
}
