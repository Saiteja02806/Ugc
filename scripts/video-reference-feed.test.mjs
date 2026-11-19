import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/query-core";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as feed from "../lib/explore/video-reference-feed.ts";
import * as types from "../lib/explore/recreate-types.ts";
import { readPublicVideoViews } from "../lib/explore/public-video-views.ts";
import { getVideoReferenceViews, getAllHookReferenceViews } from "../lib/explore/hook-reference-views.ts";
import { isPaidBillingPlan } from "../lib/billing/policy.ts";
import { visibleTalkingHeadReferences } from "../lib/explore/talking-head-reference.ts";

const item = (id, count) => ({ id, format: "hook", title: id, category: null, categoryLabel: null, slides: [], sourceSha256: "a".repeat(64), posterUrl: "/poster.png", videoUrl: "/video.mp4", sourceUrl: `https://www.tiktok.com/@creator/video/${100000 + id}`, ...(count === undefined ? {} : { viewCount: count }) });
const ids = items => Array.from(items, value => value.id);
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const jsx = (type, props) => ({ type, props });
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: key => { assert.ok(key in imports, key); return imports[key]; } });
  return exports;
}

test("numeric sorting keeps missing, no-source and invalid counts last in both directions, with genuine zero", () => {
  const input = [item(1), item(2, 0), item(3, 200), item(4, 20), { ...item(5, 999), sourceUrl: undefined }, item(6, NaN), item(7, -1)];
  assert.deepEqual(ids(feed.sortReferenceViews(input)), [3, 4, 2, 1, 5, 6, 7]);
  assert.deepEqual(ids(feed.sortReferenceViews(input, "lowest")), [2, 4, 3, 1, 5, 6, 7]);
  assert.deepEqual(ids(feed.filterReferenceViews(input, "available")), [2, 3, 4]);
  assert.deepEqual(ids(feed.filterReferenceViews(input, "unavailable")), [1, 5, 6, 7]);
  assert.equal(feed.formatReferenceViews(0), "0");
  assert.deepEqual(ids(input), [1, 2, 3, 4, 5, 6, 7]);
});

test("fixed free ten cannot expand by sorting/filtering, resizing, or including archived saved work", () => {
  const input = Array.from({ length: 27 }, (_, index) => item(index, index * 100));
  input.push({ ...item(100, 999999), archived: true });
  const preview = feed.videoReferencePreview(input, false);
  assert.equal(preview.length, 10);
  assert.deepEqual(ids(preview), [26, 25, 24, 23, 22, 21, 20, 19, 18, 17]);
  assert.deepEqual(new Set(ids(feed.sortReferenceViews(preview, "lowest"))), new Set(ids(preview)));
  assert.equal(feed.videoReferencePreview(input, true).length, 27);
  assert.equal(input.find(value => value.id === 100).archived, true, "saved lookup metadata remains intact");
});

test("Hook default prioritizes views across platforms and upload batches; sibling orders remain unchanged", () => {
  const input = [{ ...item(1, 10), sourcePlatform: "instagram", uploadBatchSequence: 9 }, { ...item(2, 1000), sourcePlatform: "tiktok", uploadBatchSequence: 1 }];
  assert.deepEqual(ids(types.orderReferenceGallery(input, "hook")), [2, 1]);
  assert.deepEqual(ids(types.orderReferenceGallery(input, "wall_text")), [1, 2]);
  assert.deepEqual(ids(types.orderReferenceGallery(input.map(value => ({ ...value, category: "same" })), "slideshow")), [1, 2]);
});

test("view snapshots join the canonical exact post, never an unrelated post, missing link or profile", () => {
  const saved = getAllHookReferenceViews()[0];
  assert.equal(getVideoReferenceViews(saved.sourceUrl + "?tracking=1").viewCount, saved.viewCount);
  assert.ok(getVideoReferenceViews(saved.sourceUrl).retrievedAt);
  for (const url of [undefined, "https://www.tiktok.com/@creator", "https://www.instagram.com/reel/unrelated/", "https://evil.test/reel/known/"]) assert.equal(getVideoReferenceViews(url), undefined);
});

test("public metric parser requires exact source identity and ignores likes, recommendations and login pages", () => {
  const url = "https://www.tiktok.com/@creator/video/123";
  const html = value => `<script type="application/json">${JSON.stringify(value)}</script>`;
  assert.equal(readPublicVideoViews(html({ itemInfo: { itemStruct: { id: "123", stats: { playCount: 0, diggCount: 99 } } } }), url), 0);
  assert.equal(readPublicVideoViews(html({ id: "wrong", stats: { playCount: 90000 } }), url), undefined);
  assert.equal(readPublicVideoViews(html({ id: "123", stats: { diggCount: 99 } }), url), undefined);
  assert.equal(readPublicVideoViews("<h1>Log in</h1>", url), undefined);
  assert.equal(readPublicVideoViews(html({ shortcode: "post", video_view_count: 1234 }), "https://www.instagram.com/reel/post/"), 1234);
  assert.equal(readPublicVideoViews(html({ shortcode: "different", video_view_count: 1234 }), "https://www.instagram.com/reel/post/"), undefined);
});

