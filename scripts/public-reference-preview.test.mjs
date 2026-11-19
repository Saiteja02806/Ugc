import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as query from "@tanstack/react-query";
import * as publicFeed from "../lib/explore/public-reference-preview.ts";
import * as feed from "../lib/explore/video-reference-feed.ts";
import * as types from "../lib/explore/recreate-types.ts";
import { GET } from "../app/api/explore/public-reference-preview/route.ts";

const jsx = (type, props) => ({ type, props });
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
function load(file, imports, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Response, require: key => { assert.ok(key in imports, key); return imports[key]; }, ...extra });
  return exports;
}

test("only exact public discovery routes bypass the signed-out route guard", () => {
  for (const [path, workflow] of [["hook-video", "hook"], ["create-hook", "talking_head"], ["wall-of-text", "wall_text"], ["slideshows", "slideshow"]]) {
    assert.equal(publicFeed.publicReferenceWorkflow(`/explore/${path}`), workflow);
    assert.equal(publicFeed.publicReferenceWorkflow(`/explore/${path}/`), workflow);
    assert.equal(publicFeed.publicReferenceWorkflow(`/explore/${path}/private`), null);
  }
  for (const path of ["/explore", "/library", "/explore/build-character", "/explore/edit", "/settings", "/explore/HOOK-video"]) assert.equal(publicFeed.publicReferenceWorkflow(path), null);
});

test("public endpoint returns twelve fixed published references per workflow and strips private generation metadata", async () => {
  for (const workflow of publicFeed.PUBLIC_REFERENCE_WORKFLOWS) {
    const response = GET(new Request(`https://app.test/api/explore/public-reference-preview?workflow=${workflow}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.items.length, 12, workflow);
    if (workflow === "talking_head") {
      assert.ok(!body.items.some(item => item.id === "talking-studywithsab"));
      const long = body.items.filter(item => item.durationSeconds > 4 && item.id !== "talking-mug-story");
      assert.ok(long.length > 0);
      for (const item of long) {
        const playback = types.referencePlayback(item);
        assert.ok(playback.url?.includes("/previews/hook-only/"), item.id);
        assert.equal(playback.fallbackUrl, undefined);
      }
    } else {
      assert.ok(body.items.every(item => !item.hookPreviewVideoUrl));
    }
    for (const item of body.items) {
      for (const privateKey of ["generationPrompt", "legacyGenerationPrompt", "startingImagePrompt", "sourceSha256", "creatorAccountId", "startingFrame", "pairedAudio", "archived"]) assert.equal(privateKey in item, false, `${workflow}: ${privateKey}`);
      assert.ok(!JSON.stringify(item).includes("/api/explore/creator-media/"));
      assert.ok(item.posterUrl);
      assert.ok(item.videoUrl || item.slides.length);
      for (const slide of item.slides) assert.equal("generationUrl" in slide, false);
    }
    const rotated = await GET(new Request(`https://app.test/api/explore/public-reference-preview?workflow=${workflow}&page=2&offset=10&sort=lowest&category=other`)).json();
    assert.deepEqual(rotated.items, body.items, "query parameters cannot rotate preview membership");
    if (workflow === "hook" || workflow === "talking_head") assert.deepEqual(body.items, feed.sortReferenceViews(body.items));
  }
  for (const workflow of ["", "private", "HOOK", "../../library"]) assert.equal(GET(new Request(`https://app.test/api/explore/public-reference-preview?workflow=${workflow}`)).status, 400);
});

test("public projection excludes archived/private/removed references and nested generation URLs", () => {
  const item = { id: "sample", title: "sample", format: "hook", category: null, categoryLabel: null, posterUrl: "/poster.png", sourceUrl: "https://www.tiktok.com/@creator/video/123", viewCount: 10, generationPrompt: "private", slides: [{ id: "s", url: "/preview.png", generationUrl: "private", width: 1, height: 2 }] };
  const result = publicFeed.publicReferencePreview([{ ...item, archived: true }, { ...item, creatorAccountId: "private" }, item], "hook");
  assert.equal(result.length, 1);
  assert.equal("generationPrompt" in result[0], false);
  assert.equal("generationUrl" in result[0].slides[0], false);
  assert.equal(item.generationPrompt, "private");
});

test("existing full catalogs still reject anonymous requests before catalog access", async () => {
  class FirebaseAuthRequestError extends Error { status = 401; }
  const deny = { FirebaseAuthRequestError, requireFirebaseUser: async () => { throw new FirebaseAuthRequestError("Sign in"); } };
  const forbidden = () => { assert.fail("Anonymous requests must not read the full catalog"); };
  for (const file of ["recreate-references", "talking-head-references"]) {
    const loaded = load(`app/api/explore/${file}/route.ts`, {
      "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
      "@/lib/firebase/server-auth": deny,
      "@/lib/explore/recreate-catalog": { getRecreateReferences: forbidden, getArchivedHookReferences: forbidden },
      "@/lib/explore/talking-head-reference-catalog": { getTalkingHeadReferences: forbidden },
    });
    const response = await loaded.GET(new Request(`https://app.test/api/explore/${file}`));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).ok, false);
  }
});

