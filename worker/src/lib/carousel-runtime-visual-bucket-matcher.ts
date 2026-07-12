import type { CarouselBusinessVisualProfile } from "./carousel-business-visual-profile.js";
import type { CategoryImageAssetRow } from "../types.js";
import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";
import {
  CAROUSEL_SLIDE_INTENTS,
  getVisualBucket,
  type CarouselSlideIntent,
  type VisualBucket,
  type VisualBucketId,
} from "./carousel-visual-bucket-taxonomy.js";

type SlideVisualSelectionMode =
  | "bucket-intent"
  | "bucket-profile"
  | "fallback-category";

export const CAROUSEL_IMAGE_SAFETY_POLICY_VERSION =
  "object-only-no-human-v1";
export const CAROUSEL_RUNTIME_MATCHER_VERSION =
  "runtime-bucket-matcher-v2";

export type RuntimeVisualBucketAssetSelection = {
  asset: CategoryImageAssetRow;
  bucketId: string | null;
  hasHuman: boolean | null;
  imageSubjectClass: CategoryImageAssetRow["image_subject_class"];
  intent: CarouselSlideIntent;
  matchReason: string[];
  mode: SlideVisualSelectionMode;
  score: number;
  slideNumber: number;
};

type RuntimeVisualBucketMatcherInput = {
  assets: CategoryImageAssetRow[];
  candidateIndex: number;
  fallbackAssets: CategoryImageAssetRow[];
  profile: CarouselBusinessVisualProfile;
  seed: string;
  slides: PlannedCarouselSlide[];
};

const SLIDE_TYPE_TO_INTENT = {
  benefit: "benefit",
  cta: "cta",
  differentiator: "proof",
  hook: "hook",
  problem: "problem",
  solution: "solution",
} as const satisfies Record<PlannedCarouselSlide["slideType"], CarouselSlideIntent>;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "and",
  "are",
  "before",
  "between",
  "for",
  "from",
  "into",
  "more",
  "not",
  "one",
  "that",
  "the",
  "this",
  "too",
  "with",
  "without",
  "work",
  "your",
]);

const BUCKET_KEYWORD_HINTS: Partial<Record<VisualBucketId, readonly string[]>> = {
  "abstract-data": [
    "analytics",
    "chart",
    "dashboard",
    "data",
    "metric",
    "numbers",
    "reporting",
  ],
  "calendar-overload": [
    "calendar",
    "deadline",
    "meeting",
    "plan",
    "reminder",
    "schedule",
    "time",
  ],
  "clean-still-life": [
    "clean",
    "clear",
    "next step",
    "simple",
    "start",
    "try",
  ],
  "desk-chaos": [
    "busywork",
    "chaos",
    "clutter",
    "messy",
    "scattered",
    "unfinished",
  ],
  "food-scale": ["accuracy", "calorie", "portion", "track", "weigh"],
  "grocery-aisle": ["choice", "grocery", "label", "shopping", "store"],
  "gym-phone": ["gym", "reps", "track", "workout"],
  "healthy-snacks": ["snack", "snacks", "yogurt"],
  "laptop-desk": [
    "ai",
    "automate",
    "dashboard",
    "platform",
    "software",
    "tool",
    "workflow",
  ],
  "laptop-work": [
    "any quiet workspace",
    "coffee table",
    "flexible",
    "focus",
    "freelancer",
    "home office",
    "laptop",
    "outside the office",
    "quiet workspace",
    "remote",
    "software",
    "workspace",
  ],
  "meal-moments": ["dinner", "food", "lunch", "meal"],
  "meal-prep": ["meal prep", "plan", "prep", "prepared"],
  "night-routine": [
    "after hours",
    "after-hours",
    "evening",
    "late",
    "late night",
    "late-night",
    "night",
    "routine",
    "tired",
  ],
  "phone-in-hand": ["app", "check", "log", "phone", "tap"],
  "phone-notification": [
    "alert",
    "follow-up",
    "inbox",
    "message",
    "notification",
    "reminder",
  ],
  "post-workout": ["fatigue", "progress", "recovery", "workout"],
  "spreadsheet-chaos": [
    "csv",
    "data entry",
    "manual",
    "report",
    "sheet",
    "spreadsheet",
  ],
  "team-meeting": ["collaborate", "meeting", "team", "together"],
  "tired-couch": [
    "after work",
    "couch",
    "drained",
    "end the day",
    "exhausted",
    "follows you home",
    "overwhelmed",
    "sofa",
    "tired",
  ],
  "water-glass": ["calm", "habit", "hydrate", "reset", "water"],
};

