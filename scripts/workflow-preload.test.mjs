import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const settle = () => new Promise(setImmediate);
function fixture(transport, token = async owner => `token:${owner}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const calls = [], owners = [], composers = [], modules = new Map();
  const paths = {
    "@/lib/business-profiles/profile-gate-query": "lib/business-profiles/profile-gate-query.ts",
    "@/lib/explore/reference-catalog-client": "lib/explore/reference-catalog-client.ts",
  };
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const exports = {};
    const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Promise,
      fetch: (url, init) => { calls.push({ url, init }); return transport(url, init); },
      require(name) {
        if (paths[name]) return load(paths[name]);
        if (name === "@/lib/http/read-deadline") return { withReadDeadline };
        if (name === "@/lib/firebase/auth") return { getCurrentUserIdToken: owner => { owners.push(owner); return token(owner); } };
        throw Error(`Unexpected import ${name}`);
      },
    });
    modules.set(path, exports);
    return exports;
  }
  const api = load("lib/explore/workflow-preload.ts");
  const options = {
    destination: "/explore/slideshows", localPreview: false, loading: false,
    user: { uid: "owner-a", emailVerified: true }, queryClient: client,
    loadComposer: async workflow => { composers.push(workflow); },
  };
  return { ...api, calls, owners, composers, client, options,
    catalog: load(paths["@/lib/explore/reference-catalog-client"]),
    preload: overrides => api.preloadExploreWorkflow({ ...options, ...overrides }),
  };
}
const response = url => Response.json(url === "/api/business-profile"
  ? { ok: true, profile: { onboardingComplete: true } }
  : { ok: true, items: [{ id: "public-slide" }], archivedHookItems: [{ id: "archived-hook" }] });

test("profile, catalog and composer start together; repeated intent and mounting reuse reads", async () => {
  let finishProfile;
  const h = fixture(async url => url === "/api/business-profile"
    ? new Promise(resolve => { finishProfile = () => resolve(response(url)); }) : response(url));
  try {
    const first = h.preload();
    const second = h.preload();
    await settle();
    assert.equal(h.calls.length, 2, "catalog must not wait for profile completion");
    assert.ok(h.composers.includes("slideshow"));
    assert.ok(h.owners.every(owner => owner === "owner-a"));
    let unexpectedFetch = 0;
    const mountedProfile = h.client.fetchQuery({ queryKey: ["business-profile-gate", "owner-a"], queryFn: () => { unexpectedFetch++; }, staleTime: 30 * 60_000 });
    finishProfile();
    await Promise.all([first, second, mountedProfile]);
    const items = await h.client.fetchQuery({ queryKey: ["recreate-references", 4, "owner-a"], queryFn: () => { unexpectedFetch++; }, staleTime: 30 * 60_000 });
    assert.equal(unexpectedFetch, 0);
    assert.deepEqual(Array.from(items, item => item.id), ["public-slide", "archived-hook"]);
    assert.ok(h.calls.every(call => call.init.cache === "no-store" && call.init.headers.Authorization === "Bearer token:owner-a"));
  } finally { h.client.clear(); }
});

test("no speculative calls for preview, anonymous, unverified, loading or unrelated routes", async () => {
  const h = fixture(async url => response(url));
  try {
    for (const options of [{ localPreview: true }, { user: null }, { loading: true },
      { user: { uid: "owner-a", emailVerified: false } }, { destination: "/pricing" },
      { destination: "/explore/create-hook" }, { destination: null }]) await h.preload(options);
    assert.equal(h.calls.length, 0);
    assert.equal(h.composers.length, 0);
  } finally { h.client.clear(); }
});

test("failed warmups do not report success or block normal retry; module failure is independent", async () => {
  let fail = true;
  const h = fixture(async url => fail ? Response.json({ message: "Unavailable" }, { status: 503 }) : response(url));
  try {
    await h.preload({ loadComposer: async () => { throw Error("Chunk unavailable"); } });
    assert.equal(h.client.getQueryState(["business-profile-gate", "owner-a"]).status, "error");
    assert.equal(h.client.getQueryState(["recreate-references", 4, "owner-a"]).status, "error");
    assert.equal(h.calls.length, 2, "no background retry storm");
    fail = false;
    await h.preload();
    assert.equal(h.calls.length, 4);
    assert.equal(h.client.getQueryState(["recreate-references", 4, "owner-a"]).status, "success");
  } finally { h.client.clear(); }
});

test("an incomplete onboarding result is cached as incomplete, never upgraded by preload", async () => {
  const h = fixture(async url => url === "/api/business-profile"
    ? Response.json({ ok: true, profile: { onboardingComplete: false } }) : response(url));
  try {
    await h.preload();
    assert.equal(h.client.getQueryData(["business-profile-gate", "owner-a"]).onboardingComplete, false);
  } finally { h.client.clear(); }
});

test("accounts have separate caches and each token read is bound to the expected owner", async () => {
  const h = fixture(async url => response(url));
  try {
    await h.preload();
    await h.preload({ user: { uid: "owner-b", emailVerified: true } });
    assert.equal(h.calls.length, 4);
    assert.deepEqual(h.owners, ["owner-a", "owner-a", "owner-b", "owner-b"]);
    assert.ok(h.client.getQueryData(["recreate-references", 4, "owner-b"]));
  } finally { h.client.clear(); }
  const changed = fixture(async url => response(url), async () => { throw Error("Account changed"); });
  try {
    await changed.preload();
    assert.equal(changed.calls.length, 0);
    assert.equal(changed.client.getQueryState(["recreate-references", 4, "owner-a"]).status, "error");
  } finally { changed.client.clear(); }
});

test("cancelling during token loading cannot issue a late catalog fetch", async () => {
  let finishToken;
  const h = fixture(async url => response(url), () => new Promise(resolve => { finishToken = resolve; }));
  try {
    const abort = new AbortController();
    const pending = h.catalog.fetchRecreateReferences(abort.signal, "owner-a");
    abort.abort();
    await assert.rejects(pending, { name: "AbortError" });
    finishToken("late-token");
    await settle();
    assert.equal(h.calls.length, 0);
  } finally { h.client.clear(); }
});

test("preload wiring preserves guards and covers keyboard, hover and touch without UI additions", () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const card = read("components/explore/explore-workflow-card.tsx");
  for (const event of ["onPointerEnter", "onPointerDown", "onFocus"]) assert.ok(card.includes(`${event}={preload}`));
  const boundary = read("components/layout/workspace-route-boundary.tsx");
  assert.ok(boundary.includes("useEffect(preload, [preload])"));
  assert.ok(boundary.includes('requireAuthentication={route.access !== "none"}'));
  assert.ok(boundary.includes('requireBusinessProfile={route.access === "profile"}'));
  const guard = read("components/auth/auth-guard.tsx");
  assert.ok(guard.includes('router.replace("/onboarding")'));
  assert.ok(guard.includes('router.replace("/verify-email")'));
  const hook = read("components/explore/use-explore-workflow-preload.ts");
  assert.ok(hook.includes('process.env.NODE_ENV === "development"'));
  assert.ok(hook.includes('get("preview") === "1"'));
});
