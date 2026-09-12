import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

// Exercise the real preparation/reconciliation flow. Only its database,
// source inventory and model boundaries are replaced; no network is allowed.
globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
let assignments, creatives, published, decisions, events, writerMode, saveFailure, publishFailure, orphanQueryFails;
const profile = { id: "profile", profileVersion: 1, userId: "owner", context: {} };
const options = { requestKey: "request", requestedCount: 6, dailyFeedId: "daily", earlyPlanId: "plan" };
const batch = { business_profile_id: "profile", business_profile_version: 1, requested_count: 6 };
class Exhausted extends Error { code = "content_retry_exhausted"; }
function candidate(index) {
  return { candidateIndex: index, duplicateSignature: { contentHash: String(index), normalizedText: "copy" }, content: {}, layout: {} };
}
function creative(id) { return { id, current: true, source_kind: "ugcpilot" }; }
function idea(id) { return { id, assignmentId: `assignment-${id}`, audio: {}, text: { fullText: "One complete thought." } }; }

beforeEach(() => {
  assignments = Array.from({ length: 6 }, (_, index) => ({
    id: `reserved-${index}`, batch_candidate_index: index, chunk_id: "chunk", status: "pending",
    wall_text_creative_id: null, overlay_media_asset_id: `asset-${index}`, source_kind: "ugcpilot",
    duration_seconds: 6, layout_json: {}, max_words: 15, target_words: 14,
  }));
  creatives = []; published = new Set(); decisions = new Set(); events = [];
  writerMode = "success"; saveFailure = null; publishFailure = null;
  orphanQueryFails = false;
});

const unused = () => { throw new Error("Unexpected dependency call"); };
const db = Object.fromEntries([
  "ensureWallTextOverlayAssetsForMediaAssets", "listUsedWallTextBackgroundAssetIds",
  "listWallTextOverlayAssetsForMediaAssetIds", "listReservedWallTextBackgroundAssetIds",
  "listWallTextVideoAssetInventory", "replaceTrendingWallTextCreativeCopy",
  "reserveWallTextGenerationBatch", "terminalizeWallTextStaleLayoutFailures",
].map(name => [name, unused]));
Object.assign(db, {
  areTrendingWallTextCreativesCurrent: rows => rows.every(row => row.current),
  isTrendingWallTextCreativeCurrent: row => row.current,
  needsTrendingWallTextCreativeRefresh: row => !row.current,
  getWallTextGenerationReservation: async () => structuredClone({ batch, assignments }),
  listWallTextDuplicateSignatures: async () => [],
  getWallTextPrivateCreativeContexts: async ({ assignments: rows }) => {
    events.push("contexts");
    if (rows.some(row => row.status === "failed")) throw new Error("Retired context was loaded");
    return new Map(rows.map(row => [row.id, {}]));
  },
  listWallTextOverlayAssetsByIds: async ids => ids.map(id => ({ id })),
  listActiveWallTextInstagramReelTemplates: async () => [],
  parseWallTextLayout: () => ({}), parseWallTextContent: () => ({}),
  claimWallTextGenerationChunk: async () => "claim",
  recordWallTextFailureDiagnostic: async () => {},
  recordWallTextGenerationChunkFailure: async ({ retryable }) => {
    events.push("chunk-failed");
    for (const row of assignments) if (row.status !== "completed") row.status = retryable ? "retry_pending" : "failed";
  },
  saveWallTextGenerationCandidate: async ({ assignmentId, creativeId }) => {
    const row = assignments.find(entry => entry.id === assignmentId);
    const saved = creative(creativeId);
    creatives.push(saved); row.status = "completed"; row.wall_text_creative_id = saved.id;
    // A gateway timeout may happen after the transaction committed.
    if (saveFailure === row.batch_candidate_index) { saveFailure = null; throw new Error("Gateway Timeout"); }
    return saved;
  },
  publishTrendingWallTextAssignments: async ({ creatives: rows }) => {
    for (const row of rows) {
      if (row.id === publishFailure) throw new Error("Audio dependency unavailable");
      published.add(row.id); events.push(`published:${row.id}`);
    }
  },
  ensureTrendingWallTextAssignments: unused,
  listTrendingWallTextCreatives: async () => creatives,
  listUnassignedWallTextCreatives: async () => {
    if (orphanQueryFails) throw new Error("Transient assignment query failure");
    return creatives.filter(row => row.current && !published.has(row.id));
  },
  listActiveTrendingWallTextIdeas: async () => [...published].filter(id => !decisions.has(id)).map(idea),
});
mock.module("@/lib/trending/wall-text-db", { namedExports: db });
mock.module("@/lib/trending/wall-text-jobs", { namedExports: { enqueueTrendingWallTextJob: unused } });
mock.module("@/lib/media/media-storage", { namedExports: { listMediaAssets: async () => [] } });
mock.module("@/lib/trending/video-source-selection", { namedExports: { resolveTrendingVideoSource: async () => ({ selection: null, assets: [] }) } });
mock.module("@/lib/trending/generate-trending-wall-text-ideas", { namedExports: {
  WallTextCandidateRepairExhaustedError: Exhausted,
  getTrendingWallTextModelName: () => "test-model",
  generateBusinessTrendingWallTextIdeas: async ({ candidates, onChunkAccepted }) => {
    events.push("writer");
    if (writerMode === "partial-failure") {
      await onChunkAccepted([candidate(candidates[0].candidateIndex)]);
      assert.equal(published.size, 1, "accepted card must be published before later candidates fail");
      throw new Exhausted("One remaining candidate failed");
    }
    await onChunkAccepted(candidates.map(row => candidate(row.candidateIndex)));
  },
} });
mock.module("@/lib/trending/feed-items", { namedExports: {
  createUnavailableTrendingFeedProvider: (_format, reason) => ({ items: [], reason }),
  createWallTextTrendingFeedProvider: items => ({ items }),
} });
const { prepareTrendingWallTextIdeas, getTrendingWallTextFeedProvider } = await import("./trending-wall-text-feed.ts");

