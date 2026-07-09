export const CAROUSEL_VERTICALS = [
  "fitness-health",
  "productivity",
  "saas-work",
  "wellness",
] as const;

export const CAROUSEL_SLIDE_INTENTS = [
  "benefit",
  "checklist",
  "comparison",
  "cta",
  "educational",
  "hook",
  "mistake",
  "pain-point",
  "problem",
  "proof",
  "solution",
  "story",
] as const;

export type CarouselVertical = (typeof CAROUSEL_VERTICALS)[number];
export type CarouselSlideIntent = (typeof CAROUSEL_SLIDE_INTENTS)[number];
export type VisualBucketType = "universal" | "vertical";

export type VisualBucket = {
  readonly bestForSlideTypes: readonly CarouselSlideIntent[];
  readonly bucketType: VisualBucketType;
  readonly defaultMoodTags: readonly string[];
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly primaryVertical?: CarouselVertical;
  readonly seedQueries: readonly string[];
  readonly targetCount: number;
  readonly usableVerticals: readonly CarouselVertical[];
};

export const VISUAL_BUCKETS = [
  {
    id: "meal-moments",
    label: "Meal Moments",
    bucketType: "universal",
    description:
      "Everyday meals in realistic home, work, and social settings, including imperfect or unfinished moments.",
    usableVerticals: ["fitness-health", "wellness", "productivity"],
    bestForSlideTypes: ["hook", "problem", "mistake", "story"],
    defaultMoodTags: ["casual", "everyday", "real-life"],
    seedQueries: [
      "casual dinner table food no people",
      "unfinished meal at home table close up",
      "everyday lunch table phone no people",
    ],
    targetCount: 15,
  },
  {
    id: "phone-in-hand",
    label: "Phone Context",
    bucketType: "universal",
    description:
      "Object-led phone scenes that communicate checking, logging, distraction, reminders, or decision-making without showing a person.",
    usableVerticals: [
      "fitness-health",
      "productivity",
      "saas-work",
      "wellness",
    ],
    bestForSlideTypes: ["hook", "problem", "solution", "story"],
    defaultMoodTags: ["busy", "casual", "connected"],
    seedQueries: [
      "smartphone on table notifications no people",
      "phone beside coffee cup desk no people",
      "phone on sofa with app screen no people",
    ],
    targetCount: 15,
  },
  {
    id: "tired-couch",
    label: "After-hours Overload",
    bucketType: "universal",
    description:
      "Object-led scenes of abandoned devices, unfinished work, rumpled couches, and dim living rooms that imply fatigue without showing a recognizable person.",
    usableVerticals: [
      "fitness-health",
      "productivity",
      "saas-work",
      "wellness",
    ],
    bestForSlideTypes: ["mistake", "pain-point", "problem", "story"],
    defaultMoodTags: ["after-hours", "low-energy", "overwhelmed"],
    seedQueries: [
      "laptop abandoned on sofa dim living room no people",
      "phone on rumpled couch blanket evening still life",
      "cold coffee unfinished work living room no people",
      "empty sofa laptop after work natural light",
      "messy couch remote work aftermath no person",
    ],
    targetCount: 15,
  },
  {
    id: "desk-chaos",
    label: "Desk Chaos",
    bucketType: "universal",
    description:
      "Messy desks, scattered notes, cables, devices, and unfinished work that represent friction or overload.",
    usableVerticals: ["productivity", "saas-work", "wellness"],
    bestForSlideTypes: ["hook", "mistake", "pain-point", "problem"],
    defaultMoodTags: ["chaotic", "overwhelmed", "unfinished"],
    seedQueries: [
      "messy office desk laptop sticky notes",
      "cluttered work desk papers laptop",
      "unfinished paperwork laptop desk",
    ],
    targetCount: 15,
  },
  {
    id: "laptop-work",
    label: "Laptop Work",
    bucketType: "universal",
    description:
      "Flexible laptop use across homes, cafes, and informal workspaces without a polished corporate appearance.",
    usableVerticals: ["productivity", "saas-work", "wellness"],
    bestForSlideTypes: ["benefit", "cta", "hook", "solution", "story"],
    defaultMoodTags: ["casual", "focused", "modern"],
    seedQueries: [
      "laptop on cafe table workspace no people",
      "laptop on coffee table workspace no people",
      "laptop everyday workspace natural light no people",
    ],
    targetCount: 15,
  },
  {
    id: "grocery-aisle",
    label: "Grocery Aisle",
    bucketType: "universal",
    description:
      "Shopping and food-decision moments that communicate choice overload, planning, habits, or uncertainty.",
    usableVerticals: ["fitness-health", "wellness"],
    bestForSlideTypes: ["educational", "mistake", "problem", "story"],
    defaultMoodTags: ["decision-fatigue", "everyday", "uncertain"],
    seedQueries: [
      "grocery cart aisle food choices no people",
      "food label packaging grocery shelf close up no people",
      "shopping basket grocery aisle no people",
    ],
    targetCount: 15,
  },
  {
    id: "water-glass",
    label: "Water Glass",
    bucketType: "universal",
    description:
      "Simple hydration and pause moments that create calm visual space for wellness, habits, and reset messages.",
    usableVerticals: ["fitness-health", "wellness"],
    bestForSlideTypes: ["benefit", "cta", "solution", "story"],
    defaultMoodTags: ["calm", "minimal", "restorative"],
    seedQueries: [
      "glass of water bedside natural light",
      "water glass table minimal lifestyle",
      "water glass at home close up no people",
    ],
    targetCount: 15,
  },
  {
    id: "night-routine",
    label: "Night Routine",
    bucketType: "universal",
    description:
      "Evening and late-night lifestyle scenes associated with fatigue, forgotten habits, reflection, or winding down.",
    usableVerticals: [
      "fitness-health",
      "productivity",
      "saas-work",
      "wellness",
    ],
    bestForSlideTypes: ["mistake", "pain-point", "problem", "story"],
    defaultMoodTags: ["evening", "fatigued", "reflective"],
    seedQueries: [
      "late night laptop desk empty chair at home",
      "phone on bedside table night no people",
      "open laptop desk late night empty room",
    ],
    targetCount: 15,
  },
  {
    id: "clean-still-life",
    label: "Clean Still Life",
    bucketType: "universal",
    description:
      "Simple object-led scenes with generous negative space for clear benefit, proof, or closing messages.",
    usableVerticals: [
      "fitness-health",
      "productivity",
      "saas-work",
      "wellness",
    ],
    bestForSlideTypes: ["benefit", "cta", "proof", "solution"],
    defaultMoodTags: ["calm", "clean", "premium"],
    seedQueries: [
      "minimal desk objects natural light",
      "clean office still life neutral desk",
      "simple stationery objects negative space",
    ],
    targetCount: 15,
  },
  {
    id: "abstract-data",
    label: "Abstract Data",
    bucketType: "universal",
    description:
      "Non-literal screens, charts, numbers, and abstract information scenes that represent complexity or clarity.",
    usableVerticals: ["fitness-health", "productivity", "saas-work"],
    bestForSlideTypes: ["comparison", "educational", "problem", "solution"],
    defaultMoodTags: ["analytical", "complex", "technical"],
    seedQueries: [
      "website analytics dashboard laptop screen",
      "social media analytics dashboard laptop",
      "marketing campaign performance dashboard screen",
    ],
    targetCount: 15,
  },
  {
    id: "meal-prep",
    label: "Meal Prep",
    bucketType: "vertical",
    primaryVertical: "fitness-health",
    description:
      "Practical meal preparation, containers, ingredients, and kitchen routines associated with planning and consistency.",
    usableVerticals: ["fitness-health", "wellness"],
    bestForSlideTypes: ["benefit", "checklist", "educational", "solution"],
    defaultMoodTags: ["organized", "practical", "prepared"],
    seedQueries: [
      "realistic meal prep containers kitchen",
      "casual healthy meal preparation",
      "meal planning food containers home",
    ],
    targetCount: 15,
  },
  {
    id: "food-scale",
    label: "Food Scale",
    bucketType: "vertical",
    primaryVertical: "fitness-health",
    description:
      "Food weighing and portion-measurement scenes useful for accuracy, guessing, and tracking-related stories.",
    usableVerticals: ["fitness-health"],
    bestForSlideTypes: ["educational", "mistake", "problem", "solution"],
    defaultMoodTags: ["analytical", "precise", "real-life"],
    seedQueries: [
      "food scale kitchen portion",
      "weighing meal food scale home",
      "digital food scale realistic kitchen",
    ],
    targetCount: 15,
  },
  {
    id: "healthy-snacks",
    label: "Healthy Snacks",
    bucketType: "vertical",
    primaryVertical: "fitness-health",
    description:
      "Everyday snack choices and portion moments that support educational, habit, and mistake-driven fitness content.",
    usableVerticals: ["fitness-health", "wellness"],
    bestForSlideTypes: ["checklist", "educational", "mistake", "story"],
    defaultMoodTags: ["accessible", "casual", "fresh"],
    seedQueries: [
      "healthy snacks casual kitchen",
      "everyday snack choices table",
      "fruit yogurt snack real life",
    ],
    targetCount: 15,
  },
  {
    id: "gym-phone",
    label: "Gym Phone",
    bucketType: "vertical",
    primaryVertical: "fitness-health",
    description:
      "Phone use around workouts, gym equipment, and tracking moments without relying on polished fitness-model imagery.",
    usableVerticals: ["fitness-health"],
    bestForSlideTypes: ["hook", "problem", "solution", "story"],
    defaultMoodTags: ["active", "casual", "focused"],
    seedQueries: [
      "smartphone on gym bench beside dumbbells",
      "workout tracking phone beside gym equipment",
      "phone near gym equipment lifestyle no people",
    ],
    targetCount: 15,
  },
  {
    id: "post-workout",
    label: "Post Workout",
    bucketType: "vertical",
    primaryVertical: "fitness-health",
    description:
      "Recovery, reflection, fatigue, and progress moments immediately after exercise.",
    usableVerticals: ["fitness-health", "wellness"],
    bestForSlideTypes: ["benefit", "pain-point", "proof", "story"],
    defaultMoodTags: ["accomplished", "fatigued", "reflective"],
    seedQueries: [
      "gym towel water bottle bench after workout",
      "running shoes gym bag post workout no people",
      "shoes and gym equipment post workout recovery",
    ],
    targetCount: 15,
  },
  {
    id: "laptop-desk",
    label: "Laptop Desk",
    bucketType: "vertical",
    primaryVertical: "saas-work",
    description:
      "Product-focused laptop and desk scenes with enough context to communicate modern software-enabled work.",
    usableVerticals: ["productivity", "saas-work"],
    bestForSlideTypes: ["benefit", "cta", "hook", "proof", "solution"],
    defaultMoodTags: ["focused", "modern", "productive"],
    seedQueries: [
      "modern laptop desk real workspace",
      "software work laptop casual office",
      "laptop workspace natural light",
    ],
    targetCount: 15,
  },
  {
    id: "calendar-overload",
    label: "Calendar Overload",
    bucketType: "vertical",
    primaryVertical: "saas-work",
    description:
      "Busy calendars, schedules, reminders, and planning scenes that represent time pressure and coordination overhead.",
    usableVerticals: ["productivity", "saas-work"],
    bestForSlideTypes: ["mistake", "pain-point", "problem", "story"],
    defaultMoodTags: ["busy", "overloaded", "time-pressured"],
    seedQueries: [
      "busy calendar schedule laptop",
      "overloaded planner meetings desk",
      "calendar reminders work stress",
    ],
    targetCount: 15,
  },
  {
    id: "spreadsheet-chaos",
    label: "Spreadsheet Chaos",
    bucketType: "vertical",
    primaryVertical: "saas-work",
    description:
      "Dense spreadsheets, manual data entry, and overloaded screens that communicate repetitive or fragmented work.",
    usableVerticals: ["productivity", "saas-work"],
    bestForSlideTypes: ["comparison", "mistake", "problem", "solution"],
    defaultMoodTags: ["complex", "manual", "overwhelming"],
    seedQueries: [
      "spreadsheet laptop office data entry",
      "manual spreadsheet work laptop office",
      "overwhelming spreadsheet screen work",
    ],
    targetCount: 15,
  },
  {
    id: "phone-notification",
    label: "Phone Notification",
    bucketType: "vertical",
    primaryVertical: "saas-work",
    description:
      "Notification-heavy phone scenes that represent interruptions, missed follow-ups, or connected work.",
    usableVerticals: ["productivity", "saas-work"],
    bestForSlideTypes: ["hook", "pain-point", "problem", "solution"],
    defaultMoodTags: ["distracted", "urgent", "connected"],
    seedQueries: [
      "phone notifications work desk",
      "work messages phone on desk close up no people",
      "busy phone alerts office desk no people",
    ],
    targetCount: 15,
  },
  {
    id: "team-meeting",
    label: "Collaboration Artifacts",
    bucketType: "vertical",
    primaryVertical: "saas-work",
    description:
      "Shared planning artifacts, whiteboards, project tables, and collaborative tools that imply teamwork without relying on stock portraits.",
    usableVerticals: ["productivity", "saas-work"],
    bestForSlideTypes: ["benefit", "proof", "solution", "story"],
    defaultMoodTags: ["collaborative", "focused", "organized"],
    seedQueries: [
      "overhead project planning table sticky notes no people",
      "whiteboard project planning notes empty office",
      "printed project plan conference table no people",
      "shared laptops notebooks table overhead no people",
      "empty meeting room whiteboard collaboration workspace",
    ],
    targetCount: 15,
  },
] as const satisfies readonly VisualBucket[];