test("actual boundary keeps loading, signed-in users, and private routes on their existing AuthGuard path", () => {
  let state = { user: null, loading: false }, pathname = "/explore/hook-video";
  const { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute } = load("lib/navigation/workspace-route.ts", {});
  const { WorkspaceRouteBoundary } = load("components/layout/workspace-route-boundary.tsx", {
    react: { useEffect() {} }, "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { usePathname: () => pathname }, "next/dynamic": { __esModule: true, default: () => "PublicGallery" },
    "@/contexts/auth-context": { useAuth: () => state }, "@/components/auth/auth-guard": { AuthGuard: "AuthGuard" },
    "@/components/layout/app-shell": { AppShell: "AppShell" },
    "@/components/explore/use-explore-workflow-preload": { useExploreWorkflowPreload: () => () => {} },
    "@/lib/navigation/workspace-route": { getWorkspaceRouteConfig, isFocusedVideoWorkflowRoute },
    "@/lib/explore/public-reference-preview": publicFeed,
  });
  const render = () => WorkspaceRouteBoundary({ children: "PRIVATE_WORKSPACE" });
  for (const path of ["hook-video", "create-hook", "wall-of-text", "slideshows"]) {
    pathname = `/explore/${path}`;
    let tree = render();
    assert.equal(tree.props.requireAuthentication, false);
    assert.equal(tree.props.requireBusinessProfile, false);
    assert.equal(nodes(tree).find(node => node.type === "AppShell").props.focusNavigation, true);
    assert.equal(nodes(tree).find(node => node.type === "AppShell").props.guestWorkflow, true);
    assert.equal(nodes(tree).find(node => node.type === "PublicGallery").props.workflow, publicFeed.publicReferenceWorkflow(pathname));
    assert.ok(!nodes(tree).some(node => node.props?.children === "PRIVATE_WORKSPACE"));
    for (const auth of [{ user: null, loading: true }, { user: { uid: "user" }, loading: false }]) {
      state = auth; tree = render();
      assert.equal(tree.props.requireAuthentication, true);
      assert.equal(tree.props.requireBusinessProfile, true);
      assert.equal(nodes(tree).find(node => node.type === "AppShell").props.focusNavigation, true);
      assert.ok(!nodes(tree).some(node => node.type === "PublicGallery"));
    }
    state = { user: null, loading: false };
  }
  for (const path of ["/explore/build-character", "/library", "/analytics", "/scheduling", "/explore/hook-video/private", "/settings"]) {
    pathname = path;
    const tree = render();
    assert.equal(tree.props.requireAuthentication, true);
    assert.equal(tree.props.requireBusinessProfile, true);
    assert.ok(!nodes(tree).some(node => node.type === "PublicGallery"));
  }
});

