import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viralPage = readProjectFile("app/viral/page.tsx");
const nextConfig = readProjectFile("next.config.ts");
const workspaceRoutes = readProjectFile("lib/navigation/workspace-route.ts");
const viralWorkspace = readProjectFile("components/viral/viral-workspace.tsx");
const dashboardPage = readProjectFile("app/dashboard/page.tsx");
const sidebar = readProjectFile("components/layout/app-sidebar.tsx");
const directHookApi = readProjectFile("app/api/explore/hook-videos/route.ts");
const videoWorkspace = readProjectFile(
  "components/video/video-generation-workspace.tsx",
);
const videoGenerationApi = readProjectFile(
  "lib/ai-studio/video-generation-api.ts",
);

test("opens Explore without changing the separate Trending dashboard", () => {
  assert.doesNotMatch(nextConfig, /source: "\/viral\/:path\*"/);
  assert.match(viralPage, /<ViralWorkspace\s*\/>/);
  assert.doesNotMatch(viralPage, /ViralAccessGuard/);
  assert.match(dashboardPage, /<TrendingWorkspace\s*\/>/);
  assert.match(
    workspaceRoutes,
    /prefix: "\/dashboard", activeKey: "trending", access: "profile"/,
  );
  assert.match(
    workspaceRoutes,
    /prefix: "\/viral", activeKey: "explore", access: "profile"/,
  );
});

test("shows Explore after Analytics to every signed-in workspace user", () => {
  assert.match(sidebar, /label: "Analytics"[\s\S]*label: "Explore"/);
  assert.match(sidebar, /\.\.\.primaryNavigationItems,[\s\S]*exploreNavigationItem/);
  assert.doesNotMatch(sidebar, /useViralReviewerAccess/);
});

test("renders only direct Hook videos, not Instagram embeds or deferred formats", () => {
  assert.match(viralWorkspace, />\s*Hook Videos\s*</);
  assert.match(viralWorkspace, /<video/);
  assert.match(viralWorkspace, /object-cover/);
  assert.match(viralWorkspace, />\s*Recreate\s*</);
  assert.doesNotMatch(viralWorkspace, /Use This Hook/);
  assert.match(viralWorkspace, /sourceUrl: item\.videoUrl/);
  assert.match(viralWorkspace, /exploreRecreate: "1"/);
  assert.match(viralWorkspace, /useBillingSubscription\(\)/);
  assert.match(viralWorkspace, /Upgrade to Pro/);
  assert.match(viralWorkspace, /This Hook performed well on Instagram/);
  assert.match(viralWorkspace, /checkingPlan/);
  assert.match(viralWorkspace, /href=\{getHookStudioHref\(item\)\}/);
  assert.match(viralWorkspace, /href="\/pricing"/);
  assert.match(viralWorkspace, /autoPlay=\{autoPlay\}/);
  assert.match(viralWorkspace, /<ExploreHookVideoCard item=\{item\} autoPlay \/>/);
  assert.match(viralWorkspace, /if \(video\.ended\) \{\s*video\.currentTime = 0;/);
  assert.match(viralWorkspace, /onEnded=\{\(\) => \{\s*setHasEnded\(true\);/);
  assert.doesNotMatch(viralWorkspace, /<video[\s\S]*?\bloop\b/);
  assert.match(directHookApi, /preview: getExplorePreviewVideo\(\)/);
  assert.doesNotMatch(viralWorkspace, /InstagramEmbed|embed\.js|wall-of-text|slideshows|Hook timing/i);
  assert.doesNotMatch(viralWorkspace, /@\/components\/trending|@\/lib\/trending/);
});

test("requires an image only for an Explore Recreate and enforces it server-side", () => {
  assert.match(
    videoWorkspace,
    /hasExploreRecreateParam && referenceContext\?\.type === "hook"/,
  );
  assert.match(
    videoWorkspace,
    /isExploreRecreate && !activeReferenceImageUrl[\s\S]*?setReferenceImageRequiredDialogOpen\(true\)/,
  );
  assert.match(
    videoWorkspace,
    /allowedKinds=\{isExploreRecreate \? \["image"\] : \["image", "video"\]\}/,
  );
  assert.match(videoWorkspace, /Explore Recreate/);
  assert.match(videoWorkspace, /Image required/);
  assert.match(
    videoWorkspace,
    /Add a reference image to recreate this video/,
  );
  assert.match(videoGenerationApi, /isExploreHookVideoId\(body\?\.referenceId\)/);
  assert.match(videoGenerationApi, /isExploreRecreate && !avatarImageUrl/);
  assert.match(videoGenerationApi, /image-reference-only for better results/);
  assert.doesNotMatch(
    videoGenerationApi,
    /if \(!avatarImageUrl\) \{[\s\S]*?Add a reference image before recreating/,
  );
});

test("protects direct Explore video URLs behind the signed-in user check", () => {
  assert.match(directHookApi, /requireFirebaseUser\(request\)/);
  assert.doesNotMatch(directHookApi, /requireViralReviewer/);
  assert.match(directHookApi, /getMissingStorageEnvVars\(\)/);
  assert.match(directHookApi, /Cache-Control["']?: "no-store"/);
  assert.doesNotMatch(directHookApi, /supabase|viral_references|instagram/i);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