test("feed access consumes billing plan, independent of free video grants; checking/error never unlock", () => {
  let query;
  const loaded = load("components/explore/reference-feed-upgrade.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "link" },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: () => query },
    "@/lib/billing/policy": { isPaidBillingPlan }, "./reference-feed-upgrade.module.css": { default: {} },
  });
  for (const planKey of ["starter", "growth", "startup", "free"]) {
    query = { isSuccess: true, isError: false, isPending: false, data: { planKey, isActive: true, freeVideoPass: { available: true } } };
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, planKey !== "free");
    query.isFetching = true;
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, false, "cached paid data cannot unlock during refresh");
    assert.equal(loaded.useFullVideoReferenceFeed().loading, true);
    query.isFetchedAfterMount = true;
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, planKey !== "free", "verified paid feed stays mounted through child source refetches");
    query.isFetching = false;
    query.isError = true; assert.equal(loaded.useFullVideoReferenceFeed().unlimited, false);
  }
  query = { isPending: true, isSuccess: false };
  assert.equal(loaded.useFullVideoReferenceFeed().unlimited, false);
  const gate = nodes(loaded.ReferenceFeedUpgrade({}));
  assert.equal(gate.find(node => node.props?.href === "/pricing").props.children, "Upgrade");
  assert.equal(nodes(loaded.ReferenceFeedUpgrade({ failed: true })).some(node => node.props?.href === "/pricing"), false);
});

test("actual Talking Head handlers sort/filter the permitted set and preserve preview/Recreate identity", () => {
  let cursor = 0, unlimited = false, chosen, states = [];
  const sample = Array.from({ length: 22 }, (_, index) => item(index, index === 21 ? undefined : index * 100));
  const loaded = load("components/explore/talking-head-references.tsx", {
    react: { useState(value) { const index = cursor++; if (!(index in states)) states[index] = value; return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; } },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "lucide-react": { RotateCcw: "rotate" },
    "@/components/generation/use-ai-studio-access": { useAIStudioAccess: () => "pro" },
    "./reference-feed-upgrade": { useFullVideoReferenceFeed: () => ({ unlimited }), ReferenceFeedUpgrade: "upgrade" },
    "./recreate-workspace": { FilterMenu: "filter", ReferenceCard: "card", ReferencePreviewDialog: "preview", ReferenceGridSkeleton: "loading", LoadError: "error" },
    "@/lib/explore/recreate-types": types, "@/lib/explore/video-reference-feed": feed,
    "@/lib/explore/talking-head-reference": { visibleTalkingHeadReferences },
    "./talking-head-references.module.css": { default: {} }, "./workflow-studio.module.css": { default: {} },
    "./lazy-hook-starting-frame-workspace": { preloadHookStartingFrameWorkspace: async () => {} }, "./use-starting-frame-preload": { useStartingFramePreload: () => () => {} },
  });
  function render(overrides = {}) { cursor = 0; return nodes(loaded.TalkingHeadReferences({ items: sample, loading: false, failed: false, disabled: false, startingFrameEnabled: true, onChoose: id => { chosen = id; }, ...overrides })); }
  const cards = tree => tree.filter(node => node.type === "card");
  let tree = render();
  assert.deepEqual(cards(tree).map(node => node.props.reference.id), [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  tree.find(node => node.type === "filter").props.views.onSort("lowest"); tree = render();
  assert.deepEqual(cards(tree).map(node => node.props.reference.id), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  cards(tree)[0].props.onPreview(); tree = render();
  assert.equal(tree.find(node => node.type === "preview").props.reference.id, 11);
  tree.find(node => node.type === "button" && node.props["data-reference-recreate"] !== undefined).props.onClick(); assert.equal(chosen, 11);
  tree.find(node => node.type === "filter").props.views.onFilter("unavailable"); assert.equal(cards(render()).length, 0);
  unlimited = true; tree = render(); assert.deepEqual(cards(tree).map(node => node.props.reference.id), [21]);
  tree.find(node => node.type === "filter").props.onClear(); assert.equal(cards(render()).length, 22);
  assert.equal(cards(render({ failed: true })).length, 0); assert.equal(cards(render({ loading: true })).length, 0);
});


test("real QueryObserver revalidates cached paid entry without collapsing on child refetch or missing a downgrade", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const key = ["billing-subscription", "review-owner"];
  const paid = { planKey: "growth", isActive: true };
  const free = { planKey: "free", isActive: false };
  client.setQueryData(key, paid);
  const pending = [];
  const options = { queryKey: key, queryFn: () => new Promise(resolve => pending.push(resolve)), staleTime: 0, refetchOnMount: "always" };
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  const loaded = load("components/explore/reference-feed-upgrade.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "link" },
    "@/components/billing/use-billing-subscription": { useBillingSubscription: () => observer.getCurrentResult() },
    "@/lib/billing/policy": { isPaidBillingPlan }, "./reference-feed-upgrade.module.css": { default: {} },
  });
  const settle = value => new Promise(resolve => {
    const stop = observer.subscribe(result => { if (!result.isFetching) { stop(); resolve(); } });
    pending.shift()(value);
  });
  let childStop;
  try {
    assert.equal(observer.getCurrentResult().isSuccess, true);
    assert.equal(observer.getCurrentResult().isFetching, true);
    assert.equal(observer.getCurrentResult().isFetchedAfterMount, false);
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, false);
    assert.equal(loaded.useFullVideoReferenceFeed().loading, true);
    await settle(free);
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, false);
    const refresh = observer.refetch();
    await settle(paid); await refresh;
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, true);
    const child = new QueryObserver(client, options);
    childStop = child.subscribe(() => {});
    assert.equal(observer.getCurrentResult().isFetching, true);
    assert.equal(observer.getCurrentResult().isFetchedAfterMount, true);
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, true, "new source buttons must not collapse the verified feed");
    await settle(free);
    assert.equal(loaded.useFullVideoReferenceFeed().unlimited, false, "authoritative downgrade always wins");
  } finally { childStop?.(); unsubscribe(); client.clear(); }
});