export type VisualBucketId = (typeof VISUAL_BUCKETS)[number]["id"];

const VISUAL_BUCKET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const visualBucketMap = new Map<string, VisualBucket>(
  VISUAL_BUCKETS.map((bucket) => [bucket.id, bucket]),
);

function findDuplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    const normalizedValue = value.trim().toLowerCase();

    if (seen.has(normalizedValue)) {
      duplicates.add(normalizedValue);
    }

    seen.add(normalizedValue);
  }

  return Array.from(duplicates);
}

export function isVisualBucketId(value: string): value is VisualBucketId {
  return visualBucketMap.has(value);
}

export function getVisualBucket(value: string) {
  return visualBucketMap.get(value) ?? null;
}

export function getVisualBucketsForVertical(
  vertical: CarouselVertical,
  options: { includeUniversal?: boolean } = {},
) {
  const includeUniversal = options.includeUniversal ?? true;

  return VISUAL_BUCKETS.filter(
    (bucket) =>
      (bucket.usableVerticals as readonly CarouselVertical[]).includes(
        vertical,
      ) &&
      (includeUniversal || bucket.bucketType === "vertical"),
  );
}

export function getVisualBucketsForSlideIntent(intent: CarouselSlideIntent) {
  return VISUAL_BUCKETS.filter((bucket) =>
    (
      bucket.bestForSlideTypes as readonly CarouselSlideIntent[]
    ).includes(intent),
  );
}

