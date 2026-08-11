import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TAG_SCRIPT = path.join(
  REPO_ROOT,
  "scripts",
  "tag-local-carousel-image-assets.mjs",
);
const IMPORT_SCRIPT = path.join(
  REPO_ROOT,
  "scripts",
  "import-local-carousel-image-assets.mjs",
);

test("review map approves and maps only the explicitly accepted file", () => {
  const fixture = createTagFixture();
  const result = runNode([
    TAG_SCRIPT,
    "--audit-report",
    fixture.auditPath,
    "--review-map",
    fixture.reviewPath,
    "--out-dir",
    fixture.outputRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = readLatestJson(fixture.outputRoot, "tag-manifest.json");

  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.skippedFiles.length, 1);
  assert.equal(manifest.assets[0].categorySlug, "productivity-saas");
  assert.equal(manifest.assets[0].broadVisualBucket, "notes-and-planning");
  assert.equal(manifest.assets[0].review.reviewStatus, "final_full_resolution_review");
  assert.equal(manifest.assets[0].review.decision, "approved");
  assert.equal(manifest.assets[0].sourcePerceptualHash, "0123456789abcdef");
  assert.ok(manifest.assets[0].contentTags.includes("kanban"));
  assert.ok(manifest.assets[0].objectTags.includes("whiteboard"));
  assert.ok(manifest.assets[0].objectTags.includes("planner"));
  assert.match(manifest.skippedFiles[0].reason, /visible_person/);
});

test("v2 tagging maps new source categories and preserves literal retrieval tags", () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ugc-carousel-tags-v2-"));
  const auditPath = path.join(fixtureRoot, "audit.json");
  const outputRoot = path.join(fixtureRoot, "tags");
  const sourceRoot = path.join(fixtureRoot, "source");
  mkdirSync(sourceRoot, { recursive: true });

  const recommendations = [
    createRecommendation({
      categorySlug: "marketing",
      fileName: "social_media_pexels_pack/01_instagram_screen.png",
      perceptualHash: "1111111111111111",
      rootPath: sourceRoot,
      sha256Hash: "1".repeat(64),
    }),
    createRecommendation({
      categorySlug: "beauty_skincare",
      fileName: "serum_carousel_images/serumbottle_drop.jpg",
      perceptualHash: "2222222222222222",
      rootPath: sourceRoot,
      sha256Hash: "2".repeat(64),
    }),
    createRecommendation({
      categorySlug: "personal_finance",
      fileName: "ChatGPT Image Aug 10, 2026, 06_14_00 PM (6).png",
      perceptualHash: "3333333333333333",
      rootPath: sourceRoot,
      sha256Hash: "3".repeat(64),
    }),
  ];
  writeFileSync(
    auditPath,
    `${JSON.stringify(
      { nearDuplicateGroups: [], originalCropPairs: [], recommendations },
      null,
      2,
    )}\n`,
  );

  const result = runNode([
    TAG_SCRIPT,
    "--audit-report",
    auditPath,
    "--manual-review-approved",
    "--out-dir",
    outputRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = readLatestJson(outputRoot, "tag-manifest.json");
  const marketing = manifest.assets.find(
    (asset) => asset.sourceLocalCategorySlug === "marketing",
  );
  const beauty = manifest.assets.find(
    (asset) => asset.sourceLocalCategorySlug === "beauty_skincare",
  );
  const finance = manifest.assets.find(
    (asset) => asset.sourceLocalCategorySlug === "personal_finance",
  );

  assert.equal(marketing.categorySlug, "marketing-saas");
  assert.equal(marketing.broadVisualBucket, "phone-and-devices");
  assert.ok(marketing.contentTags.includes("instagram"));
  assert.ok(marketing.objectTags.includes("smartphone"));
  assert.equal(beauty.categorySlug, "beauty-skincare");
  assert.ok(beauty.contentTags.includes("serum"));
  assert.ok(beauty.objectTags.includes("serumbottle"));
  assert.equal(finance.categorySlug, "personal-finance");
  assert.equal(finance.broadVisualBucket, "phone-and-devices");
  assert.ok(finance.contentTags.includes("expense-tracking"));
  assert.ok(finance.objectTags.includes("calculator"));
});

test("review map fails closed when an audited file has no decision", () => {
  const fixture = createTagFixture();
  const reviewMap = JSON.parse(readFileSync(fixture.reviewPath, "utf8"));
  reviewMap.rejected = [];
  writeFileSync(fixture.reviewPath, `${JSON.stringify(reviewMap, null, 2)}\n`);

  const result = runNode([
    TAG_SCRIPT,
    "--audit-report",
    fixture.auditPath,
    "--review-map",
    fixture.reviewPath,
    "--out-dir",
    fixture.outputRoot,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing audit files/i);
});

test("import dry-run validates a prepared package without storage credentials or writes", () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ugc-carousel-import-"));
  const manifestPath = path.join(fixtureRoot, "import-manifest.json");

  for (const fileName of ["base.webp", "thumb.webp", "original.jpg"]) {
    writeFileSync(path.join(fixtureRoot, fileName), "fixture");
  }

  const dbRow = {
    base_s3_key:
      "category-library/productivity-saas/notes-and-planning/test/base-1080x1350.webp",
    category_slug: "productivity-saas",
    face_count: 0,
    has_human: false,
    image_subject_class: "object-only",
    person_count: 0,
    runtime_exclusion_reason: null,
    source_file_sha256: "a".repeat(64),
    source_original_s3_key:
      "category-library/productivity-saas/notes-and-planning/test/original.jpg",
    source_perceptual_hash: "0123456789abcdef",
    source_provider: "local",
    status: "ready",
    subject_review_status: "approved",
    thumb_s3_key:
      "category-library/productivity-saas/notes-and-planning/test/thumb-320x400.webp",
  };
  const manifest = {
    assets: [
      {
        assetKey: "productivity-saas/test",
        broadVisualBucket: "notes-and-planning",
        categorySlug: "productivity-saas",
        dbRow,
        files: {
          base: "base.webp",
          original: "original.jpg",
          thumb: "thumb.webp",
        },
        storage: {
          baseKey: dbRow.base_s3_key,
          originalKey: dbRow.source_original_s3_key,
          thumbKey: dbRow.thumb_s3_key,
        },
        sourceLocalCategorySlug: "slideshows_review",
      },
    ],
    errors: [],
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = runNode([
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--experimental-strip-types",
    IMPORT_SCRIPT,
    "--manifest",
    manifestPath,
    "--dry-run",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /No object-storage upload or Supabase write/);
});

function createTagFixture() {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ugc-carousel-review-"));
  const sourceRoot = path.join(fixtureRoot, "source");
  const outputRoot = path.join(fixtureRoot, "tags");
  const auditPath = path.join(fixtureRoot, "audit.json");
  const reviewPath = path.join(fixtureRoot, "review.json");
  mkdirSync(sourceRoot, { recursive: true });

  const recommendations = [
    createRecommendation({
      fileName: "pexels_whiteboards_10/01_kanban_whiteboard.jpg",
      perceptualHash: "0123456789abcdef",
      rootPath: sourceRoot,
      sha256Hash: "a".repeat(64),
    }),
    createRecommendation({
      fileName: "rejected.jpg",
      perceptualHash: "fedcba9876543210",
      rootPath: sourceRoot,
      sha256Hash: "b".repeat(64),
    }),
  ];
  writeFileSync(
    auditPath,
    `${JSON.stringify(
      {
        nearDuplicateGroups: [],
        originalCropPairs: [],
        recommendations,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    reviewPath,
    `${JSON.stringify(
      {
        approvedGroups: [
          {
            broadVisualBucket: "notes-and-planning",
            contentTags: ["productivity", "planning"],
            files: ["pexels_whiteboards_10/01_kanban_whiteboard.jpg"],
            moodTags: ["focused"],
            objectTags: ["planner"],
            runtimeCategory: "productivity-saas",
          },
        ],
        rejected: [{ file: "rejected.jpg", reason: "visible_person" }],
        reviewStatus: "final_full_resolution_review",
        sourceFolder: sourceRoot,
        summary: {
          approvedCandidates: 1,
          files: 2,
          rejected: 1,
        },
      },
      null,
      2,
    )}\n`,
  );

  return {
    auditPath,
    outputRoot,
    reviewPath,
  };
}

function createRecommendation({
  categorySlug = "productivity",
  fileName,
  perceptualHash,
  rootPath,
  sha256Hash,
}) {
  return {
    averageHash: perceptualHash,
    categorySlug,
    fileName,
    fileSizeBytes: 1024,
    height: 1350,
    perceptualHash,
    qualityWarnings: ["carousel_render_size"],
    reason: "Carousel-sized image without matching original.",
    recommendation: "cropped_only_candidate",
    relativePath: fileName,
    rootPath,
    sha256Hash,
    textSafeAreaHint: ["top", "bottom"],
    topFolder: "(root)",
    width: 1080,
  };
}

function readLatestJson(root, fileName) {
  const latestDirectory = readdirSync(root)
    .sort()
    .at(-1);

  assert.ok(latestDirectory);
  return JSON.parse(
    readFileSync(path.join(root, latestDirectory, fileName), "utf8"),
  );
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      STORAGE_PROVIDER: "",
      UGC_STORAGE_PROVIDER: "",
    },
  });
}