test("private guard withholds children through restoration, sign-out and the next account's profile lookup", () => {
  let auth = { loading: true, user: null }, redirects = [], options;
  const profiles = new Map([["account-a", { onboardingComplete: true }]]);
  const { AuthGuard } = load("components/auth/auth-guard.tsx", {
    react: { useEffect: effect => effect(), useSyncExternalStore: () => false },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/navigation": { useRouter: () => ({ replace: path => redirects.push(path) }) },
    "@/contexts/auth-context": { useAuth: () => auth },
    "@/lib/business-profiles/profile-gate-query": load("lib/business-profiles/profile-gate-query.ts", {
      "@/lib/firebase/auth": {}, "@/lib/http/read-deadline": {},
    }),
    "@tanstack/react-query": { useQuery: config => {
      options = config;
      const data = profiles.get(config.queryKey[1]);
      return { data, isPending: !data };
    } },
    "lucide-react": {}, "@/components/ui/blocks-spinner": {}, "@/components/ui/button": {}, "@/components/ui/alert": {},
  });
  const render = () => AuthGuard({ children: "PRIVATE" });
  assert.notEqual(render(), "PRIVATE");
  assert.deepEqual(redirects, []);
  auth.loading = false;
  assert.notEqual(render(), "PRIVATE");
  assert.deepEqual(redirects, ["/sign-in"]);
  assert.equal(options.enabled, false);
  auth.user = { uid: "account-a", emailVerified: true };
  assert.equal(render(), "PRIVATE");
  auth.user = { uid: "account-b", emailVerified: true };
  assert.notEqual(render(), "PRIVATE");
  assert.equal(options.queryKey[1], "account-b");
  profiles.set("account-b", { onboardingComplete: false });
  assert.notEqual(render(), "PRIVATE");
  assert.equal(redirects.at(-1), "/onboarding");
});

test("account boundaries use distinct React keys and isolate cached and late-arriving private data", async () => {
  let user = { uid: "account-a" };
  const { JobQueryProvider } = load("components/providers/job-query-provider.tsx", {
    react: React, "react/jsx-runtime": jsxRuntime, "@tanstack/react-query": query,
    "@/contexts/auth-context": { useAuth: () => ({ user }) },
    "@/lib/social/connection-cache-events": { subscribeConnectionChanges() {} },
    "./account-timezone-provider": { AccountTimeZoneProvider: React.Fragment },
  });
  const key = ["private-results"];
  function inspectBoundary() {
    let client;
    function Result() {
      client = query.useQueryClient();
      return client.getQueryData(key) ?? "empty";
    }
    const element = JobQueryProvider({ children: React.createElement(Result) });
    const html = renderToStaticMarkup(element);
    return { client, html, boundaryKey: element.key };
  }
  const a = inspectBoundary();
  a.client.setQueryData(key, "A data");
  let finish;
  const late = a.client.fetchQuery({ queryKey: ["late"], queryFn: () => new Promise(resolve => { finish = resolve; }) });
  user = { uid: "account-b" };
  const b = inspectBoundary();
  assert.notEqual(a.boundaryKey, b.boundaryKey);
  assert.equal(b.html, "empty");
  b.client.setQueryData(key, "B data");
  finish("late A data");
  await late;
  assert.equal(b.client.getQueryData(key), "B data");
  assert.equal(b.client.getQueryData(["late"]), undefined);
  user = null;
  const guest = inspectBoundary();
  assert.notEqual(guest.boundaryKey, b.boundaryKey);
  assert.equal(guest.html, "empty");
  for (const { client } of [a, b, guest]) client.clear();
});

function galleryFixture(workflow, queryOverrides = {}) {
  let cursor = 0, options, retry = 0;
  const slots = [];
  const imports = {
    react: { useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; }, useEffect: () => {} },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { __esModule: true, default: "Link" }, "lucide-react": { RotateCcw: "RotateCcw" },
    "@base-ui/react/tabs": { Tabs: { Root: "TabsRoot", Panel: "TabsPanel" } },
    "./public-workflow-sections": Object.fromEntries(["PublicCreateSection", "PublicEditSection", "PublicScheduleSection"].map(name => [name, name])),
    "./workflow-section-navigation": { WorkflowSectionNavigation: "WorkflowSectionNavigation" },
    "@tanstack/react-query": { useQuery: value => { options = value; return { data: queryOverrides.data ?? [], isPending: false, isError: false, refetch: () => retry++, ...queryOverrides }; } },
    "./recreate-workspace": Object.fromEntries(["ReferenceCard", "ReferencePreviewDialog", "ReferenceGridSkeleton", "LoadError", "FilterMenu"].map(name => [name, name])),
    "@/lib/explore/recreate-types": types, "@/lib/explore/video-reference-feed": feed, "@/lib/explore/public-reference-preview": publicFeed,
    "@/lib/http/read-deadline": { withReadDeadline: async (callback, signal) => callback(signal) },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/components/layout/workflow-navigation": { WorkflowNavigationButton: "WorkflowNavigationButton" },
    ...Object.fromEntries(["talking-head-references", "workflow-studio", "reference-feed-upgrade", "workflow-creation", "workflow-section-layout"].map(name => [`./${name}.module.css`, { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }])),
  };
  const loaded = load("components/explore/public-reference-gallery.tsx", imports, {
    fetch: async (url, init) => { assert.equal(init.cache, "no-store"); assert.ok(!init.headers, "no private token transport"); return GET(new Request(`https://app.test${url}`, { signal: init.signal })); },
  });
  return { render() { cursor = 0; return loaded.PublicReferenceGallery({ workflow }); }, query: () => options, retries: () => retry };
}

