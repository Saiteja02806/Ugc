import { randomUUID } from "node:crypto";

import sharp from "sharp";

import {
  CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
  getBroadVisualBucket,
  type BroadVisualBucket,
} from "@/lib/carousel/broad-visual-bucket-taxonomy";
import { normalizeCategorySlug } from "@/lib/carousel/category-resolver";
import { inferImageStyleMetadata } from "@/lib/carousel/image-metadata";
import { analyzeCarouselImageSubject } from "@/lib/carousel/image-subject-safety";
import {
  downloadPexelsImage,
  getBestPexelsImageUrl,
  searchPexelsPhotos,
  type PexelsPhoto,
} from "@/lib/carousel/pexels";
import {
  getExistingPexelsPhotoIds,
  getCategoryImageAssetSourcingState,
  insertCategoryImageAsset,
} from "@/lib/carousel/supabase";
import { uploadCategoryImageAsset } from "@/lib/carousel/storage";
import {
  getVisualBucket,
  type VisualBucket,
} from "@/lib/carousel/visual-bucket-taxonomy";

export type CarouselImageSubjectAnalysisMode = "auto" | "manual";

export type SeedCategoryImageLibraryInput = {
  batchSize?: number;
  broadVisualBucketId?: string;
  candidateFetchLimit?: number;
  categorySlug: string;
  maxSourceAttempts?: number;
  /** @deprecated Use candidateFetchLimit. */
  maxSeededCount?: number;
  minimumApprovedTarget?: number;
  queries?: string[];
  subjectAnalysisMode?: CarouselImageSubjectAnalysisMode;
  /** @deprecated Use minimumApprovedTarget. */
  targetCount?: number;
  visualBucketId?: string;
  visualKeywords?: string[];
};

export type SeedCategoryImageLibraryResult = {
  approvedObjectOnlyCountAfter: number;
  approvedObjectOnlyCountBefore: number;
  awaitingManualReview: boolean;
  batchSize: number;
  batchesProcessed: number;
  broadVisualBucketId: string | null;
  bucketType: "universal" | "vertical" | null;
  candidateFetchLimit: number;
  categorySlug: string;
  errors: string[];
  isReady: boolean;
  minimumApprovedTarget: number;
  sourceAttemptLimit: number;
  surplusApprovedCount: number;
  rawCandidateCountAfter: number;
  rawCandidateCountBefore: number;
  rejectedCountAfter: number;
  rejectedCountBefore: number;
  unreviewedCountAfter: number;
  unreviewedCountBefore: number;
  /** @deprecated Mirrors candidateFetchLimit. */
  maxSeededCount: number | null;
  ok: true;
  readyCountAfter: number;
  readyCountBefore: number;
  reviewCandidateCountAfter: number;
  reviewCandidateCountBefore: number;
  seededCount: number;
  skippedClearFaceCount: number;
  skippedHumanCount: number;
  skippedDuplicateCount: number;
  subjectAnalysisMode: CarouselImageSubjectAnalysisMode;
  targetCount: number;
  visualBucketId: string | null;
};

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1350;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 400;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_TARGET_COUNT = 100;
export const DEFAULT_CAROUSEL_CANDIDATE_FETCH_LIMIT = 80;
export const MAX_CAROUSEL_CANDIDATE_FETCH_LIMIT = 120;
const DEFAULT_MAX_SOURCE_ATTEMPTS = 8;
const MAX_SOURCE_ATTEMPTS = 12;
const MAX_BATCH_SIZE = 20;
const MAX_TARGET_COUNT = 250;
const PEXELS_SEARCH_PER_QUERY = 80;
const MAX_CONSECUTIVE_EMPTY_BATCHES = 3;
const MANUAL_SUBJECT_ANALYZER_VERSION = "manual-review-pending-v1";
const BLOCKED_PEXELS_PHOTO_TERMS = [
  "bitcoin",
  "burnt matches",
  "car dashboard",
  "cigarette",
  "cigarettes",
  "crypto",
  "cryptocurrency",
  "drunk",
  "forex",
  "matches",
  "sheet mask",
  "speedometer",
  "stock exchange",
  "stock market",
  "trading",
  "vehicle dashboard",
] as const;

