import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const listRoute = readFileSync("app/api/admin/viral/review/route.ts", "utf8");
const accessRoute = readFileSync(
  "app/api/admin/viral/access/route.ts",
  "utf8",
);
const saveRoute = readFileSync(
  "app/api/admin/viral/[referenceId]/review/route.ts",
  "utf8",
);
const reviewStore = readFileSync("lib/viral/review-store.ts", "utf8");
const workspace = readFileSync("components/viral/viral-workspace.tsx", "utf8");
const reviewCard = readFileSync(
  "components/viral/hook-review-card.tsx",
  "utf8",
);
const instagramEmbed = readFileSync(
  "components/viral/instagram-embed.tsx",
  "utf8",
);

test("protects every private Viral review endpoint with approved-email access", () => {
  assert.match(accessRoute, /requireViralReviewer\(request\)/);
  assert.match(listRoute, /requireViralReviewer\(request\)/);
  assert.match(saveRoute, /requireViralReviewer\(request\)/);
  assert.doesNotMatch(listRoute, /requireAIStudioProUser/);
  assert.doesNotMatch(saveRoute, /requireAIStudioProUser/);
  assert.match(accessRoute, /Cache-Control["']?: "no-store"/);
  assert.match(listRoute, /Cache-Control["']?: "no-store"/);
  assert.match(saveRoute, /Cache-Control["']?: "no-store"/);
});

test("returns a bounded cursor page and only necessary private review fields", () => {
  assert.match(reviewStore, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(reviewStore, /\.limit\(limit \+ 1\)/);
  assert.match(reviewStore, /query = query\.gt\("id", params\.cursor\)/);
  assert.doesNotMatch(workspace, /reviewedBy|verificationFailures|editorRank/);
});

test("saves only the fixed-zero Hook ending boundary", () => {
  assert.match(saveRoute, /normalizeHookEndSeconds/);
  assert.match(reviewStore, /\.from\("viral_hook_config"\)[\s\S]*\.upsert\(/);
  assert.match(reviewStore, /hookStartMs: 0/);
  assert.doesNotMatch(reviewStore, /replication_blueprint|generation_ready/);
  assert.doesNotMatch(saveRoute, /publish_status.*published/);
});

test("renders trusted stored embeds lazily and keeps future actions disabled", () => {
  assert.match(workspace, /https:\/\/www\.instagram\.com\/embed\.js/);
  assert.match(workspace, /onError=\{\(\) => setSdkState\("error"\)\}/);
  assert.match(instagramEmbed, /IntersectionObserver/);
  assert.match(instagramEmbed, /EMBED_LOAD_TIMEOUT_MS/);
  assert.match(instagramEmbed, /Video preview did not load/);
  assert.match(instagramEmbed, /dangerouslySetInnerHTML/);
  assert.match(reviewCard, />\s*Use This Hook\s*</);
  assert.match(reviewCard, /Use This Hook[\s\S]*disabled/);
});

test("presents Hook references as plain video-first review cards", () => {
  assert.doesNotMatch(reviewCard, /getInstagramReelShortcode/);
  assert.doesNotMatch(reviewCard, /Open on Instagram/);
  assert.doesNotMatch(reviewCard, /Reel \{shortcode\}/);
  assert.match(instagramEmbed, /aspect-\[9\/16\]/);
  assert.match(instagramEmbed, /VIDEO_HORIZONTAL_CROP/);
  assert.match(reviewCard, />\s*Hook timing\s*</);
});

test("keeps the review implementation outside Trending and generation systems", () => {
  for (const source of [listRoute, saveRoute, reviewStore, workspace, reviewCard]) {
    assert.doesNotMatch(source, /@\/lib\/trending|@\/components\/trending/);
    assert.doesNotMatch(source, /generateHook|generation orchestrator/i);
  }
});