test("real public producer flows through client query into preview, filters and sign-in controls", async () => {
  for (const workflow of publicFeed.PUBLIC_REFERENCE_WORKFLOWS) {
    const initial = galleryFixture(workflow); initial.render();
    const data = await initial.query().queryFn({ signal: new AbortController().signal });
    const fixture = galleryFixture(workflow, { data });
    let tree = fixture.render();
    const cards = () => nodes(tree).filter(node => node.type === "ReferenceCard");
    // The static render keeps the initial one-line taste; the browser measures the real line width.
    assert.equal(cards().length, publicFeed.PUBLIC_GUEST_REFERENCE_LIMIT, workflow);
    assert.deepEqual(Array.from(cards(), node => node.props.reference.id), data.slice(0, publicFeed.PUBLIC_GUEST_REFERENCE_LIMIT).map(item => item.id));
    const gate = nodes(tree).find(node => node.props?.["data-reference-feed-sign-in"] !== undefined);
    assert.ok(gate);
    assert.equal(gate.type, "section", "the guest gate mirrors the signed-in fade treatment without the upgrade copy");
    assert.equal(gate.props["aria-label"], "More references");
    assert.ok(nodes(gate).filter(node => node.type === "img").length === publicFeed.PUBLIC_GUEST_REFERENCE_LIMIT, "gate mirrors the row's blurred posters");
    assert.ok(nodes(gate).some(node => node.type === "Link" && node.props.href === "/sign-in"));
    assert.ok(nodes(gate).every(node => node.type !== "Link" || node.props.href !== "/pricing"), "guest gate links to sign-in, never pricing");
    for (const link of nodes(tree).filter(node => node.type === "Link" && node.props.href !== "/explore")) assert.equal(link.props.href, "/sign-in");
    cards()[1].props.onPreview(); tree = fixture.render();
    let dialog = nodes(tree).find(node => node.type === "ReferencePreviewDialog");
    assert.equal(dialog.props.reference.id, data[1].id);
    dialog.props.onOpenChange(false); tree = fixture.render();
    assert.equal(nodes(tree).find(node => node.type === "ReferencePreviewDialog").props.reference, null);
    if (workflow === "hook" || workflow === "talking_head") {
      nodes(tree).find(node => node.type === "FilterMenu").props.views.onSort("lowest"); tree = fixture.render();
      assert.deepEqual(Array.from(cards(), node => node.props.reference.id), feed.sortReferenceViews(data, "lowest").slice(0, publicFeed.PUBLIC_GUEST_REFERENCE_LIMIT).map(item => item.id));
      nodes(tree).find(node => node.type === "FilterMenu").props.views.onFilter("unavailable"); tree = fixture.render();
      assert.ok(cards().every(node => feed.referenceViewCount(node.props.reference) === undefined));
      nodes(tree).find(node => node.type === "FilterMenu").props.onClear(); tree = fixture.render();
      assert.equal(cards().length, publicFeed.PUBLIC_GUEST_REFERENCE_LIMIT);
    }
  }
});

test("guest taste stays separate from the signed-in ten-plus-upgrade feed", () => {
  const guest = readFileSync("components/explore/public-reference-gallery.tsx", "utf8");
  assert.match(guest, /PUBLIC_GUEST_REFERENCE_LIMIT/);
  assert.match(guest, /gridTemplateColumns/, "the guest taste measures the gallery's real column count so only one line shows");
  assert.match(guest, /ResizeObserver/, "the one-line taste follows viewport resizes");
  assert.ok(!guest.includes("ReferenceFeedUpgrade"), "guests get the fade + Sign in gate, not the paid upgrade block");
  assert.match(guest, /reference-feed-upgrade\.module\.css/, "guest gate reuses the signed-in fade treatment classes");
  for (const file of ["talking-head-references.tsx", "format-workspace.tsx", "recreate-workspace.tsx"]) {
    const source = readFileSync(`components/explore/${file}`, "utf8");
    assert.match(source, /videoReferencePreview|useFullVideoReferenceFeed/, `${file} keeps the signed-in ten-plus-upgrade feed`);
  }
});