type PexelsPhotoCandidate = {
  pexelsPhotoId: string;
  photo: PexelsPhoto;
  query: string;
  sourceUrl: string;
};

function cleanString(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function cleanStringArray(values: string[]) {
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function normalizeTargetCount(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TARGET_COUNT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_TARGET_COUNT);
}

function normalizeBatchSize(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_BATCH_SIZE);
}

function normalizeCandidateFetchLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CAROUSEL_CANDIDATE_FETCH_LIMIT;
  }

  return Math.min(
    Math.max(Math.trunc(value), 1),
    MAX_CAROUSEL_CANDIDATE_FETCH_LIMIT,
  );
}

function normalizeMaxSourceAttempts(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_SOURCE_ATTEMPTS;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_SOURCE_ATTEMPTS);
}

function normalizeSubjectAnalysisMode(
  value: CarouselImageSubjectAnalysisMode | undefined,
): CarouselImageSubjectAnalysisMode {
  return value === "auto" ? "auto" : "manual";
}

function getPexelsPhotoId(photo: PexelsPhoto) {
  return String(photo.id);
}

function isPortraitCandidate(photo: PexelsPhoto) {
  return photo.width > 0 && photo.height > 0 && photo.height >= photo.width;
}

function isBlockedPexelsPhoto(photo: PexelsPhoto) {
  const searchText = `${photo.alt ?? ""} ${photo.url ?? ""}`.toLowerCase();

  return BLOCKED_PEXELS_PHOTO_TERMS.some((term) =>
    searchText.includes(term),
  );
}

function scorePexelsPhoto(photo: PexelsPhoto) {
  const megapixels = (photo.width * photo.height) / 1_000_000;
  const resolutionScore = Math.min(megapixels / 10, 0.25);
  const portraitScore = photo.height > photo.width ? 0.1 : 0;

  return Math.min(0.65 + resolutionScore + portraitScore, 1);
}

async function renderImageRenditions(inputBuffer: Buffer) {
  const baseBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(BASE_WIDTH, BASE_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 86 })
    .toBuffer();

  const thumbBuffer = await sharp(baseBuffer)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 76 })
    .toBuffer();

  return {
    baseBuffer,
    thumbBuffer,
  };
}

function normalizeInput(input: SeedCategoryImageLibraryInput) {
  const categorySlug = normalizeCategorySlug(input.categorySlug);
  const visualBucketId = cleanString(input.visualBucketId ?? "");
  const broadVisualBucketId = cleanString(input.broadVisualBucketId ?? "");
  const visualBucket = visualBucketId ? getVisualBucket(visualBucketId) : null;
  const broadVisualBucket = broadVisualBucketId
    ? getBroadVisualBucket(broadVisualBucketId)
    : null;

  if (visualBucketId && !visualBucket) {
    throw new Error(`Unknown carousel visual bucket "${visualBucketId}".`);
  }

  if (broadVisualBucketId && !broadVisualBucket) {
    throw new Error(
      `Unknown carousel broad visual bucket "${broadVisualBucketId}".`,
    );
  }

  if (visualBucket && broadVisualBucket) {
    throw new Error(
      "Seed category image library expects either visualBucketId or broadVisualBucketId, not both.",
    );
  }

  const queries = cleanStringArray(
    input.queries && input.queries.length > 0
      ? input.queries
      : [
          ...(visualBucket?.seedQueries ?? []),
          ...(broadVisualBucket?.seedQueryThemes ?? []),
        ],
  );
  const visualKeywords = cleanStringArray(input.visualKeywords ?? []);

  if (queries.length === 0) {
    throw new Error(
      "Seed category image library requires at least one query or a valid visual bucket.",
    );
  }

  return {
    batchSize: normalizeBatchSize(input.batchSize),
    candidateFetchLimit: normalizeCandidateFetchLimit(
      input.candidateFetchLimit ?? input.maxSeededCount,
    ),
    categorySlug,
    maxSourceAttempts: normalizeMaxSourceAttempts(input.maxSourceAttempts),
    queries,
    subjectAnalysisMode: normalizeSubjectAnalysisMode(
      input.subjectAnalysisMode,
    ),
    minimumApprovedTarget: normalizeTargetCount(
      input.minimumApprovedTarget ?? input.targetCount,
    ),
    broadVisualBucket,
    visualBucket,
    visualKeywords,
  };
}

