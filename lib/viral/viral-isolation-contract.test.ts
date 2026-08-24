import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viralPage = readProjectFile("app/viral/page.tsx");
const nextConfig = readProjectFile("next.config.ts");
const workspaceRouteBoundary = readProjectFile(
  "components/layout/workspace-route-boundary.tsx",
);
const workspaceRoutes = readProjectFile("lib/navigation/workspace-route.ts");
const viralAccessGuard = readProjectFile(
  "components/viral/viral-access-guard.tsx",
);
const viralWorkspace = readProjectFile("components/viral/viral-workspace.tsx");
const dashboardPage = readProjectFile("app/dashboard/page.tsx");
const sidebar = readProjectFile("components/layout/app-sidebar.tsx");

test("redirects the unfinished Explore route while Dashboard remains Trending", () => {
  assert.match(
    nextConfig,
    /source: "\/viral\/:path\*"[\s\S]*destination: "\/dashboard"[\s\S]*permanent: false/,
  );
  assert.match(viralPage, /import \{ redirect \} from "next\/navigation"/);
  assert.match(viralPage, /redirect\("\/dashboard"\)/);
  assert.doesNotMatch(viralPage, /ViralWorkspace/);
  assert.match(dashboardPage, /<TrendingWorkspace \/>/);
  assert.match(
    workspaceRoutes,
    /prefix: "\/dashboard", activeKey: "trending", access: "profile"/,
  );
  assert.doesNotMatch(workspaceRoutes, /prefix: "\/viral"/);
});

test("keeps Explore access checks out of the production workspace shell", () => {
  assert.match(
    workspaceRouteBoundary,
    /requireAuthentication=\{route\.access !== "none"\}/,
  );
  assert.doesNotMatch(workspaceRouteBoundary, /ViralAccessGuard|reviewer/);
  assert.doesNotMatch(
    sidebar,
    /useViralReviewerAccess|viralReviewerAccessState|reviewerOnly|showReviewerOnlyItems/,
  );
  assert.doesNotMatch(sidebar, /key: "viral"|label: "Explore"|href: "\/viral"/);

  const productionShellSources = [
    sidebar,
    workspaceRouteBoundary,
    workspaceRoutes,
    viralPage,
  ].join("\n");

  assert.doesNotMatch(
    productionShellSources,
    /viral-reviewer-access|api\/admin\/viral\/access/,
  );
});

test("retains the dormant workspace for future development", () => {
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