test("every public workflow shows its own section navigation and matching sign-in panels", () => {
  for (const workflow of publicFeed.PUBLIC_REFERENCE_WORKFLOWS) {
    for (const state of [{}, { isPending: true }, { isError: true }]) {
      const tree = galleryFixture(workflow, state).render();
      const sidebar = nodes(tree).find(node => node.type === "aside");
      assert.ok(sidebar);
      assert.equal(tree.props.defaultValue, "create");
      const navigation = nodes(sidebar).find(node => node.type === "WorkflowSectionNavigation");
      const editValue = workflow === "hook" ? "demo" : "edit";
      const editLabel = { hook: "Demo", talking_head: "Demo", wall_text: "Edit", slideshow: "Edit slides" }[workflow];
      assert.equal(navigation.props.editLabel, editLabel);
      assert.equal(navigation.props.editValue, editValue);
      assert.equal(navigation.props.presentation, "panel");
      assert.equal(navigation.props.hideSchedule, undefined);
      const panels = nodes(sidebar).filter(node => node.type === "TabsPanel");
      assert.deepEqual(Array.from(panels, panel => panel.props.value), ["create", editValue, "schedule"]);
      // Each panel keeps its section inside the shared control-content wrapper, with a pinned sign-in footer.
      const expectedSections = ["PublicCreateSection", "PublicEditSection", "PublicScheduleSection"];
      assert.deepEqual(panels.map((panel, index) => nodes(panel).find(node => node.type === expectedSections[index])?.type), expectedSections);
      assert.ok(panels.every(panel => nodes(panel).every(node => node.props?.workflow === undefined || node.props.workflow === workflow)));
      for (const panel of panels) {
        assert.equal(panel.props.keepMounted, true);
        const footer = nodes(panel).find(node => node.type === "footer");
        assert.ok(footer, "panel has a pinned footer");
        const action = nodes(footer).find(node => node.type === "Link");
        if (workflow === "talking_head" && panel.props.value === editValue) {
          assert.equal(action, undefined);
          assert.ok(nodes(footer).some(node => node.type === "button" && node.props.disabled));
        } else assert.equal(action.props.href, "/sign-in");
      }
    }
  }
});

test("loading and failed public queries show recovery instead of a misleading sign-in gate", () => {
  for (const [overrides, expected] of [[{ isPending: true }, "ReferenceGridSkeleton"], [{ isError: true }, "LoadError"]]) {
    const fixture = galleryFixture("hook", overrides), tree = fixture.render();
    assert.ok(nodes(tree).some(node => node.type === expected));
    assert.ok(!nodes(tree).some(node => node.props?.["data-reference-feed-sign-in"] !== undefined));
    if (expected === "LoadError") { nodes(tree).find(node => node.type === expected).props.onRetry(); assert.equal(fixture.retries(), 1); }
  }
});


test("actual guest source action goes to sign-in even with a stale paid subscription snapshot", () => {
  const source = readFileSync("components/explore/recreate-workspace.tsx", "utf8");
  const snippet = source.slice(source.indexOf("export function ReferenceSourceAction("), source.indexOf("function EyeIcon"));
  const exports = {};
  vm.runInNewContext(ts.transpileModule(snippet, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: () => ({ jsx, jsxs: jsx, Fragment: "Fragment" }),
    useBillingSubscription: () => ({ isSuccess: true, data: { isActive: true, planKey: "growth" } }),
    canOpenReferenceSource: () => true, useState: initial => [initial, () => {}],
    cn: (...values) => values.filter(Boolean).join(" "), studio: {}, SocialPlatformIcon: "SocialPlatformIcon",
    Link: "Link", Dialog: "Dialog", DialogContent: "DialogContent", DialogHeader: "DialogHeader", DialogTitle: "DialogTitle", DialogDescription: "DialogDescription", Button: "Button",
  });
  const tree = exports.ReferenceSourceAction({ source: { url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok" }, label: "Original post", canOpen: true, guestSignInHref: "/sign-in" });
  assert.equal(nodes(tree).find(node => node.type === "Link").props.href, "/sign-in");
  assert.ok(!nodes(tree).some(node => node.type === "a"));
});
