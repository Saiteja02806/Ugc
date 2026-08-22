import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viralPage = readProjectFile("app/viral/page.tsx");
const workspaceRouteBoundary = readProjectFile(
  "components/layout/workspace-route-boundary.tsx",
);
const workspaceRoutes = readProjectFile("lib/navigation/workspace-route.ts");
const viralAccessGuard = readProjectFile(
  "components/viral/viral-access-guard.tsx",
);
const viralAccessQuery = readProjectFile(
  "components/viral/use-viral-reviewer-access.ts",
);
const viralWorkspace = readProjectFile("components/viral/viral-workspace.tsx");
const dashboardPage = readProjectFile("app/dashboard/page.tsx");
const sidebar = readProjectFile("components/layout/app-sidebar.tsx");

test("keeps Viral on a separate route while Dashboard remains Trending", () => {
  assert.match(viralPage, /<ViralWorkspace \/>/);
  assert.match(dashboardPage, /<TrendingWorkspace \/>/);
  assert.match(
    workspaceRoutes,
    /prefix: "\/dashboard", activeKey: "trending", access: "profile"/,
  );
  assert.match(
    workspaceRoutes,
    /prefix: "\/viral", activeKey: "viral", access: "reviewer"/,
  );
});

test("keeps the Viral route authenticated and restricted to Explore reviewers", () => {
  assert.match(
    workspaceRouteBoundary,
    /requireAuthentication=\{route\.access !== "none"\}/,
  );
  assert.match(
    workspaceRouteBoundary,
    /route\.access === "reviewer"[\s\S]*<ViralAccessGuard>\{children\}<\/ViralAccessGuard>/,
  );
  assert.match(
    workspaceRouteBoundary,
    /<AppShell[\s\S]*>\s*\{guardedContent\}\s*<\/AppShell>/,
  );
  assert.doesNotMatch(
    workspaceRouteBoundary,
    /<ViralAccessGuard>\{shell\}<\/ViralAccessGuard>/,
  );
  assert.match(viralAccessGuard, /useViralReviewerAccessQuery\(\)/);
  assert.match(viralAccessGuard, /accessState === "reviewer"/);
  assert.match(viralAccessGuard, /accessState === "unavailable"/);
  assert.match(viralAccessGuard, /Explore reviewer access is not configured/);
  assert.doesNotMatch(viralAccessGuard, /useAIStudioAccess/);
  assert.match(viralAccessGuard, /accessState === "locked"/);
  assert.match(viralAccessGuard, /router\.replace\("\/dashboard"\)/);
  assert.match(viralAccessQuery, /\["viral-reviewer-access", user\?\.uid/);
  assert.match(viralAccessQuery, /refetchOnWindowFocus: false/);
  assert.doesNotMatch(viralAccessGuard, /window\.location\.reload/);
});

test("shows Explore navigation only after its reviewer check succeeds", () => {
  assert.match(sidebar, /key: "viral"/);
  assert.match(sidebar, /label: "Explore"/);
  assert.match(sidebar, /href: "\/viral"/);
  assert.match(sidebar, /reviewerOnly: true/);
  assert.match(sidebar, /viralReviewerAccessState === "reviewer"/);
  assert.match(sidebar, /!item\.reviewerOnly \|\| showReviewerOnlyItems/);
  assert.doesNotMatch(sidebar, /proOnly: true/);
  assert.match(
    sidebar,
    /key: "analytics"[\s\S]*?key: "viral"/,
  );
});

test("presents the Viral route with Explore product naming", () => {
  assert.match(viralPage, /title: "Explore"/);
  assert.match(viralWorkspace, />\s*Explore\s*</);
  assert.doesNotMatch(viralWorkspace, />\s*Viral\s*</);
});

test("supports Hook Videos, Wall of Text, and Slideshows sections", () => {
  assert.match(viralWorkspace, />\s*Hook Videos\s*</);
  assert.match(
    viralWorkspace,
    /value="wall-of-text"[\s\S]*?>\s*Wall of Text\s*</,
  );
  assert.match(
    viralWorkspace,
    /value="slideshows"[\s\S]*?>\s*Slideshows\s*</,
  );
});

test("does not couple the Viral scaffold to Trending or generation systems", () => {
  const viralSources = [
    viralPage,
    workspaceRouteBoundary,
    viralAccessGuard,
    viralWorkspace,
  ]
    .join("\n")
    .toLowerCase();

  assert.doesNotMatch(viralSources, /components\/trending|lib\/trending|api\/trending/);
  assert.doesNotMatch(viralSources, /generate|replicat|worker|trigger\.dev/);
  assert.match(viralWorkspace, /\/api\/admin\/viral\/review/);
  assert.doesNotMatch(viralWorkspace, /axios|supabase/i);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