export function validateVisualBucketTaxonomy(
  buckets: readonly VisualBucket[] = VISUAL_BUCKETS,
) {
  const errors: string[] = [];
  const duplicateIds = findDuplicates(buckets.map((bucket) => bucket.id));
  const duplicateLabels = findDuplicates(buckets.map((bucket) => bucket.label));

  if (duplicateIds.length > 0) {
    errors.push(`Duplicate bucket ids: ${duplicateIds.join(", ")}`);
  }

  if (duplicateLabels.length > 0) {
    errors.push(`Duplicate bucket labels: ${duplicateLabels.join(", ")}`);
  }

  for (const bucket of buckets) {
    if (!VISUAL_BUCKET_ID_PATTERN.test(bucket.id)) {
      errors.push(`Bucket "${bucket.id}" must use a lowercase kebab-case id.`);
    }

    if (!bucket.description.trim()) {
      errors.push(`Bucket "${bucket.id}" requires a description.`);
    }

    if (bucket.targetCount < 10 || bucket.targetCount > 50) {
      errors.push(`Bucket "${bucket.id}" targetCount must be between 10 and 50.`);
    }

    if (bucket.seedQueries.length < 3) {
      errors.push(`Bucket "${bucket.id}" requires at least three seed queries.`);
    }

    if (bucket.usableVerticals.length === 0) {
      errors.push(`Bucket "${bucket.id}" requires at least one usable vertical.`);
    }

    if (bucket.bestForSlideTypes.length === 0) {
      errors.push(`Bucket "${bucket.id}" requires at least one slide intent.`);
    }

    if (bucket.defaultMoodTags.length === 0) {
      errors.push(`Bucket "${bucket.id}" requires at least one default mood tag.`);
    }

    const duplicateQueries = findDuplicates(bucket.seedQueries);
    const duplicateMoods = findDuplicates(bucket.defaultMoodTags);

    if (duplicateQueries.length > 0) {
      errors.push(
        `Bucket "${bucket.id}" has duplicate seed queries: ${duplicateQueries.join(", ")}`,
      );
    }

    if (duplicateMoods.length > 0) {
      errors.push(
        `Bucket "${bucket.id}" has duplicate mood tags: ${duplicateMoods.join(", ")}`,
      );
    }

    if (bucket.bucketType === "vertical") {
      if (!bucket.primaryVertical) {
        errors.push(`Vertical bucket "${bucket.id}" requires primaryVertical.`);
      } else if (!bucket.usableVerticals.includes(bucket.primaryVertical)) {
        errors.push(
          `Vertical bucket "${bucket.id}" must include primaryVertical in usableVerticals.`,
        );
      }
    } else if (bucket.primaryVertical) {
      errors.push(`Universal bucket "${bucket.id}" cannot set primaryVertical.`);
    }
  }

  return errors;
}

export function assertValidVisualBucketTaxonomy(
  buckets: readonly VisualBucket[] = VISUAL_BUCKETS,
) {
  const errors = validateVisualBucketTaxonomy(buckets);

  if (errors.length > 0) {
    throw new Error(`Invalid carousel visual bucket taxonomy:\n${errors.join("\n")}`);
  }
}