test("publishes accepted work before a later candidate exhausts its repairs", async () => {
  writerMode = "partial-failure";
  await assert.rejects(prepareTrendingWallTextIdeas(profile, options), { code: "content_retry_exhausted" });
  const feed = await getTrendingWallTextFeedProvider(profile);
  assert.equal(feed.items.length, 1);
  assert.ok(events.indexOf(`published:${creatives[0].id}`) < events.indexOf("chunk-failed"));
});

test("terminal replay recovers saved cards and never requests retired private context", async () => {
  assignments[0].status = "completed"; assignments[0].wall_text_creative_id = "saved";
  assignments[1].status = "failed"; creatives.push(creative("saved"));
  await assert.rejects(prepareTrendingWallTextIdeas(profile, options), { code: "content_retry_exhausted" });
  assert.ok(published.has("saved"));
  assert.ok(!events.includes("contexts")); assert.ok(!events.includes("writer"));
});

test("batch result excludes historical cards and includes cards already decided by the user", async () => {
  creatives.push(creative("historical")); published.add("historical");
  const first = await prepareTrendingWallTextIdeas(profile, options);
  assert.deepEqual(first, { ideaCount: 6 }); assert.equal(published.size, 7);
  const chosen = assignments[0].wall_text_creative_id; decisions.add(chosen);
  events = [];
  assert.deepEqual(await prepareTrendingWallTextIdeas(profile, options), { ideaCount: 6 });
  assert.ok(decisions.has(chosen)); assert.ok(!events.includes("writer"));
});

test("a committed save with a lost response is recovered on replay without regenerating it", async () => {
  saveFailure = 1;
  await assert.rejects(prepareTrendingWallTextIdeas(profile, options), /Gateway Timeout/);
  assert.equal(creatives.length, 6); assert.equal(published.size, 5);
  events = [];
  assert.deepEqual(await prepareTrendingWallTextIdeas(profile, options), { ideaCount: 6 });
  assert.equal(creatives.length, 6); assert.equal(published.size, 6);
  assert.ok(!events.includes("writer"));
});

test("feed reconciles old orphan cards without one broken dependency hiding healthy cards", async () => {
  creatives.push(creative("orphan"), creative("bad"), creative("decided"));
  published.add("decided"); decisions.add("decided"); publishFailure = "bad";
  const originalError = console.error; console.error = () => {};
  try {
    const feed = await getTrendingWallTextFeedProvider(profile);
    assert.deepEqual(feed.items.map(row => row.creativeId), ["orphan"]);
    assert.ok(decisions.has("decided")); assert.ok(!published.has("bad"));
  } finally { console.error = originalError; }
});

test("a transient orphan-repair query failure leaves existing ready cards visible", async () => {
  creatives.push(creative("ready")); published.add("ready"); orphanQueryFails = true;
  const originalError = console.error; console.error = () => {};
  try {
    const feed = await getTrendingWallTextFeedProvider(profile);
    assert.deepEqual(feed.items.map(row => row.creativeId), ["ready"]);
  } finally { console.error = originalError; }
});
