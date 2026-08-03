import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
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

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const profileId = args.profile || "marketing-saas";
const profile = getCarouselBusinessVisualProfile(profileId);

if (!profile) {
  throw new Error(`Unknown carousel business visual profile "${profileId}".`);
}

const categorySlug = args.category || args.categorySlug || profile.categorySlug;
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const rows = await listReadyAssets(categorySlug, profile.requiredBucketIds);
const assets = rows.map(mapReadyAsset);
const bucketCounts = countByBucket(assets);
const routingCases = getRoutingCases(profileId);
const selections = selectRuntimeVisualBucketAssets({
  assets,
  candidateIndex: 0,
  fallbackAssets: assets,
  profile,
  seed: `${profileId}:live-routing-check`,
  slides: routingCases.map((item) => item.slide),
});
const selectionBySlideNumber = new Map(
  selections.map((selection) => [selection.slideNumber, selection]),
);
const checks = routingCases.map((item) => {
  const selection = selectionBySlideNumber.get(item.slide.slideNumber) ?? null;
  const expectedBucketReadyCount = bucketCounts[item.expectedBucketId] ?? 0;
  const skipped = expectedBucketReadyCount === 0;
  const hasStrictSafetyMetadata = Boolean(
    selection &&
      selection.hasHuman === false &&
      selection.imageSubjectClass === "object-only" &&
      selection.asset.faceCount === 0 &&
      selection.asset.personCount === 0,
  );
  const passed =
    !skipped &&
    selection?.bucketId === item.expectedBucketId &&
    hasStrictSafetyMetadata;

  return {
    expectedBucketId: item.expectedBucketId,
    expectedBucketReadyCount,
    hasHuman: selection?.hasHuman ?? null,
    hasStrictSafetyMetadata,
    imageSubjectClass: selection?.imageSubjectClass ?? null,
    matchReason: selection?.matchReason ?? [],
    mode: selection?.mode ?? null,
    passed,
    score: selection?.score ?? null,
    selectedAssetId: selection?.asset.id ?? null,
    selectedBucketId: selection?.bucketId ?? null,
    selectedSourceQuery: selection?.asset.sourceQuery ?? null,
    skipped,
    slideHeadline: item.slide.headline,
    slideIntent: selection?.intent ?? null,
    slideNumber: item.slide.slideNumber,
    slideType: item.slide.slideType,
  };
});
const failedChecks = checks.filter((check) => !check.skipped && !check.passed);
const skippedChecks = checks.filter((check) => check.skipped);
const testableChecks = checks.filter((check) => !check.skipped);
const passedTestableChecks = testableChecks.filter((check) => check.passed);
const testableAccuracy =
  testableChecks.length > 0
    ? Number((passedTestableChecks.length / testableChecks.length).toFixed(4))
    : null;

console.log(
  JSON.stringify(
    {
      profile: profile.id,
      matcherVersion: CAROUSEL_RUNTIME_MATCHER_VERSION,
      safetyPolicyVersion: CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
      categorySlug,
      assetCount: assets.length,
      bucketCounts,
      caseCount: checks.length,
      checks,
      coveredTargetBuckets: Array.from(
        new Set(
          checks
            .filter((check) => !check.skipped)
            .map((check) => check.expectedBucketId),
        ),
      ),
      failedCount: failedChecks.length,
      missingTargetBuckets: Array.from(
        new Set(
          skippedChecks.map((check) => check.expectedBucketId),
        ),
      ),
      passedTestableCount: passedTestableChecks.length,
      skippedCount: skippedChecks.length,
      testableAccuracy,
      testableCount: testableChecks.length,
    },
    null,
    2,
  ),
);

if (failedChecks.length > 0 || (args["require-all"] === "true" && skippedChecks.length > 0)) {
  process.exitCode = 1;
}

async function listReadyAssets(categorySlug, bucketIds) {
  const { data, error } = await supabase
    .from("category_image_assets")
    .select(
      [
        "id",
        "base_s3_key",
        "base_url",
        "best_for_slide_types",
        "bucket_type",
        "content_tags",
        "face_count",
        "has_human",
        "image_subject_class",
        "image_query",
        "mood_tags",
        "person_count",
        "pexels_photographer",
        "primary_vertical",
        "source_query",
        "usage_count",
        "usable_verticals",
        "visual_bucket",
        "visual_setting",
        "visual_style",
      ].join(","),
    )
    .eq("category_slug", categorySlug)
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .eq("image_subject_class", "object-only")
    .eq("has_human", false)
    .eq("face_count", 0)
    .eq("person_count", 0)
    .in("visual_bucket", bucketIds)
    .order("usage_count", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(`Could not list ready assets: ${error.message}`);
  }

  return data ?? [];
}

