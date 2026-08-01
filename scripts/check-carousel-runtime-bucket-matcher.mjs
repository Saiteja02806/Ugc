import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": workspaceRoot,
  },
});

const { getCarouselBusinessVisualProfile } = await jiti.import(
  "../lib/carousel/business-visual-profile.ts",
);
const {
  CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
  CAROUSEL_RUNTIME_MATCHER_VERSION,
  selectRuntimeVisualBucketAssets,
} = await jiti.import(
  "../lib/carousel/runtime-visual-bucket-matcher.ts",
);
const { getVisualBucket } = await jiti.import(
  "../lib/carousel/visual-bucket-taxonomy.ts",
);

const profile = getCarouselBusinessVisualProfile("marketing-saas");

if (!profile) {
  throw new Error("Marketing SaaS business visual profile is missing.");
}

const assets = [
  mockAsset("calendar-1", "calendar-overload", 2),
  mockAsset("spreadsheet-1", "spreadsheet-chaos", 1),
  mockAsset("notification-1", "phone-notification", 1),
  mockAsset("laptop-1", "laptop-desk", 0),
  mockAsset("still-life-1", "clean-still-life", 0),
  mockAsset("team-1", "team-meeting", 0),
  mockAsset("phone-hand-1", "phone-in-hand", 0),
  mockAsset("tired-1", "tired-couch", 0),
  mockAsset("laptop-work-1", "laptop-work", 0),
  mockAsset("night-1", "night-routine", 0),
];
const slides = [
  mockSlide({
    headline: "Your content calendar is impossible to keep up with",
    slideNumber: 1,
    slideType: "problem",
    subtext: "Every launch needs another reminder and another schedule change.",
  }),
  mockSlide({
    headline: "Manual reports still eat the whole afternoon",
    slideNumber: 2,
    slideType: "problem",
    subtext: "The team keeps cleaning the same spreadsheet before every meeting.",
  }),
  mockSlide({
    headline: "Automate the campaign steps your team repeats",
    slideNumber: 3,
    slideType: "solution",
    subtext: "One workflow handles planning, handoff, and follow-up.",
  }),
  mockSlide({
    ctaText: "Try the workflow",
    headline: "Turn the next visitor into a qualified signup",
    slideNumber: 4,
    slideType: "cta",
    subtext: null,
  }),
  mockSlide({
    headline: "Check every new lead from the app",
    slideNumber: 5,
    slideType: "solution",
    subtext:
      "Open the phone, review the lead, and act before the follow-up goes cold.",
  }),
  mockSlide({
    headline: "You end the day drained by campaign busywork",
    slideNumber: 6,
    slideType: "problem",
    subtext:
      "The work follows you home because the process still depends on manual checks.",
  }),
  mockSlide({
    headline: "Review campaigns from any quiet workspace",
    slideNumber: 7,
    slideType: "benefit",
    subtext:
      "A flexible workflow keeps progress moving outside the office too.",
  }),
  mockSlide({
    headline: "Late-night campaign checks should not be normal",
    slideNumber: 8,
    slideType: "problem",
    subtext:
      "Missed reminders and scattered tasks keep pulling you back after hours.",
  }),
];

const selections = selectRuntimeVisualBucketAssets({
  assets,
  candidateIndex: 0,
  fallbackAssets: assets,
  profile,
  seed: "marketing-saas-runtime-matcher-check",
  slides,
});

const expectedBuckets = new Map([
  [1, "calendar-overload"],
  [2, "spreadsheet-chaos"],
  [5, "phone-in-hand"],
  [6, "tired-couch"],
  [7, "laptop-work"],
  [8, "night-routine"],
]);
const failures = [];

for (const [slideNumber, expectedBucket] of expectedBuckets) {
  const selection = selections.find((item) => item.slideNumber === slideNumber);

  if (selection?.bucketId !== expectedBucket) {
    failures.push({
      expectedBucket,
      actualBucket: selection?.bucketId ?? null,
      slideNumber,
    });
  }
}

const selectedAssetIds = selections.map((selection) => selection.asset.id);
const uniqueSelectedAssetIds = new Set(selectedAssetIds);

if (uniqueSelectedAssetIds.size !== selectedAssetIds.length) {
  failures.push({
    actualAssetIds: selectedAssetIds,
    error: "Matcher reused an asset even though the dry-run has enough assets.",
  });
}

for (const selection of selections) {
  if (
    selection.hasHuman !== false ||
    selection.imageSubjectClass !== "object-only" ||
    selection.asset.faceCount !== 0 ||
    selection.asset.personCount !== 0
  ) {
    failures.push({
      assetId: selection.asset.id,
      error: "Matcher selected an asset without strict object-only safety metadata.",
    });
  }

  if (selection.score <= 0 || selection.matchReason.length < 4) {
    failures.push({
      assetId: selection.asset.id,
      error: "Matcher did not return complete score and reason diagnostics.",
    });
  }
}

console.log(
  JSON.stringify(
    {
      matcherVersion: CAROUSEL_RUNTIME_MATCHER_VERSION,
      profile: profile.id,
      safetyPolicyVersion: CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
      selections: selections.map((selection) => ({
        assetId: selection.asset.id,
        bucketId: selection.bucketId,
        hasHuman: selection.hasHuman,
        imageSubjectClass: selection.imageSubjectClass,
        intent: selection.intent,
        matchReason: selection.matchReason,
        mode: selection.mode,
        score: selection.score,
        slideNumber: selection.slideNumber,
      })),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}

function mockAsset(id, visualBucketId, usageCount) {
  const bucket = getVisualBucket(visualBucketId);

  if (!bucket) {
    throw new Error(`Unknown visual bucket "${visualBucketId}".`);
  }

  return {
    baseObjectKey: `category-library/marketing-saas/${visualBucketId}/${id}/base.webp`,
    baseUrl: `https://cdn.example.test/${id}.webp`,
    bestForSlideTypes: [...bucket.bestForSlideTypes],
    bucketType: bucket.bucketType,
    contentTags: [],
    faceCount: 0,
    hasHuman: false,
    id,
    imageSubjectClass: "object-only",
    imageQuery: null,
    moodTags: [...bucket.defaultMoodTags],
    pexelsPhotographer: null,
    personCount: 0,
    primaryVertical: bucket.primaryVertical ?? null,
    sourceQuery: bucket.seedQueries[0] ?? null,
    usageCount,
    usableVerticals: [...bucket.usableVerticals],
    visualBucket: visualBucketId,
    visualSetting: null,
    visualStyle: null,
  };
}

function mockSlide({ ctaText = null, headline, slideNumber, slideType, subtext }) {
  return {
    ctaText,
    headline,
    imageDirection: "Use a realistic image that matches the slide meaning.",
    layoutPreset: slideType === "hook" ? "top-hook" : "bottom-message",
    slideNumber,
    slideType,
    subtext,
    textPosition: slideType === "hook" ? "top" : "bottom",
  };
}
