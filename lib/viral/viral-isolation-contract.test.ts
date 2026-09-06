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
const directWallTextApi = readProjectFile(
  "app/api/explore/wall-text-videos/route.ts",
);
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

test("renders direct Hook and Wall of Text libraries without Instagram embeds", () => {
  assert.match(viralWorkspace, /label: "Hook Videos"/);
  assert.match(viralWorkspace, /label: "Wall of Text"/);
  assert.match(viralWorkspace, /role="tablist"/);
  assert.match(viralWorkspace, /\/api\/explore\/hook-videos/);
  assert.match(viralWorkspace, /\/api\/explore\/wall-text-videos/);
  assert.match(viralWorkspace, /<video/);
  assert.match(viralWorkspace, /object-cover/);
  assert.match(viralWorkspace, />\s*Recreate\s*</);
  assert.doesNotMatch(viralWorkspace, /Use This Hook/);
  assert.match(viralWorkspace, /sourceUrl: item\.videoUrl/);
  assert.match(viralWorkspace, /exploreRecreate: "1"/);
  assert.match(viralWorkspace, /referenceType: "hook"/);
  assert.match(viralWorkspace, /referenceType: "wall_text"/);
  assert.match(viralWorkspace, /useBillingSubscription\(\)/);
  assert.match(viralWorkspace, /Upgrade to Pro/);
  assert.match(viralWorkspace, /This Hook performed well on Instagram/);
  assert.match(viralWorkspace, /checkingPlan/);
  assert.match(viralWorkspace, /href=\{getExploreStudioHref\(item, section\)\}/);
  assert.match(viralWorkspace, /href="\/pricing"/);
  assert.match(viralWorkspace, /autoPlay=\{autoPlay\}/);
  assert.match(
    viralWorkspace,
    /<ExploreVideoCard item=\{item\} section=\{section\} autoPlay \/>/,
  );
  assert.match(viralWorkspace, /if \(video\.ended\) \{\s*video\.currentTime = 0;/);
  assert.match(viralWorkspace, /onEnded=\{\(\) => \{\s*setHasEnded\(true\);/);
  assert.doesNotMatch(viralWorkspace, /<video[\s\S]*?\bloop\b/);
  assert.match(directHookApi, /preview: getExplorePreviewVideo\(\)/);
  assert.match(directWallTextApi, /preview: getExploreWallTextPreviewVideo\(\)/);
  assert.doesNotMatch(viralWorkspace, /InstagramEmbed|embed\.js|slideshows|Hook timing/i);
  assert.doesNotMatch(viralWorkspace, /@\/components\/trending|@\/lib\/trending/);
});

test("keeps four compact Explore cards across standard laptop widths", () => {
  assert.match(
    viralWorkspace,
    /const EXPLORE_VIDEO_GRID_CLASS_NAME =[\s\S]*?lg:grid-cols-4/,
  );
  assert.match(
    viralWorkspace,
    /min-\[440px\]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4/,
  );
  assert.match(
    viralWorkspace,
    /className=\{EXPLORE_VIDEO_GRID_CLASS_NAME\}/,
  );
  assert.doesNotMatch(
    viralWorkspace,
    /repeat\(auto-fill,minmax\(220px,280px\)\)/,
  );
});

test("keeps Explore media loading bounded and its library tabs rounded", () => {
  assert.match(viralWorkspace, /rounded-\[18px\][\s\S]*?p-1\.5/);
  assert.match(viralWorkspace, /rounded-\[13px\]/);
  assert.match(
    viralWorkspace,
    /const EXPLORE_BACKDROP_VIDEO_LIMIT = 4/,
  );
  assert.match(
    viralWorkspace,
    /previewItems\.slice\(0, EXPLORE_BACKDROP_VIDEO_LIMIT\)\.map/,
  );
  assert.match(viralWorkspace, /IntersectionObserver/);
  assert.match(
    viralWorkspace,
    /rootMargin: EXPLORE_VIDEO_PRELOAD_ROOT_MARGIN/,
  );
  assert.match(viralWorkspace, /shouldLoadVideo \? \(/);
});

test("requires an image for Hook and Wall of Text Explore recreations", () => {
  assert.match(
    videoWorkspace,
    /refTypeParam === "hook" \|\| refTypeParam === "wall_text"/,
  );
  assert.match(
    videoWorkspace,
    /referenceContext\?\.type === "hook" \|\| referenceContext\?\.type === "wall_text"/,
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
  assert.match(videoGenerationApi, /isExploreWallTextVideoId\(body\?\.referenceId\)/);
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