function mapReadyAsset(row) {
  return {
    baseObjectKey: row.base_s3_key,
    baseUrl: row.base_url,
    bestForSlideTypes: row.best_for_slide_types,
    bucketType: row.bucket_type,
    contentTags: row.content_tags,
    faceCount: row.face_count,
    hasHuman: row.has_human,
    id: row.id,
    imageSubjectClass: row.image_subject_class,
    imageQuery: row.image_query,
    moodTags: row.mood_tags,
    pexelsPhotographer: row.pexels_photographer,
    personCount: row.person_count,
    primaryVertical: row.primary_vertical,
    sourceQuery: row.source_query,
    usageCount: row.usage_count,
    usableVerticals: row.usable_verticals,
    visualBucket: row.visual_bucket,
    visualSetting: row.visual_setting,
    visualStyle: row.visual_style,
  };
}

function countByBucket(assets) {
  return assets.reduce((counts, asset) => {
    const bucketId = asset.visualBucket || "unbucketed";
    counts[bucketId] = (counts[bucketId] ?? 0) + 1;

    return counts;
  }, {});
}

function getRoutingCases(profileId) {
  if (profileId !== "marketing-saas") {
    throw new Error(
      `Live intent routing cases are currently defined for marketing-saas only, got "${profileId}".`,
    );
  }

  return [
    {
      expectedBucketId: "calendar-overload",
      slide: mockSlide({
        headline: "Your content calendar is impossible to keep up with",
        slideNumber: 1,
        slideType: "problem",
        subtext:
          "Every launch needs another reminder, another deadline, and another schedule change.",
      }),
    },
    {
      expectedBucketId: "phone-notification",
      slide: mockSlide({
        headline: "Missed follow-ups are buried in phone alerts",
        slideNumber: 2,
        slideType: "problem",
        subtext:
          "Leads keep slipping between messages, reminders, and urgent notifications.",
      }),
    },
    {
      expectedBucketId: "desk-chaos",
      slide: mockSlide({
        headline: "Campaign work is scattered across a messy desk",
        slideNumber: 3,
        slideType: "problem",
        subtext:
          "Briefs, notes, and unfinished tasks pile up before every launch.",
      }),
    },
    {
      expectedBucketId: "laptop-desk",
      slide: mockSlide({
        headline: "Automate the campaign workflow in one AI platform",
        slideNumber: 4,
        slideType: "solution",
        subtext:
          "One dashboard handles planning, follow-up, and reporting.",
      }),
    },
    {
      expectedBucketId: "spreadsheet-chaos",
      slide: mockSlide({
        headline: "Manual reports still eat the whole afternoon",
        slideNumber: 5,
        slideType: "problem",
        subtext:
          "The team keeps cleaning the same spreadsheet before every meeting.",
      }),
    },
    {
      expectedBucketId: "team-meeting",
      slide: mockSlide({
        headline: "Give every campaign handoff one shared plan",
        slideNumber: 6,
        slideType: "solution",
        subtext:
          "Marketing, sales, and ops can collaborate without another status meeting.",
      }),
    },
    {
      expectedBucketId: "abstract-data",
      slide: mockSlide({
        headline: "Turn campaign data into a clear next step",
        slideNumber: 7,
        slideType: "solution",
        subtext:
          "Charts, dashboards, and reporting numbers stop feeling scattered.",
      }),
    },
    {
      expectedBucketId: "clean-still-life",
      slide: mockSlide({
        headline: "Start with one clean next step",
        slideNumber: 8,
        slideType: "cta",
        subtext: null,
      }),
    },
    {
      expectedBucketId: "phone-in-hand",
      slide: mockSlide({
        headline: "Check every new lead from the app",
        slideNumber: 9,
        slideType: "solution",
        subtext:
          "Open the phone, review the lead, and act before the follow-up goes cold.",
      }),
    },
    {
      expectedBucketId: "tired-couch",
      slide: mockSlide({
        headline: "You end the day drained by campaign busywork",
        slideNumber: 10,
        slideType: "problem",
        subtext:
          "The work follows you home because the process still depends on manual checks.",
      }),
    },
    {
      expectedBucketId: "laptop-work",
      slide: mockSlide({
        headline: "Review campaigns from any quiet workspace",
        slideNumber: 11,
        slideType: "benefit",
        subtext:
          "A flexible workflow keeps progress moving outside the office too.",
      }),
    },
    {
      expectedBucketId: "night-routine",
      slide: mockSlide({
        headline: "Late-night campaign checks should not be normal",
        slideNumber: 12,
        slideType: "problem",
        subtext:
          "Missed reminders and scattered tasks keep pulling you back after hours.",
      }),
    },
  ];
}

function mockSlide({ headline, slideNumber, slideType, subtext }) {
  return {
    ctaText: slideType === "cta" ? "Generate campaign" : null,
    headline,
    imageDirection: "Use a realistic image that matches the slide meaning.",
    layoutPreset: slideType === "hook" ? "top-hook" : "bottom-message",
    slideNumber,
    slideType,
    subtext,
    textPosition: slideType === "hook" ? "top" : "bottom",
  };
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] === undefined) {
      process.env[key] = cleanEnvValue(rawValue);
    }
  }
}

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}