const PROFILE_PRIORITY_BUCKET_SCORE = 8;
const VERTICAL_BUCKET_SCORE = 6;

const SLIDE_INTENT_SET = new Set<string>(CAROUSEL_SLIDE_INTENTS);

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function cleanText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getSlideText(slide: PlannedCarouselSlide) {
  return [
    slide.slideType,
    cleanText(slide.textMode),
    cleanText(slide.headline),
    cleanText(slide.body),
    cleanText(slide.subtext),
    cleanText(slide.ctaText),
    cleanText(slide.imageDirection),
    ...(slide.listItems ?? []).map(cleanText),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getTextTokens(value: string) {
  return value
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function getBucketSearchText(bucket: VisualBucket) {
  return [
    bucket.id,
    bucket.label,
    bucket.description,
    ...bucket.defaultMoodTags,
    ...bucket.seedQueries,
    ...(BUCKET_KEYWORD_HINTS[bucket.id as VisualBucketId] ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function scoreBucketKeywordMatch(slideText: string, bucket: VisualBucket) {
  const bucketText = getBucketSearchText(bucket);
  const slideTokens = getTextTokens(slideText);
  let score = 0;

  for (const token of slideTokens) {
    if (bucketText.includes(token)) {
      score += 6;
    }
  }

  for (const hint of BUCKET_KEYWORD_HINTS[bucket.id as VisualBucketId] ?? []) {
    if (slideText.includes(hint)) {
      score += hint.includes(" ") ? 18 : 12;
    }
  }

  return score;
}

function assetSupportsIntent(
  asset: CategoryImageAssetRow,
  intent: CarouselSlideIntent,
) {
  if (!Array.isArray(asset.best_for_slide_types)) {
    return true;
  }

  const slideIntents = asset.best_for_slide_types.filter(
    (value): value is CarouselSlideIntent =>
      typeof value === "string" && SLIDE_INTENT_SET.has(value),
  );

  return slideIntents.length === 0 || slideIntents.includes(intent);
}

function getAssetIdentity(asset: CategoryImageAssetRow) {
  if (asset.canonical_asset_id) {
    return `canonical:${asset.canonical_asset_id}`;
  }

  if (asset.source_file_sha256) {
    return `sha256:${asset.source_file_sha256}`;
  }

  if (asset.source_perceptual_hash) {
    return `phash:${asset.source_perceptual_hash}`;
  }

  return asset.pexels_photo_id
    ? `pexels:${asset.pexels_photo_id}`
    : `s3:${asset.base_s3_key}`;
}

function uniqueAssets(items: CategoryImageAssetRow[]) {
  const seen = new Set<string>();
  const assets: CategoryImageAssetRow[] = [];

  for (const item of items) {
    const assetIdentity = getAssetIdentity(item);

    if (seen.has(assetIdentity)) {
      continue;
    }

    seen.add(assetIdentity);
    assets.push(item);
  }

  return assets;
}

function rankAssets(params: {
  assets: CategoryImageAssetRow[];
  candidateIndex: number;
  seed: string;
  slideNumber: number;
}) {
  return [...params.assets].sort((left, right) => {
    const usageDelta = left.usage_count - right.usage_count;

    if (usageDelta !== 0) {
      return usageDelta;
    }

    return (
      hashString(
        `${params.seed}:${params.candidateIndex}:${params.slideNumber}:${left.id}`,
      ) -
      hashString(
        `${params.seed}:${params.candidateIndex}:${params.slideNumber}:${right.id}`,
      )
    );
  });
}

function getRankedBuckets(params: {
  candidateIndex: number;
  intent: CarouselSlideIntent;
  profile: CarouselBusinessVisualProfile;
  seed: string;
  slide: PlannedCarouselSlide;
}) {
  const slideText = getSlideText(params.slide);
  const buckets = params.profile.requiredBucketIds
    .map((bucketId) => getVisualBucket(bucketId))
    .filter((bucket): bucket is VisualBucket => Boolean(bucket));

  const intentBuckets = buckets.filter((bucket) =>
    bucket.bestForSlideTypes.includes(params.intent),
  );
  const candidateBuckets = intentBuckets.length > 0 ? intentBuckets : buckets;

  return candidateBuckets
    .map((bucket) => {
      const keywordScore = scoreBucketKeywordMatch(slideText, bucket);
      const priorityScore = params.profile.seedPriorityBucketIds.includes(
        bucket.id as VisualBucketId,
      )
        ? PROFILE_PRIORITY_BUCKET_SCORE
        : 0;
      const verticalScore =
        bucket.bucketType === "vertical" ? VERTICAL_BUCKET_SCORE : 0;
      const stableTieBreaker =
        hashString(
          `${params.seed}:${params.candidateIndex}:${params.slide.slideNumber}:${bucket.id}`,
        ) % 7;

      return {
        bucket,
        score:
          100 +
          priorityScore +
          verticalScore +
          keywordScore +
          stableTieBreaker,
      };
    })
    .sort((left, right) => right.score - left.score);
}

function getMatchReason(params: {
  asset: CategoryImageAssetRow;
  bucketId: string | null;
  intent: CarouselSlideIntent;
  mode: SlideVisualSelectionMode;
  score: number;
}) {
  const reasons = [
    params.bucketId
      ? `matched bucket ${params.bucketId}`
      : "used category fallback without a visual bucket",
    `matched slide intent ${params.intent}`,
  ];

  if (
    params.asset.image_subject_class === "object-only" &&
    params.asset.has_human === false &&
    params.asset.face_count === 0 &&
    params.asset.person_count === 0
  ) {
    reasons.push("approved object-only with zero human signals");
  } else {
    reasons.push("asset safety metadata is not fully verified");
  }

  reasons.push(`selection mode ${params.mode}`);
  reasons.push(`routing score ${params.score}`);

  return reasons;
}

function pickBucketAsset(params: {
  allowReuse: boolean;
  assets: CategoryImageAssetRow[];
  candidateIndex: number;
  intent: CarouselSlideIntent;
  seed: string;
  slideNumber: number;
  usedAssetIdentities: Set<string>;
  visualBucketId: string;
}) {
  const bucketAssets = params.assets.filter(
    (asset) =>
      asset.visual_bucket === params.visualBucketId &&
      assetSupportsIntent(asset, params.intent),
  );
  const unusedBucketAssets = bucketAssets.filter(
    (asset) => !params.usedAssetIdentities.has(getAssetIdentity(asset)),
  );
  const candidateAssets = params.allowReuse ? bucketAssets : unusedBucketAssets;

  if (candidateAssets.length === 0) {
    return null;
  }

  const rankedAssets = rankAssets({
    assets: candidateAssets,
    candidateIndex: params.candidateIndex,
    seed: `${params.seed}:${params.visualBucketId}`,
    slideNumber: params.slideNumber,
  });

  return rankedAssets[0] ?? null;
}

function pickFallbackAsset(params: {
  candidateIndex: number;
  fallbackAssets: CategoryImageAssetRow[];
  seed: string;
  slideNumber: number;
  usedAssetIdentities: Set<string>;
}) {
  const unusedAssets = params.fallbackAssets.filter(
    (asset) => !params.usedAssetIdentities.has(getAssetIdentity(asset)),
  );
  const rankedAssets = rankAssets({
    assets: unusedAssets.length > 0 ? unusedAssets : params.fallbackAssets,
    candidateIndex: params.candidateIndex,
    seed: `${params.seed}:fallback`,
    slideNumber: params.slideNumber,
  });

  return rankedAssets[0] ?? null;
}

export function getCarouselSlideIntent(slide: PlannedCarouselSlide) {
  return SLIDE_TYPE_TO_INTENT[slide.slideType];
}

export function selectRuntimeVisualBucketAssets({
  assets,
  candidateIndex,
  fallbackAssets,
  profile,
  seed,
  slides,
}: RuntimeVisualBucketMatcherInput) {
  const uniqueBucketAssets = uniqueAssets(
    assets.filter((asset) => Boolean(asset.visual_bucket)),
  );
  const uniqueFallbackAssets = uniqueAssets(fallbackAssets);
  const usedAssetIdentities = new Set<string>();
  const selections: RuntimeVisualBucketAssetSelection[] = [];

  for (const slide of slides) {
    const intent = getCarouselSlideIntent(slide);
    const rankedBuckets = getRankedBuckets({
      candidateIndex,
      intent,
      profile,
      seed,
      slide,
    });
    let selectedAsset: CategoryImageAssetRow | null = null;
    let selectedBucketId: string | null = null;
    let selectedMode: SlideVisualSelectionMode = "fallback-category";
    let selectedScore = 0;

    for (const { bucket, score } of rankedBuckets) {
      selectedAsset = pickBucketAsset({
        allowReuse: false,
        assets: uniqueBucketAssets,
        candidateIndex,
        intent,
        seed,
        slideNumber: slide.slideNumber,
        usedAssetIdentities,
        visualBucketId: bucket.id,
      });

      if (selectedAsset) {
        selectedBucketId = bucket.id;
        selectedMode = "bucket-intent";
        selectedScore = score;
        break;
      }
    }

    if (!selectedAsset) {
      const profileBucketAssets = uniqueBucketAssets.filter((asset) =>
        profile.requiredBucketIds.includes(asset.visual_bucket as VisualBucketId),
      );

      selectedAsset =
        rankAssets({
          assets: profileBucketAssets.filter(
            (asset) => !usedAssetIdentities.has(getAssetIdentity(asset)),
          ),
          candidateIndex,
          seed: `${seed}:profile-bucket`,
          slideNumber: slide.slideNumber,
        })[0] ??
        rankAssets({
          assets: profileBucketAssets,
          candidateIndex,
          seed: `${seed}:profile-bucket-reuse`,
          slideNumber: slide.slideNumber,
        })[0] ??
        null;

      if (selectedAsset) {
        selectedBucketId = selectedAsset.visual_bucket;
        selectedMode = "bucket-profile";
        selectedScore = 50;
      }
    }

    if (!selectedAsset) {
      selectedAsset = pickFallbackAsset({
        candidateIndex,
        fallbackAssets: uniqueFallbackAssets,
        seed,
        slideNumber: slide.slideNumber,
        usedAssetIdentities,
      });
      selectedBucketId = selectedAsset?.visual_bucket ?? null;
      selectedMode = "fallback-category";
      selectedScore = 0;
    }

    if (!selectedAsset) {
      continue;
    }

    usedAssetIdentities.add(getAssetIdentity(selectedAsset));
    selections.push({
      asset: selectedAsset,
      bucketId: selectedBucketId,
      hasHuman: selectedAsset.has_human,
      imageSubjectClass: selectedAsset.image_subject_class,
      intent,
      matchReason: getMatchReason({
        asset: selectedAsset,
        bucketId: selectedBucketId,
        intent,
        mode: selectedMode,
        score: selectedScore,
      }),
      mode: selectedMode,
      score: selectedScore,
      slideNumber: slide.slideNumber,
    });
  }

  return selections;
}
