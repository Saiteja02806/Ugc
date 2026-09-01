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

test("renders direct Explore videos with the Recreate action", () => {
  assert.match(workspace, /\/api\/explore\/hook-videos/);
  assert.match(workspace, /<video/);
  assert.match(workspace, /object-cover/);
  assert.match(workspace, />\s*Recreate\s*</);
  assert.match(workspace, /exploreRecreate: "1"/);
  assert.match(workspace, /sourceUrl: item\.videoUrl/);
  assert.doesNotMatch(
    workspace,
    /instagram\.com\/embed\.js|InstagramEmbed|dangerouslySetInnerHTML/i,
  );
  assert.doesNotMatch(workspace, /Hook timing|Needs timing|Hook ends at/);
  assert.doesNotMatch(workspace, /Save ending time|More options/);
});

test("keeps the direct video and Hook action inside one compact card", () => {
  assert.match(
    workspace,
    /overflow-hidden rounded-xl border border-border bg-card shadow-sm/,
  );
  assert.match(workspace, /relative aspect-\[9\/16\] overflow-hidden bg-card-muted/);
  assert.match(workspace, /border-t border-border bg-card p-2/);
});

test("keeps the review implementation outside Trending and generation systems", () => {
  for (const source of [listRoute, saveRoute, reviewStore, workspace, reviewCard]) {
    assert.doesNotMatch(source, /@\/lib\/trending|@\/components\/trending/);
    assert.doesNotMatch(source, /generateHook|generation orchestrator/i);
  }
});