async function getSourcingStateForPayload(payload: {
  broadVisualBucket: BroadVisualBucket | null;
  categorySlug: string;
  visualBucket: VisualBucket | null;
}) {
  return getCategoryImageAssetSourcingState({
    broadVisualBucketId: payload.broadVisualBucket?.id ?? null,
    categorySlug: payload.categorySlug,
    visualBucketId: payload.visualBucket?.id ?? null,
  });
}

function rotateArray<T>(items: T[], offset: number) {
  if (items.length === 0) {
    return [];
  }

  const normalizedOffset = offset % items.length;

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function interleaveCandidates(groups: PexelsPhotoCandidate[][]) {
  const candidates: PexelsPhotoCandidate[] = [];
  const maxGroupLength = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < maxGroupLength; index += 1) {
    for (const group of groups) {
      const candidate = group[index];

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function extractQueryTags(text: string) {
  const normalizedText = text.toLowerCase();
  const tagRules: Array<[string, readonly string[]]> = [
    ["abstract", ["abstract"]],
    ["analytics", ["analytics", "metrics"]],
    ["background", ["background"]],
    ["bottle", ["bottle", "bottles", "container"]],
    ["calendar", ["calendar", "schedule"]],
    ["chart", ["chart", "charts", "graph"]],
    ["coffee", ["coffee", "cafe"]],
    ["dashboard", ["dashboard"]],
    ["data", ["data"]],
    ["desk", ["desk", "workspace"]],
    ["fabric", ["fabric", "folds"]],
    ["fitness", ["fitness", "gym", "workout", "training"]],
    ["geometric", ["geometric", "shapes"]],
    ["home", ["home", "living room", "bedroom", "interior"]],
    ["keyboard", ["keyboard"]],
    ["lamp", ["lamp", "lighting"]],
    ["laptop", ["laptop", "macbook", "computer"]],
    ["minimal", ["minimal", "clean"]],
    ["night", ["night", "evening", "bedside", "nightstand"]],
    ["monitor", ["monitor", "display"]],
    ["negative-space", ["negative space"]],
    ["notebook", ["notebook", "planner"]],
    ["phone", ["phone", "mobile", "smartphone"]],
    ["product", ["product", "packaging", "display"]],
    ["recovery", ["recovery", "foam roller"]],
    ["screen", ["screen", "display"]],
    ["skincare", ["skincare", "cosmetic", "serum"]],
    ["spreadsheet", ["spreadsheet", "excel", "table", "csv"]],
    ["stationery", ["stationery", "paper"]],
    ["stone", ["stone", "marble"]],
    ["supplement", ["supplement", "vitamin"]],
    ["texture", ["texture", "surface"]],
    ["couch", ["couch", "sofa", "living room"]],
    ["water", ["water", "hydration"]],
    ["wellness", ["wellness", "essential oil"]],
    ["whiteboard", ["whiteboard"]],
    ["yoga", ["yoga", "yoga mat", "yoga block"]],
  ];

  return tagRules
    .filter(([, terms]) => terms.some((term) => normalizedText.includes(term)))
    .map(([tag]) => tag);
}

function getBroadBucketMoodTags(bucket: BroadVisualBucket | null) {
  if (!bucket) {
    return [];
  }

  switch (bucket.id) {
    case "abstract-backgrounds":
      return ["flexible", "neutral"];
    case "clean-texture-backgrounds":
      return ["calm", "minimal"];
    case "data-and-screens":
      return ["analytical", "structured"];
    case "home-lifestyle":
      return ["calm", "everyday", "after-hours"];
    case "fitness-wellness-objects":
      return ["focused", "active", "recovery"];
    case "notes-and-planning":
      return ["organized", "planned"];
    case "phone-and-devices":
      return ["focused", "alert"];
    case "product-still-life":
      return ["clean", "premium", "commercial"];
    case "workspace-objects":
      return ["focused", "professional"];
    default:
      return [];
  }
}

function buildBatchCandidates(params: {
  existingPhotoIds: Set<string>;
  queryResults: Array<{ photos: PexelsPhoto[]; query: string }>;
  seenPexelsPhotoIds: Set<string>;
}) {
  const batchSeenPexelsPhotoIds = new Set<string>();
  let skippedDuplicateCount = 0;
  const candidateGroups = params.queryResults.map((result) => {
    const candidates: PexelsPhotoCandidate[] = [];

    for (const photo of result.photos) {
      const pexelsPhotoId = getPexelsPhotoId(photo);
      const isDuplicate =
        params.seenPexelsPhotoIds.has(pexelsPhotoId) ||
        params.existingPhotoIds.has(pexelsPhotoId) ||
        batchSeenPexelsPhotoIds.has(pexelsPhotoId);

      if (isDuplicate) {
        skippedDuplicateCount += 1;
        continue;
      }

      batchSeenPexelsPhotoIds.add(pexelsPhotoId);

      const sourceUrl = getBestPexelsImageUrl(photo);

      if (
        !sourceUrl ||
        !isPortraitCandidate(photo) ||
        isBlockedPexelsPhoto(photo)
      ) {
        continue;
      }

      candidates.push({
        pexelsPhotoId,
        photo,
        query: result.query,
        sourceUrl,
      });
    }

    return candidates;
  });

  return {
    candidates: interleaveCandidates(candidateGroups),
    skippedDuplicateCount,
  };
}

export async function seedCategoryImageLibrary(
  input: SeedCategoryImageLibraryInput,
): Promise<SeedCategoryImageLibraryResult> {
  const payload = normalizeInput(input);
  const sourcingStateBefore = await getSourcingStateForPayload(payload);
  const approvedObjectOnlyCountBefore =
    sourcingStateBefore.approvedObjectOnlyCount;

  if (approvedObjectOnlyCountBefore >= payload.minimumApprovedTarget) {
    return {
      approvedObjectOnlyCountAfter: approvedObjectOnlyCountBefore,
      approvedObjectOnlyCountBefore,
      awaitingManualReview: false,
      batchSize: payload.batchSize,
      batchesProcessed: 0,
      broadVisualBucketId: payload.broadVisualBucket?.id ?? null,
      bucketType: payload.visualBucket?.bucketType ?? null,
      candidateFetchLimit: payload.candidateFetchLimit,
      categorySlug: payload.categorySlug,
      errors: [],
      isReady: true,
      minimumApprovedTarget: payload.minimumApprovedTarget,
      sourceAttemptLimit: payload.maxSourceAttempts,
      surplusApprovedCount:
        approvedObjectOnlyCountBefore - payload.minimumApprovedTarget,
      rawCandidateCountAfter: sourcingStateBefore.rawCandidateCount,
      rawCandidateCountBefore: sourcingStateBefore.rawCandidateCount,
      rejectedCountAfter: sourcingStateBefore.rejectedCount,
      rejectedCountBefore: sourcingStateBefore.rejectedCount,
      unreviewedCountAfter: sourcingStateBefore.unreviewedCount,
      unreviewedCountBefore: sourcingStateBefore.unreviewedCount,
      maxSeededCount: payload.candidateFetchLimit,
      ok: true,
      readyCountAfter: approvedObjectOnlyCountBefore,
      readyCountBefore: approvedObjectOnlyCountBefore,
      reviewCandidateCountAfter: approvedObjectOnlyCountBefore,
      reviewCandidateCountBefore: approvedObjectOnlyCountBefore,
      seededCount: 0,
      skippedClearFaceCount: 0,
      skippedHumanCount: 0,
      skippedDuplicateCount: 0,
      subjectAnalysisMode: payload.subjectAnalysisMode,
      targetCount: payload.minimumApprovedTarget,
      visualBucketId: payload.visualBucket?.id ?? null,
    };
  }

  if (sourcingStateBefore.unreviewedCount > 0) {
    return {
      approvedObjectOnlyCountAfter: approvedObjectOnlyCountBefore,
      approvedObjectOnlyCountBefore,
      awaitingManualReview: true,
      batchSize: payload.batchSize,
      batchesProcessed: 0,
      broadVisualBucketId: payload.broadVisualBucket?.id ?? null,
      bucketType: payload.visualBucket?.bucketType ?? null,
      candidateFetchLimit: payload.candidateFetchLimit,
      categorySlug: payload.categorySlug,
      errors: [],
      isReady: false,
      minimumApprovedTarget: payload.minimumApprovedTarget,
      sourceAttemptLimit: payload.maxSourceAttempts,
      surplusApprovedCount: 0,
      rawCandidateCountAfter: sourcingStateBefore.rawCandidateCount,
      rawCandidateCountBefore: sourcingStateBefore.rawCandidateCount,
      rejectedCountAfter: sourcingStateBefore.rejectedCount,
      rejectedCountBefore: sourcingStateBefore.rejectedCount,
      unreviewedCountAfter: sourcingStateBefore.unreviewedCount,
      unreviewedCountBefore: sourcingStateBefore.unreviewedCount,
      maxSeededCount: payload.candidateFetchLimit,
      ok: true,
      readyCountAfter: approvedObjectOnlyCountBefore,
      readyCountBefore: approvedObjectOnlyCountBefore,
      reviewCandidateCountAfter: approvedObjectOnlyCountBefore,
      reviewCandidateCountBefore: approvedObjectOnlyCountBefore,
      seededCount: 0,
      skippedClearFaceCount: 0,
      skippedHumanCount: 0,
      skippedDuplicateCount: 0,
      subjectAnalysisMode: payload.subjectAnalysisMode,
      targetCount: payload.minimumApprovedTarget,
      visualBucketId: payload.visualBucket?.id ?? null,
    };
  }

  const seenPexelsPhotoIds = new Set<string>();
  const errors: string[] = [];
  let batchesProcessed = 0;
  let seededCount = 0;
  let skippedClearFaceCount = 0;
  let skippedHumanCount = 0;
  let skippedDuplicateCount = 0;
  let consecutiveEmptyBatches = 0;

  while (
    seededCount < payload.candidateFetchLimit &&
    batchesProcessed < payload.maxSourceAttempts
  ) {
    const batchNumber = batchesProcessed + 1;
    const remainingSeedAllowance = Math.max(
      payload.candidateFetchLimit - seededCount,
      0,
    );
    const batchTargetCount = Math.min(
      payload.batchSize,
      remainingSeedAllowance,
    );

    if (batchTargetCount <= 0) {
      break;
    }

    const queryResults = await Promise.all(
      rotateArray(payload.queries, batchesProcessed).map(async (query) => {
        try {
          return {
            photos: await searchPexelsPhotos({
              query,
              orientation: "portrait",
              page: batchNumber,
              perPage: PEXELS_SEARCH_PER_QUERY,
            }),
            query,
          };
        } catch (error) {
          errors.push(
            `Query "${query}" failed on page ${batchNumber}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );

          return { photos: [], query };
        }
      }),
    );
    const allPhotoIds = queryResults.flatMap((result) =>
      result.photos.map(getPexelsPhotoId),
    );
    const existingPhotoIds = await getExistingPexelsPhotoIds(allPhotoIds);
    const batchCandidates = buildBatchCandidates({
      existingPhotoIds,
      queryResults,
      seenPexelsPhotoIds,
    });
    let batchSeededCount = 0;

    skippedDuplicateCount += batchCandidates.skippedDuplicateCount;

    for (const candidate of batchCandidates.candidates) {
      if (batchSeededCount >= batchTargetCount) {
        break;
      }

      seenPexelsPhotoIds.add(candidate.pexelsPhotoId);

      try {
        const sourceBuffer = await downloadPexelsImage(candidate.sourceUrl);
        const subjectAnalysis =
          payload.subjectAnalysisMode === "auto"
            ? await analyzeCarouselImageSubject(sourceBuffer)
            : null;

        if (subjectAnalysis && (
          subjectAnalysis.imageSubjectClass !== "object-only" ||
          subjectAnalysis.hasHuman ||
          subjectAnalysis.faceCount > 0 ||
          subjectAnalysis.personCount > 0
        )) {
          skippedHumanCount += 1;

          if (subjectAnalysis.imageSubjectClass === "clear-face") {
            skippedClearFaceCount += 1;
          }

          continue;
        }

        const { baseBuffer, thumbBuffer } =
          await renderImageRenditions(sourceBuffer);
        const assetPathId = randomUUID();
        const upload = await uploadCategoryImageAsset({
          assetId: assetPathId,
          baseBuffer,
          categorySlug: payload.categorySlug,
          thumbBuffer,
          visualBucketId: payload.visualBucket?.id ?? payload.broadVisualBucket?.id,
        });
        const metadata = inferImageStyleMetadata({
          alt: candidate.photo.alt,
          query: candidate.query,
          visualKeywords: payload.visualKeywords,
        });
        const visualBucketMetadata = payload.visualBucket
          ? {
              best_for_slide_types: [...payload.visualBucket.bestForSlideTypes],
              bucket_type: payload.visualBucket.bucketType,
              mood_tags: [...payload.visualBucket.defaultMoodTags],
              primary_vertical: payload.visualBucket.primaryVertical ?? null,
              usable_verticals: [...payload.visualBucket.usableVerticals],
              visual_bucket: payload.visualBucket.id,
            }
          : {};
        const broadObjectTags = payload.broadVisualBucket
          ? cleanStringArray([
              ...extractQueryTags(
                [candidate.query, candidate.photo.alt].filter(Boolean).join(" "),
              ),
              ...payload.broadVisualBucket.defaultTags,
            ])
          : [];
        const broadMoodTags = getBroadBucketMoodTags(payload.broadVisualBucket);
        const broadBucketMetadata = payload.broadVisualBucket
          ? {
              broad_visual_bucket: payload.broadVisualBucket.id,
              bucket_taxonomy_version: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
              mood_tags: broadMoodTags,
              object_tags: broadObjectTags,
            }
          : {};
        const contentTags = payload.broadVisualBucket
          ? cleanStringArray([
              ...metadata.contentTags.filter((tag) => tag !== "human"),
              ...payload.broadVisualBucket.defaultTags,
              ...broadObjectTags,
            ])
          : metadata.contentTags;
        const subjectAnalysisMetadata =
          subjectAnalysis ??
          ({
            analyzer_version: MANUAL_SUBJECT_ANALYZER_VERSION,
            mode: "manual-review-pending",
            policy: "object-only-backgrounds-required",
            reviewed: false,
          } as const);

        await insertCategoryImageAsset({
          avg_color: candidate.photo.avg_color ?? null,
          base_s3_key: upload.baseObjectKey,
          base_url: upload.baseUrl,
          category_slug: payload.categorySlug,
          content_tags: contentTags,
          face_count: subjectAnalysis?.faceCount ?? null,
          has_human: subjectAnalysis?.hasHuman ?? null,
          height: BASE_HEIGHT,
          image_subject_class: subjectAnalysis?.imageSubjectClass ?? null,
          image_query: candidate.query,
          max_face_area_ratio: subjectAnalysis?.maxFaceAreaRatio ?? null,
          orientation: "portrait",
          pexels_photo_id: candidate.pexelsPhotoId,
          pexels_photo_url: candidate.photo.url ?? null,
          pexels_photographer: candidate.photo.photographer ?? null,
          pexels_photographer_url: candidate.photo.photographer_url ?? null,
          person_count: subjectAnalysis?.personCount ?? null,
          quality_score: scorePexelsPhoto(candidate.photo),
          source_query: metadata.sourceQuery,
          source_provider: "pexels",
          status: "ready",
          subject_analysis: subjectAnalysisMetadata,
          subject_analyzed_at: subjectAnalysis ? new Date().toISOString() : null,
          subject_analyzer_version:
            subjectAnalysis?.analyzerVersion ?? MANUAL_SUBJECT_ANALYZER_VERSION,
          subject_review_status: "unreviewed",
          thumb_s3_key: upload.thumbObjectKey,
          thumb_url: upload.thumbUrl,
          visual_setting: metadata.visualSetting,
          visual_style: metadata.visualStyle,
          visual_keywords: payload.visualKeywords,
          width: BASE_WIDTH,
          ...broadBucketMetadata,
          ...visualBucketMetadata,
        });

        batchSeededCount += 1;
        seededCount += 1;
      } catch (error) {
        errors.push(
          `Photo ${candidate.pexelsPhotoId} failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }

    batchesProcessed += 1;

    if (batchSeededCount === 0) {
      consecutiveEmptyBatches += 1;

      if (consecutiveEmptyBatches >= MAX_CONSECUTIVE_EMPTY_BATCHES) {
        break;
      }

      continue;
    }

    consecutiveEmptyBatches = 0;
  }

  const sourcingStateAfter = await getSourcingStateForPayload(payload);
  const approvedObjectOnlyCountAfter = sourcingStateAfter.approvedObjectOnlyCount;
  const isReady =
    approvedObjectOnlyCountAfter >= payload.minimumApprovedTarget;
  const awaitingManualReview =
    !isReady && sourcingStateAfter.unreviewedCount > 0;
  const surplusApprovedCount = Math.max(
    approvedObjectOnlyCountAfter - payload.minimumApprovedTarget,
    0,
  );

  if (
    seededCount === 0 &&
    approvedObjectOnlyCountBefore < payload.minimumApprovedTarget &&
    !awaitingManualReview
  ) {
    throw new Error(
      `No category images were seeded for ${payload.categorySlug}. Last errors: ${
        errors.slice(-3).join(" | ") || "No usable Pexels photos were found."
      }`,
    );
  }

  return {
    approvedObjectOnlyCountAfter,
    approvedObjectOnlyCountBefore,
    awaitingManualReview,
    batchSize: payload.batchSize,
    batchesProcessed,
    broadVisualBucketId: payload.broadVisualBucket?.id ?? null,
    bucketType: payload.visualBucket?.bucketType ?? null,
    candidateFetchLimit: payload.candidateFetchLimit,
    categorySlug: payload.categorySlug,
    errors,
    isReady,
    minimumApprovedTarget: payload.minimumApprovedTarget,
    sourceAttemptLimit: payload.maxSourceAttempts,
    surplusApprovedCount,
    rawCandidateCountAfter: sourcingStateAfter.rawCandidateCount,
    rawCandidateCountBefore: sourcingStateBefore.rawCandidateCount,
    rejectedCountAfter: sourcingStateAfter.rejectedCount,
    rejectedCountBefore: sourcingStateBefore.rejectedCount,
    unreviewedCountAfter: sourcingStateAfter.unreviewedCount,
    unreviewedCountBefore: sourcingStateBefore.unreviewedCount,
    maxSeededCount: payload.candidateFetchLimit,
    ok: true,
    readyCountAfter: approvedObjectOnlyCountAfter,
    readyCountBefore: approvedObjectOnlyCountBefore,
    reviewCandidateCountAfter: approvedObjectOnlyCountAfter,
    reviewCandidateCountBefore: approvedObjectOnlyCountBefore,
    seededCount,
    skippedClearFaceCount,
    skippedHumanCount,
    skippedDuplicateCount,
    subjectAnalysisMode: payload.subjectAnalysisMode,
    targetCount: payload.minimumApprovedTarget,
    visualBucketId: payload.visualBucket?.id ?? null,
  };
}
