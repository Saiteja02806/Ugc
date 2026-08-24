import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { getWorkspaceRouteConfig } from "../navigation/workspace-route.ts";
import { hasAuthSessionCookie } from "../firebase/auth-session.ts";

const projectRoot = new URL("../../", import.meta.url);
const carouselLibrary = readProjectFile(
  "components/library/library-workspace.tsx",
);
const editLibrary = readProjectFile("lib/edit/video-library.ts");
const editE2ESeed = readProjectFile(
  "components/e2e/edit-render-e2e-seed.tsx",
);
const queryProvider = readProjectFile(
  "components/providers/job-query-provider.tsx",
);
const rootLayout = readProjectFile("app/layout.tsx");
const landingPage = readProjectFile("app/page.tsx");
const landingAuthActions = readProjectFile(
  "components/marketing/landing-auth-actions.tsx",
);
const signInPage = readProjectFile("app/sign-in/page.tsx");
const authGuard = readProjectFile("components/auth/auth-guard.tsx");
const workspaceRouteBoundary = readProjectFile(
  "components/layout/workspace-route-boundary.tsx",
);
const aiStudioAccess = readProjectFile(
  "components/generation/use-ai-studio-access.ts",
);
const workspaceContentLoading = readProjectFile(
  "components/layout/workspace-content-loading.tsx",
);
const disabledViralLoading = readProjectFile("app/viral/loading.tsx");
const workspaceLoadingRoutes = [
  "app/dashboard/loading.tsx",
  "app/ai-studio/loading.tsx",
  "app/analytics/loading.tsx",
  "app/library/loading.tsx",
  "app/scheduling/loading.tsx",
  "app/settings/loading.tsx",
  "app/avatars/loading.tsx",
] as const;

test("owner-created content has no global browser-storage fallback", () => {
  assert.doesNotMatch(carouselLibrary, /local-library|localStorage|storageSource/);
  assert.doesNotMatch(editLibrary, /localStorage|editable-videos/);
  assert.doesNotMatch(editE2ESeed, /editable-videos/);
  assert.equal(existsSync(new URL("lib/carousel/local-library.ts", projectRoot)), false);
  assert.equal(
    existsSync(new URL("lib/scheduling/local-storage.ts", projectRoot)),
    false,
  );
});

test("retired global content is deleted without being imported into an account", () => {
  assert.match(rootLayout, /ugc-studio\.carousel-library\.v1/);
  assert.match(rootLayout, /ugc-studio\.schedule-drafts\.v1/);
  assert.match(rootLayout, /ugc-studio\.editable-videos\.v1/);
  assert.match(rootLayout, /window\.localStorage\.removeItem\(key\)/);
  assert.doesNotMatch(rootLayout, /window\.localStorage\.getItem\(key\)/);
  assert.match(rootLayout, /strategy="beforeInteractive"/);
});

test("changing Firebase users creates a fresh application cache and subtree", () => {
  assert.match(queryProvider, /const \{ user \} = useAuth\(\)/);
  assert.match(
    queryProvider,
    /<AccountQueryClientProvider key=\{user\?\.uid \?\? "signed-out"\}>/,
  );
});

test("landing auth CTAs receive an exact server-rendered session hint", () => {
  assert.equal(hasAuthSessionCookie("ugc_session=1"), true);
  assert.equal(
    hasAuthSessionCookie("theme=dark; ugc_session=1; preference=compact"),
    true,
  );
  assert.equal(hasAuthSessionCookie("not_ugc_session=1"), false);
  assert.equal(hasAuthSessionCookie("ugc_session=10"), false);
  assert.match(landingPage, /await cookies\(\)/);
  assert.match(landingPage, /initialHasSession=\{initialHasSession\}/);
  assert.match(landingAuthActions, /initialHasSession \|\| hasSessionCookie\(\)/);
});

test("the persistent workspace shell preserves the existing route access matrix", () => {
  assert.deepEqual(getWorkspaceRouteConfig("/dashboard"), {
    access: "profile",
    activeKey: "trending",
    defaultSidebarCollapsed: false,
  });
  assert.deepEqual(getWorkspaceRouteConfig("/library/demos/demo-1/edit"), {
    access: "profile",
    activeKey: "library",
    defaultSidebarCollapsed: true,
  });
  assert.equal(getWorkspaceRouteConfig("/viral"), null);
  assert.deepEqual(getWorkspaceRouteConfig("/avatars"), {
    access: "none",
    activeKey: "avatars",
    defaultSidebarCollapsed: false,
  });
  assert.equal(getWorkspaceRouteConfig("/onboarding"), null);
  assert.equal(getWorkspaceRouteConfig("/sign-in"), null);
});

test("the sign-in plan query is isolated behind a production Suspense boundary", () => {
  assert.match(signInPage, /<Suspense fallback=\{<DefaultSignInContext \/>\}>/);
  assert.match(
    signInPage,
    /function SelectedPlanContext\(\)[\s\S]*useSearchParams\(\)/,
  );
  assert.match(signInPage, /<SelectedPlanContext \/>/);
});

test("profile access checks are reused only inside the active Firebase account", () => {
  assert.match(rootLayout, /<WorkspaceRouteBoundary>\{children\}<\/WorkspaceRouteBoundary>/);
  assert.match(
    workspaceRouteBoundary,
    /requireAuthentication=\{route\.access !== "none"\}/,
  );
  assert.match(
    workspaceRouteBoundary,
    /requireBusinessProfile=\{route\.access === "profile"\}/,
  );
  assert.match(authGuard, /if \(!requireAuthentication\)/);
  assert.match(authGuard, /getBusinessProfileGateQueryKey\(user\?\.uid/);
  assert.match(authGuard, /BUSINESS_PROFILE_GATE_STALE_TIME_MS/);
  assert.match(authGuard, /refetchOnWindowFocus: false/);
});

test("AI Studio access is cached only inside the active Firebase account", () => {
  assert.match(aiStudioAccess, /useQuery\(\{/);
  assert.match(
    aiStudioAccess,
    /queryKey: \["ai-studio-access", user\?\.uid \?\? "signed-out"\]/,
  );
  assert.match(aiStudioAccess, /enabled: !loading && Boolean\(user\)/);
  assert.match(aiStudioAccess, /AI_STUDIO_ACCESS_STALE_TIME_MS/);
  assert.match(aiStudioAccess, /refetchOnWindowFocus: false/);
  assert.doesNotMatch(aiStudioAccess, /useEffect|useState/);
});

test("workspace routes stream content loading UI beneath the persistent shell", () => {
  assert.match(workspaceContentLoading, /aria-busy="true"/);
  assert.match(workspaceContentLoading, /role="status"/);
  assert.match(workspaceContentLoading, /WorkspaceContentLoading/);
  assert.doesNotMatch(
    workspaceContentLoading,
    /AppShell|AppSidebar|AuthGuard|min-h-dvh/,
  );

  for (const route of workspaceLoadingRoutes) {
    const loadingBoundary = readProjectFile(route);

    assert.match(loadingBoundary, /<WorkspaceContentLoading label=/);
    assert.doesNotMatch(loadingBoundary, /AppShell|AppSidebar|AuthGuard/);
  }

  assert.match(disabledViralLoading, /return null/);
  assert.doesNotMatch(disabledViralLoading, /Explore|WorkspaceContentLoading/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(relativePath, projectRoot), "utf8");
}
