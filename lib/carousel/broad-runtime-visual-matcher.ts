import type { CarouselBusinessVisualProfile } from "@/lib/carousel/business-visual-profile";
import {
  CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
  getBroadBucketFallbacksForProfile,
  getBroadBucketRequirementsForProfile,
  getBroadVisualBucket,
  isBroadVisualBucketId,
  isBroadAssetSourceAllowedForProfile,
  type BroadVisualBucketId,
} from "@/lib/carousel/broad-visual-bucket-taxonomy";
import type { ReadyCategoryImageAsset } from "@/lib/carousel/db";
import type { PlannedCarouselSlide } from "@/lib/carousel/slide-plan";
import {
  getCarouselSlideIntent,
  type RuntimeVisualBucketAssetSelection,
} from "@/lib/carousel/runtime-visual-bucket-matcher";

export const CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION =
  "broad-runtime-matcher-v3";

export const CAROUSEL_BROAD_MATCHER_MODES = [
  "off",
  "dry-run",
  "enabled",
] as const;

export type CarouselBroadMatcherMode =
  (typeof CAROUSEL_BROAD_MATCHER_MODES)[number];

export type CarouselBroadMatcherModeResolution = {
  canaryMatchedBy: "business-profile" | "user" | null;
  configuredMode: CarouselBroadMatcherMode;
  effectiveMode: CarouselBroadMatcherMode;
};

export type BroadMatchFallbackReason =
  | "broad_bucket_fallback"
  | "duplicate_safe_reuse"
  | "exact_match"
  | "no_safe_asset_available"
  | "partial_tag_match"
  | "profile_fallback";

export type BroadRuntimeVisualAssetSelection = {
  asset: ReadyCategoryImageAsset;
  broadBucketId: BroadVisualBucketId;
  bucketId: BroadVisualBucketId;
  duplicatePenaltyApplied: boolean;
  fallbackReason: Exclude<
    BroadMatchFallbackReason,
    "no_safe_asset_available"
  >;
  hasHuman: boolean | null;
  imageSubjectClass: ReadyCategoryImageAsset["imageSubjectClass"];
  intent: ReturnType<typeof getCarouselSlideIntent>;
  matchReason: string[];
  matchedTags: string[];
  mode: "broad-runtime";
  nearDuplicateAvoided: boolean;
  nearDuplicateGroup: string | null;
  score: number;
  slideNumber: number;
  targetBroadBucketId: BroadVisualBucketId;
};

export type BroadMatcherSlideDiagnostic = {
  broadAssetId: string | null;
  broadBucketId: BroadVisualBucketId | null;
  broadScore: number | null;
  fallbackReason: BroadMatchFallbackReason;
  legacyAssetId: string | null;
  legacyBucketId: string | null;
  sameAsset: boolean;
  slideNumber: number;
  targetBroadBucketId: BroadVisualBucketId | null;
};

type BroadRuntimeVisualMatcherInput = {
  assets: ReadyCategoryImageAsset[];
  candidateIndex: number;
  categorySlug: string;
  profile: CarouselBusinessVisualProfile;
  seed: string;
  slides: PlannedCarouselSlide[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "and",
  "are",
  "before",
  "for",
  "from",
  "into",
  "not",
  "that",
  "the",
  "this",
  "with",
  "without",
  "your",
]);

const BROAD_BUCKET_KEYWORD_HINTS: Record<
  BroadVisualBucketId,
  readonly string[]
> = {
  "workspace-objects": [
    "ai",
    "automate",
    "desk",
    "laptop",
    "platform",
    "productivity",
    "software",
    "tool",
    "workflow",
    "workspace",
  ],
  "phone-and-devices": [
    "alert",
    "app",
    "device",
    "mobile",
    "notification",
    "phone",
    "reminder",
    "tracking",
  ],
  "data-and-screens": [
    "analytics",
    "chart",
    "dashboard",
    "data",
    "graph",
    "metric",
    "report",
    "spreadsheet",
  ],
  "notes-and-planning": [
    "calendar",
    "deadline",
    "notes",
    "plan",
    "planning",
    "schedule",
    "sticky notes",
    "whiteboard",
  ],
  "home-lifestyle": [
    "after hours",
    "couch",
    "evening",
    "home",
    "late night",
    "night",
    "routine",
    "tired",
  ],
  "food-and-table": [
    "calorie",
    "dinner",
    "food",
    "grocery",
    "lunch",
    "meal",
    "nutrition",
    "snack",
  ],
  "fitness-wellness-objects": [
    "fitness",
    "gym",
    "habit",
    "hydrate",
    "recovery",
    "water",
    "wellness",
    "workout",
  ],
  "product-still-life": [
    "beauty",
    "bottle",
    "packaging",
    "product",
    "serum",
    "skincare",
    "still life",
  ],
  "abstract-backgrounds": [
    "abstract",
    "concept",
    "future",
    "growth",
    "idea",
    "neutral",
    "system",
  ],
  "clean-texture-backgrounds": [
    "calm",
    "clean",
    "clear",
    "get started",
    "minimal",
    "next step",
    "simple",
    "start",
    "try",
  ],
};

