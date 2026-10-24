import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const owner = { uid: "owner", email: "vtu19403@veltech.edu.in", emailVerified: true };
const catalog = [1, 2].map(number => ({ id: `account-${number}`, label: `Creator Account ${number}`,
  items: Array.from({ length: 6 }, (_, index) => ({ id: `creator-account-${number}-${index}`, format: "hook", title: "Hook", slides: [],
    posterUrl: `/api/explore/creator-media/${number}-${index}?variant=poster`, videoUrl: `/api/explore/creator-media/${number}-${index}?variant=video` })) }));
const privateUrl = catalog[0].items[0].videoUrl;
const tick = async () => { for (let index = 0; index < 12; index++) await new Promise(resolve => setImmediate(resolve)); };

function harness(file, { fetcher = async () => new Response("private", { headers: { "content-type": "image/png" } }) } = {}) {
  let cursor = 0, user = owner;
  const states = [], effects = [], tokens = [], requests = [], revoked = [], created = [];
  const exported = {};
  const react = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
    useEffect(fn, deps) { const index = cursor++, previous = states[index];
      if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) {
        const current = { deps }; states[index] = current; effects.push(() => { previous?.cleanup?.(); current.cleanup = fn(); });
      }
    },
  };
  const imports = {
    react,
    "@tanstack/react-query": { useQuery: () => ({ data: catalog, isError: false, refetch() {} }) },
    "@/contexts/auth-context": { useAuth: () => ({ user }) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async id => { tokens.push(id); return "owner-token"; } },
    "@/lib/explore/creator-account-access": { canAccessCreatorAccounts: value => value?.emailVerified === true && value.email === owner.email,
      isCreatorAccountReference: value => value?.startsWith("creator-account-") },
    "@/lib/http/read-deadline": { withReadDeadline: (fn, signal) => fn(signal ?? new AbortController().signal) },
  };
  const code = ts.transpileModule(readFileSync(new URL(`../components/explore/${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, AbortController, Response, console, setTimeout, clearTimeout,
    URL: { createObjectURL() { const url = `blob:private-${created.length}`; created.push(url); return url; }, revokeObjectURL: url => revoked.push(url) },
    fetch: async (url, options) => { requests.push({ url, options }); return fetcher(url, options); },
    require(name) { if (!(name in imports)) throw Error(`Unexpected import ${name}`); return imports[name]; },
  });
  return { exported, tokens, requests, revoked, created,
    setUser(value) { user = value; }, get user() { return user; },
    render(fn) { cursor = 0; const result = fn(exported, user); while (effects.length) effects.shift()(); return result; },
    unmount() { for (const state of states) state?.cleanup?.(); },
  };
}

test("creator metadata opens Recreate without MP4s and one account can render while the other still loads", async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const h = harness("use-creator-accounts.ts", { fetcher: async url => {
    assert.match(url, /variant=poster$/);
    if (url.includes("/2-")) await blocked;
    return new Response("poster", { headers: { "content-type": "image/png" } });
  } });
  const render = () => h.render((module, user) => module.useCreatorAccounts(user, true));
  let result = render();
  assert.equal(result.references.length, 12); assert.equal(h.requests.length, 0);
  result.select("account-1"); result = render();
  assert.equal(result.loading, true);
  await tick(); result = render();
  assert.equal(result.account.items.length, 6); assert.equal(result.loading, false);
  assert.equal(result.account.items[0].videoUrl, privateUrl, "canonical identity remains separate from browser preview");
  assert.match(result.account.items[0].posterUrl, /^blob:/);
  assert.equal(h.requests.filter(request => request.url.includes("variant=video")).length, 0);
  assert.equal(h.requests[0].options.headers.Authorization, "Bearer owner-token");
  result.select("account-2"); result = render(); assert.equal(result.loading, true);
  release(); await tick(); result = render(); assert.equal(result.account.items.length, 6);
  h.setUser(null); result = render(); assert.equal(result.references.length, 0); assert.equal(result.account, undefined);
  assert.equal(h.revoked.length, 12);
  assert.ok(h.tokens.every(value => value === "owner"));
});

test("a failed account still does not block another account's gallery or canonical draft recovery", async () => {
  const h = harness("use-creator-accounts.ts", { fetcher: async url => new Response("poster", {
    status: url.includes("/2-") ? 503 : 200, headers: { "content-type": "image/png" },
  }) });
  const render = () => h.render((module, user) => module.useCreatorAccounts(user, true, "creator-account-2-0"));
  let result = render(); await tick(); result = render(); result.select("account-1"); result = render();
  assert.equal(result.account.items.length, 6); assert.equal(result.error, null); assert.equal(result.references.length, 12);
  result.select("account-2"); result = render(); assert.match(result.error, /could not be loaded/); assert.equal(result.loading, false);
  h.unmount(); assert.equal(h.revoked.length, h.created.length);
});

test("private videos fetch only on interest, retain the ready preview on leave and revoke it on logout", async () => {
  const h = harness("use-creator-video-preview.ts", { fetcher: async () => new Response("video", { headers: { "content-type": "video/mp4" } }) });
  const render = interested => h.render(module => module.useCreatorVideoPreview(privateUrl, interested));
  let result = render(false); assert.equal(result.url, undefined); assert.equal(h.requests.length, 0);
  result = render(true); assert.equal(result.loading, true); await tick(); result = render(true);
  assert.match(result.url, /^blob:/); assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.headers.Authorization, "Bearer owner-token"); assert.equal(h.tokens[0], "owner");
  result = render(false); assert.match(result.url, /^blob:/); result = render(true); await tick();
  assert.equal(h.requests.length, 1, "repeat hover reuses this component's authenticated blob");
  h.setUser(null); result = render(true); assert.equal(result.url, undefined); assert.equal(h.revoked.length, 1);
});

test("private preview never falls back to an unauthenticated API URL after failure or owner change", async () => {
  const h = harness("use-creator-video-preview.ts", { fetcher: async () => new Response("denied", { status: 403 }) });
  const render = () => h.render(module => module.useCreatorVideoPreview(privateUrl, true));
  render(); await tick(); let result = render(); assert.equal(result.failed, true); assert.equal(result.url, undefined);
  h.setUser({ uid: "other", email: "other@example.com", emailVerified: true }); result = render();
  assert.equal(result.url, undefined); assert.equal(h.requests.length, 1);
  result = h.render(module => module.useCreatorVideoPreview("https://public.example/reference.mp4", false));
  assert.equal(result.url, "https://public.example/reference.mp4");
});

test("an in-flight private preview cannot publish or leak an object URL after unmount", async () => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const h = harness("use-creator-video-preview.ts", { fetcher: async () => { await delayed; return new Response("video", { headers: { "content-type": "video/mp4" } }); } });
  h.render(module => module.useCreatorVideoPreview(privateUrl, true)); await tick(); h.unmount(); release(); await tick();
  assert.equal(h.created.length, 0); assert.equal(h.requests[0].options.signal.aborted, true);
});

test("a brief pointer crossing does not start a private MP4 transfer", async () => {
  const h = harness("use-creator-video-preview.ts", { fetcher: async () => new Response("video", { headers: { "content-type": "video/mp4" } }) });
  const render = interested => h.render(module => module.useCreatorVideoPreview(privateUrl, interested, 30));
  render(true); render(false); await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(h.requests.length, 0); assert.equal(h.created.length, 0);
  render(true); await new Promise(resolve => setTimeout(resolve, 45)); await tick();
  assert.equal(h.requests.length, 1); assert.match(render(true).url, /^blob:/); h.unmount();
});