const CANDIDATE_SPREAD_SLOT_COUNT = 20;
const CANDIDATE_SPREAD_PENALTY_STEP = 5;
const CANDIDATE_SPREAD_RELEVANCE_BAND_SIZE = 24;

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

function getTokens(value: string) {
  return value
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slideTextContainsTerm(slideText: string, term: string) {
  const normalizedText = ` ${normalizeMatchText(slideText)} `;
  const normalizedTerm = normalizeMatchText(term);

  if (!normalizedTerm) {
    return false;
  }

  return (
    normalizedText.includes(` ${normalizedTerm} `) ||
    normalizedText.includes(` ${normalizedTerm}s `) ||
    (normalizedTerm.endsWith("s") &&
      normalizedText.includes(` ${normalizedTerm.slice(0, -1)} `))
  );
}

function getAssetTagMatches(asset: ReadyCategoryImageAsset, slideText: string) {
  return {
    contentMatches: cleanStringArray(asset.contentTags).filter((tag) =>
      slideTextContainsTerm(slideText, tag),
    ),
    moodMatches: cleanStringArray(asset.moodTags).filter((tag) =>
      slideTextContainsTerm(slideText, tag),
    ),
    objectMatches: cleanStringArray(asset.objectTags).filter((tag) =>
      slideTextContainsTerm(slideText, tag),
    ),
  };
}

function scoreAssetTagMatches(asset: ReadyCategoryImageAsset, slideText: string) {
  const { contentMatches, moodMatches, objectMatches } = getAssetTagMatches(
    asset,
    slideText,
  );

  return (
    contentMatches.length * 18 +
    objectMatches.length * 14 +
    moodMatches.length * 8
  );
}

function isStrictSafeBroadAsset(
  asset: ReadyCategoryImageAsset,
  categorySlug: string,
  profile: CarouselBusinessVisualProfile,
) {
  const broadBucketId =
    typeof asset.broadVisualBucket === "string" &&
    isBroadVisualBucketId(asset.broadVisualBucket)
      ? asset.broadVisualBucket
      : null;
  const broadBucket = broadBucketId
    ? getBroadVisualBucket(broadBucketId)
    : null;

  if (!broadBucketId) {
    return false;
  }

  return (
    isBroadAssetSourceAllowedForProfile({
      broadBucketId,
      primaryCategorySlug: categorySlug,
      profileId: profile.id,
      sourceCategorySlug: asset.categorySlug,
    }) &&
    asset.status === "ready" &&
    asset.subjectReviewStatus === "approved" &&
    asset.imageSubjectClass === "object-only" &&
    asset.hasHuman === false &&
    asset.faceCount === 0 &&
    asset.personCount === 0 &&
    asset.runtimeExclusionReason === null &&
    asset.bucketTaxonomyVersion === CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION &&
    Boolean(broadBucket?.bestForProfiles.includes(profile.id))
  );
}

function getAssetIdentity(asset: ReadyCategoryImageAsset) {
  if (asset.canonicalAssetId) {
    return `canonical:${asset.canonicalAssetId}`;
  }

  if (asset.sourceFileSha256) {
    return `sha256:${asset.sourceFileSha256}`;
  }

  if (asset.sourcePerceptualHash) {
    return `phash:${asset.sourcePerceptualHash}`;
  }

  return asset.pexelsPhotoId
    ? `pexels:${asset.pexelsPhotoId}`
    : `object:${asset.baseObjectKey}`;
}

function getCandidateSpreadPenalty(params: {
  asset: ReadyCategoryImageAsset;
  bucketId: BroadVisualBucketId;
  candidateIndex: number;
  slideNumber: number;
}) {
  const assetSlot =
    hashString(`${params.bucketId}:${getAssetIdentity(params.asset)}`) %
    CANDIDATE_SPREAD_SLOT_COUNT;
  const targetSlot =
    (params.candidateIndex + params.slideNumber - 1) %
    CANDIDATE_SPREAD_SLOT_COUNT;
  const directDistance = Math.abs(assetSlot - targetSlot);
  const circularDistance = Math.min(
    directDistance,
    CANDIDATE_SPREAD_SLOT_COUNT - directDistance,
  );

  return circularDistance * CANDIDATE_SPREAD_PENALTY_STEP;
}

function hasNearDuplicateConflict(params: {
  assets: ReadyCategoryImageAsset[];
  bucketId: BroadVisualBucketId;
  usedNearDuplicateGroups: Set<string>;
}) {
  return params.assets.some(
    (asset) =>
      asset.broadVisualBucket === params.bucketId &&
      Boolean(
        asset.nearDuplicateGroup &&
          params.usedNearDuplicateGroups.has(asset.nearDuplicateGroup),
      ),
  );
}

function getMatchedTags(asset: ReadyCategoryImageAsset, slideText: string) {
  const { contentMatches, moodMatches, objectMatches } = getAssetTagMatches(
    asset,
    slideText,
  );

  return Array.from(
    new Set([...contentMatches, ...objectMatches, ...moodMatches]),
  );
}

function scoreBucket(slideText: string, bucketId: BroadVisualBucketId) {
  const bucket = getBroadVisualBucket(bucketId);
  const slideTokens = getTokens(slideText);
  const searchText = [
    bucket?.id ?? bucketId,
    bucket?.label ?? "",
    bucket?.description ?? "",
    ...(bucket?.defaultTags ?? []),
    ...BROAD_BUCKET_KEYWORD_HINTS[bucketId],
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;

  for (const token of slideTokens) {
    if (searchText.includes(token)) {
      score += 4;
    }
  }

  for (const hint of BROAD_BUCKET_KEYWORD_HINTS[bucketId]) {
    if (slideTextContainsTerm(slideText, hint)) {
      score += hint.includes(" ") ? 24 : 14;
    }
  }

  return score;
}

function getTargetBroadBucket(params: {
  assets: ReadyCategoryImageAsset[];
  profile: CarouselBusinessVisualProfile;
  slide: PlannedCarouselSlide;
}) {
  const slideText = getSlideText(params.slide);
  const requiredBucketIds = getBroadBucketRequirementsForProfile(
    params.profile.id,
  );

  return [...requiredBucketIds]
    .map((bucketId, index) => ({
      bucketId,
      index,
      score:
        scoreBucket(slideText, bucketId) +
        Math.max(
          0,
          ...params.assets
            .filter((asset) => asset.broadVisualBucket === bucketId)
            .map((asset) => scoreAssetTagMatches(asset, slideText)),
        ),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]
    .bucketId;
}

function rankAssets(params: {
  assets: ReadyCategoryImageAsset[];
  bucketId: BroadVisualBucketId;
  candidateIndex: number;
  duplicatePenaltyApplied: boolean;
  seed: string;
  slide: PlannedCarouselSlide;
}) {
  const slideText = getSlideText(params.slide);

  return params.assets
    .filter((asset) => asset.broadVisualBucket === params.bucketId)
    .map((asset) => {
      const { contentMatches, moodMatches, objectMatches } = getAssetTagMatches(
        asset,
        slideText,
      );
      const matchedTags = getMatchedTags(asset, slideText);
      const relevanceScore =
        scoreBucket(slideText, params.bucketId) +
        contentMatches.length * 18 +
        objectMatches.length * 14 +
        moodMatches.length * 8;
      const matchTier = Math.min(matchedTags.length, 3);
      const relevanceBand = Math.floor(
        relevanceScore / CANDIDATE_SPREAD_RELEVANCE_BAND_SIZE,
      );
      const candidateSpreadPenalty = getCandidateSpreadPenalty({
        asset,
        bucketId: params.bucketId,
        candidateIndex: params.candidateIndex,
        slideNumber: params.slide.slideNumber,
      });
      const tieBreaker =
        hashString(
          `${params.seed}:${params.candidateIndex}:${params.slide.slideNumber}:${asset.id}`,
        ) % 7;
      const score =
        100 +
        relevanceScore -
        Math.min(asset.usageCount, 20) -
        candidateSpreadPenalty -
        (params.duplicatePenaltyApplied ? 80 : 0) +
        tieBreaker;

      return {
        asset,
        candidateSpreadPenalty,
        matchedTags,
        matchTier,
        relevanceBand,
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.asset.id.localeCompare(right.asset.id),
    );
}

function buildSelection(params: {
  categorySlug: string;
  duplicatePenaltyApplied: boolean;
  fallbackReason: BroadRuntimeVisualAssetSelection["fallbackReason"];
  rankedAsset: ReturnType<typeof rankAssets>[number];
  slide: PlannedCarouselSlide;
  targetBroadBucketId: BroadVisualBucketId;
  nearDuplicateAvoided: boolean;
}) {
  const broadBucketId = params.rankedAsset.asset
    .broadVisualBucket as BroadVisualBucketId;
  const matchReason = [
    `target broad bucket ${params.targetBroadBucketId}`,
    `selected broad bucket ${broadBucketId}`,
    `approved object-only with zero human signals`,
    `fallback reason ${params.fallbackReason}`,
    `routing score ${params.rankedAsset.score}`,
  ];

  if (params.rankedAsset.matchedTags.length > 0) {
    matchReason.push(
      `matched tags ${params.rankedAsset.matchedTags.join(", ")}`,
    );
  }

  if (params.duplicatePenaltyApplied) {
    matchReason.push("safe asset reuse after unique permitted assets were exhausted");
  }

  if (params.rankedAsset.candidateSpreadPenalty > 0) {
    matchReason.push(
      `candidate_spread_penalty ${params.rankedAsset.candidateSpreadPenalty}`,
    );
  }

  if (params.nearDuplicateAvoided) {
    matchReason.push("near_duplicate_avoided");
  }

  if (params.rankedAsset.asset.categorySlug !== params.categorySlug) {
    matchReason.push(`asset source category ${params.rankedAsset.asset.categorySlug}`);
  }

  return {
    asset: params.rankedAsset.asset,
    broadBucketId,
    bucketId: broadBucketId,
    duplicatePenaltyApplied: params.duplicatePenaltyApplied,
    fallbackReason: params.fallbackReason,
    hasHuman: params.rankedAsset.asset.hasHuman,
    imageSubjectClass: params.rankedAsset.asset.imageSubjectClass,
    intent: getCarouselSlideIntent(params.slide),
    matchReason,
    matchedTags: params.rankedAsset.matchedTags,
    mode: "broad-runtime",
    nearDuplicateAvoided: params.nearDuplicateAvoided,
    nearDuplicateGroup: params.rankedAsset.asset.nearDuplicateGroup,
    score: params.rankedAsset.score,
    slideNumber: params.slide.slideNumber,
    targetBroadBucketId: params.targetBroadBucketId,
  } satisfies BroadRuntimeVisualAssetSelection;
}

export function getCarouselBroadMatcherMode(
  value = process.env.CAROUSEL_BROAD_MATCHER_MODE,
): CarouselBroadMatcherMode {
  const normalized = value?.trim().toLowerCase();

  return CAROUSEL_BROAD_MATCHER_MODES.includes(
    normalized as CarouselBroadMatcherMode,
  )
    ? (normalized as CarouselBroadMatcherMode)
    : "off";
}

function parseIdAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function resolveCarouselBroadMatcherMode(params: {
  businessProfileAllowlist?: string;
  businessProfileId?: string | null;
  configuredMode?: CarouselBroadMatcherMode;
  userAllowlist?: string;
  userId?: string | null;
}): CarouselBroadMatcherModeResolution {
  const configuredMode =
    params.configuredMode ?? getCarouselBroadMatcherMode();

  if (configuredMode !== "dry-run") {
    return {
      canaryMatchedBy: null,
      configuredMode,
      effectiveMode: configuredMode,
    };
  }

  const businessProfileAllowlist = parseIdAllowlist(
    params.businessProfileAllowlist ??
      process.env.CAROUSEL_BROAD_MATCHER_CANARY_BUSINESS_PROFILE_IDS,
  );
  const userAllowlist = parseIdAllowlist(
    params.userAllowlist ?? process.env.CAROUSEL_BROAD_MATCHER_CANARY_USER_IDS,
  );
  const canaryMatchedBy =
    params.businessProfileId &&
    businessProfileAllowlist.has(params.businessProfileId)
      ? "business-profile"
      : params.userId && userAllowlist.has(params.userId)
        ? "user"
        : null;

  return {
    canaryMatchedBy,
    configuredMode,
    effectiveMode: canaryMatchedBy ? "enabled" : "dry-run",
  };
}

export function selectBroadRuntimeVisualAssets({
  assets,
  candidateIndex,
  categorySlug,
  profile,
  seed,
  slides,
}: BroadRuntimeVisualMatcherInput) {
  const safeAssets = assets.filter((asset) =>
    isStrictSafeBroadAsset(asset, categorySlug, profile),
  );
  const fallbackBucketIds = getBroadBucketFallbacksForProfile(profile.id);
  const usedAssetIdentities = new Set<string>();
  const usedNearDuplicateGroups = new Set<string>();
  const selections: BroadRuntimeVisualAssetSelection[] = [];

  for (const slide of slides) {
    const targetBroadBucketId = getTargetBroadBucket({
      assets: safeAssets,
      profile,
      slide,
    });
    const targetNearDuplicateAvoided = hasNearDuplicateConflict({
      assets: safeAssets,
      bucketId: targetBroadBucketId,
      usedNearDuplicateGroups,
    });
    const unusedAssets = safeAssets.filter(
      (asset) =>
        !usedAssetIdentities.has(getAssetIdentity(asset)) &&
        !(
          asset.nearDuplicateGroup &&
          usedNearDuplicateGroups.has(asset.nearDuplicateGroup)
        ),
    );
    const targetRanked = rankAssets({
      assets: unusedAssets,
      bucketId: targetBroadBucketId,
      candidateIndex,
      duplicatePenaltyApplied: false,
      seed,
      slide,
    });
    let selection: BroadRuntimeVisualAssetSelection | null = null;

    if (targetRanked[0]) {
      const matchCount = targetRanked[0].matchedTags.length;
      selection = buildSelection({
        categorySlug,
        duplicatePenaltyApplied: false,
        fallbackReason:
          matchCount >= 2
            ? "exact_match"
            : matchCount === 1
              ? "partial_tag_match"
              : "broad_bucket_fallback",
        rankedAsset: targetRanked[0],
        slide,
        targetBroadBucketId,
        nearDuplicateAvoided: targetNearDuplicateAvoided,
      });
    }

    if (!selection) {
      for (const fallbackBucketId of fallbackBucketIds) {
        const fallbackRanked = rankAssets({
          assets: unusedAssets,
          bucketId: fallbackBucketId,
          candidateIndex,
          duplicatePenaltyApplied: false,
          seed: `${seed}:profile-fallback`,
          slide,
        });

        if (fallbackRanked[0]) {
          selection = buildSelection({
            categorySlug,
            duplicatePenaltyApplied: false,
            fallbackReason: "profile_fallback",
            rankedAsset: fallbackRanked[0],
            slide,
            targetBroadBucketId,
            nearDuplicateAvoided:
              targetNearDuplicateAvoided ||
              hasNearDuplicateConflict({
                assets: safeAssets,
                bucketId: fallbackBucketId,
                usedNearDuplicateGroups,
              }),
          });
          break;
        }
      }
    }

    if (!selection) {
      const reuseBucketIds = Array.from(
        new Set([targetBroadBucketId, ...fallbackBucketIds]),
      );

      for (const bucketId of reuseBucketIds) {
        const reuseRanked = rankAssets({
          assets: safeAssets,
          bucketId,
          candidateIndex,
          duplicatePenaltyApplied: true,
          seed: `${seed}:safe-reuse`,
          slide,
        });

        if (reuseRanked[0]) {
          selection = buildSelection({
            categorySlug,
            duplicatePenaltyApplied: true,
            fallbackReason: "duplicate_safe_reuse",
            rankedAsset: reuseRanked[0],
            slide,
            targetBroadBucketId,
            nearDuplicateAvoided: false,
          });
          break;
        }
      }
    }

    if (!selection) {
      continue;
    }

    usedAssetIdentities.add(getAssetIdentity(selection.asset));
    if (selection.nearDuplicateGroup) {
      usedNearDuplicateGroups.add(selection.nearDuplicateGroup);
    }
    selections.push(selection);
  }

  return selections;
}

export function compareBroadAndLegacySelections(params: {
  broadSelections: BroadRuntimeVisualAssetSelection[];
  legacySelections: RuntimeVisualBucketAssetSelection[];
  slides: PlannedCarouselSlide[];
}) {
  const broadBySlide = new Map(
    params.broadSelections.map((selection) => [selection.slideNumber, selection]),
  );
  const legacyBySlide = new Map(
    params.legacySelections.map((selection) => [selection.slideNumber, selection]),
  );

  return params.slides.map((slide) => {
    const broad = broadBySlide.get(slide.slideNumber) ?? null;
    const legacy = legacyBySlide.get(slide.slideNumber) ?? null;

    return {
      broadAssetId: broad?.asset.id ?? null,
      broadBucketId: broad?.broadBucketId ?? null,
      broadScore: broad?.score ?? null,
      fallbackReason: broad?.fallbackReason ?? "no_safe_asset_available",
      legacyAssetId: legacy?.asset.id ?? null,
      legacyBucketId: legacy?.bucketId ?? null,
      sameAsset: Boolean(broad && legacy && broad.asset.id === legacy.asset.id),
      slideNumber: slide.slideNumber,
      targetBroadBucketId: broad?.targetBroadBucketId ?? null,
    } satisfies BroadMatcherSlideDiagnostic;
  });
}
