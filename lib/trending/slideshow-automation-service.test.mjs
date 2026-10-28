import assert from "node:assert/strict";
import { mock, test } from "node:test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { renderCarouselManualSlide } from "../../worker/dist/lib/carousel-manual-render.js";
import { createClient as createActualClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";

const local = (path) => new URL(path, import.meta.url);
const { createDefaultAutomationConfig, syncAutomationDailySlots } =
  await import("./slideshow-automation-contract.ts");
let automation, slots, candidates, saved, schedules, cancelled, renderCalls, uploads;
let cancelFails, renderFails, pauseDuringRender, databaseFails, unconfirmedCancel;
let productAssets = [];
let executionToken, preferenceFails, loseScheduleResponse, competingSweep;
let dailyLimit, duringCollectionRead, beforeAutomationUpdate, beforeStorageProbe, settingsWriteError;
let databaseClient;
const colors = ["#e02020", "#2040e0", "#20c040"];
const assets = await Promise.all(colors.map(async (color, index) => ({
  id: `asset-${index}`, collection: "image", sourceType: "upload", status: "ready",
  mimeType: "image/png", metadata: {}, title: color,
  url: `data:image/png;base64,${(await sharp({ create: { width: 40, height: 50, channels: 3, background: color } }).png().toBuffer()).toString("base64")}`,
})));

function config() {
  const value = createDefaultAutomationConfig({ timezone: "Asia/Kolkata", dailyAllowance: 3 });
  value.startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  // Keep this fixture independent of quick-mode display labels.
  value.counts = { dailyTotal: 1, educationalTipsCount: 1, productStoriesCount: 0 };
  value.dailySlots = syncAutomationDailySlots({ counts: value.counts, currentSlots: [] });
  value.targets = [{ platform: "instagram", connectionId: "connection-1" }];
  return value;
}
function source(id = "carousel-1", structureId = "structure_1", count = 4) {
  return {
    edit: null, generation: { id, userId: "owner", projectId: "project", businessProfileId: "owned-profile", businessProfileVersion: 1, categorySlug: "productivity", status: "completed", structureId, format: "4:5", slideCount: count },
    slides: Array.from({ length: count }, (_, index) => ({
      id: `slide-${index}`, carouselGenerationId: id, slideNumber: index + 1, status: "ready",
      categoryImageAssetId: `original-${index}`, renderedUrl: `https://original.test/${index}.webp`,
      headline: index === 0 ? "Clear cover" : "", subtext: index === 0 ? "" : `Body copy ${index}`,
      ctaText: index === count - 1 ? "Learn more" : "", structureId,
    })), title: "An owned slideshow", userId: "owner",
  };
}
function reset(value = config()) {
  automation = { user_id: "owner", config: value, status: "active", revision: 2, rotation_cursor: 0,
    attention_message: null, attention_reason: null, activated_at: new Date().toISOString(), paused_at: null, updated_at: new Date().toISOString() };
  slots = []; candidates = [source()]; saved = []; schedules = []; cancelled = []; renderCalls = []; uploads = []; productAssets = [];
  cancelFails = false; renderFails = false; pauseDuringRender = false; databaseFails = false; unconfirmedCancel = false;
  executionToken = null; preferenceFails = false; loseScheduleResponse = false; competingSweep = null;
  dailyLimit = 3; duringCollectionRead = null; beforeAutomationUpdate = null;
  beforeStorageProbe = null;
  settingsWriteError = null;
  databaseClient = null;
}
function query(table) {
  let action = "select", patch, filters = [];
  const builder = {
    select() { return this; }, order() { return this; }, limit() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    is(key, value) { filters.push([key, value]); return this; },
    update(value) { action = "update"; patch = value; return this; },
    insert(value) { action = "insert"; patch = value; return this; },
    upsert(value) { action = "upsert"; patch = value; return this; },
    single() { return execute(true); }, maybeSingle() { return execute(true); },
    then(resolve, reject) { return execute(false).then(resolve, reject); },
  };
  async function execute(single) {
    if (databaseFails) return { data: null, error: { code: "NETWORK", message: "database unavailable" } };
    if (action === "update" && table === "trending_slideshow_automations" && patch.config && settingsWriteError) return { data: null, error: settingsWriteError };
    if (action === "update" && table === "trending_slideshow_automations" && beforeAutomationUpdate) {
      const run = beforeAutomationUpdate; beforeAutomationUpdate = null; await run();
    }
    const rows = table === "trending_slideshow_automations" ? [automation] : table === "trending_slideshow_automation_slots" ? slots : [];
    const matches = rows.filter((row) => filters.every(([k, v]) => (row[k] ?? null) === v));
    if (action === "update") matches.forEach((row) => Object.assign(row, structuredClone(patch)));
    if (action === "insert") { slots.push(structuredClone(patch)); return { data: patch, error: null }; }
    return { data: single ? matches[0] ?? null : matches, error: null };
  }
  return builder;
}
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({ from: table => databaseClient && table === "trending_slideshow_automations" ? databaseClient.from(table) : query(table), rpc: async (name, input) => {
  if (name === "claim_slideshow_automation") {
    if (input.p_revision === -1 && beforeStorageProbe) { const run = beforeStorageProbe; beforeStorageProbe = null; await run(); }
    const available = automation.status === "active" && automation.revision === input.p_revision && (!executionToken || executionToken === input.p_token);
    if (available) executionToken = input.p_token;
    return { data: available, error: null };
  }
  if (name === "release_slideshow_automation") { if (executionToken === input.p_token) executionToken = null; return { data: null, error: null }; }
  if (name === "checkpoint_slideshow_automation_slot") {
    if (automation.status !== "active" || automation.revision !== input.p_revision || executionToken !== input.p_token) return { data: null, error: { code: "STALE" } };
    let row = slots.find(slot => slot.idempotency_key === input.p_row.idempotency_key);
    if (row?.schedule_id || row?.cancel_requested_at || row?.user_modified) return { data: row, error: null };
    if (row) Object.assign(row, structuredClone(input.p_row));
    else { row = { ...structuredClone(input.p_row), id: input.p_row.id ?? `slot-${slots.length + 1}` }; slots.push(row); }
    return { data: row, error: null };
  }
  if (name === "finish_slideshow_automation") {
    if (automation.status !== "active" || executionToken !== input.p_token || automation.revision !== input.p_revision) return { data: false, error: null };
    automation.rotation_cursor = input.p_rotation;
    if (input.p_reason) { automation.status = "needs_attention"; automation.attention_reason = input.p_reason; automation.attention_message = input.p_message; }
    return { data: true, error: null };
  }
  if (name === "fence_slideshow_automation_slot") {
    const row = slots.find(slot => slot.id === input.p_slot_id && slot.user_id === input.p_user_id);
    row.cancel_requested_at = new Date().toISOString(); return { data: row, error: null };
  }
  throw Error(`Unexpected RPC ${name}`);
} }) } });
mock.module(local("../business-profiles/db.ts"), { namedExports: { getBusinessProfileForUser: async () => ({ id: "owned-profile", profileVersion: 1 }) } });
mock.module(local("../carousel/db.ts"), { namedExports: {
  listCarouselGenerationStatusesForUser: async () => candidates.map((item) => ({ generation: item.generation, slides: item.slides })),
  getCarouselEditBackgrounds: async (ids) => ids.map((id) => ({ id, url: assets[0].url })),
  listCarouselProductAssets: async ({ businessProfileId, categorySlug }) => {
    assert.equal(businessProfileId, "owned-profile"); assert.equal(categorySlug, "productivity");
    return productAssets;
  },
} });
mock.module(local("../carousel/storage.ts"), { namedExports: { uploadRenderedCarouselSlide: async (input) => {
  uploads.push(input); return { key: `automation/${uploads.length}.webp`, url: `https://derived.test/${uploads.length}.webp` };
} } });
mock.module(local("../library/db.ts"), { namedExports: { saveGeneratedCarouselToLibrary: async (input) => {
  saved.push(structuredClone(input)); return { item: { id: `library-${saved.length}` } };
} } });
mock.module(local("../library/save-source.ts"), { namedExports: { prepareGeneratedCarouselLibrarySaveForOwner: async (owner, id) => {
  assert.equal(owner, "owner"); return structuredClone(candidates.find((item) => item.generation.id === id));
} } });
mock.module(local("../media/creative-asset-groups.ts"), { namedExports: {
  listCreativeAssetGroups: async () => [], listCreativeAssetGroupAssets: async ({ userId, groupId }) => {
    if (duringCollectionRead) { const run = duringCollectionRead; duringCollectionRead = null; await run(); }
    assert.equal(userId, "owner"); assert.equal(groupId, "collection"); return { assets: assets.map((asset) => ({ asset })) };
  },
} });
mock.module(local("../media/image-library.ts"), { namedExports: { isAvailableLibraryImage: (asset) => asset.status === "ready" } });
mock.module(local("../scheduling/publishing-preferences-db.ts"), { namedExports: { getPublishingPreferences: async () => {
  if (preferenceFails) throw Error("Publishing preferences unavailable"); return {};
} } });
mock.module(local("../scheduling/saved-captions-db.ts"), { namedExports: { getSavedCaptions: async () => ({ captions: [], revision: 0 }) } });
mock.module(local("../scheduling/service.ts"), { namedExports: {
  createUserSchedule: async (input) => {
    const row = slots.find(slot => slot.id === input.automationGuard.slotId);
    assert.ok(row && row.library_item_id, "checkpoint exists before scheduling");
    assert.equal(input.automationGuard.token, executionToken);
    schedules.push(input);
    row.schedule_id = `schedule-${schedules.length}`; row.status = "scheduled";
    if (loseScheduleResponse) throw Error("Lost acknowledgement");
    return { schedule: { id: row.schedule_id } };
  },
  listUserSchedules: async () => slots.filter((slot) => slot.schedule_id).map((slot) => ({ id: slot.schedule_id, status: "scheduled", scheduledFor: slot.scheduled_for,
    caption: slot.snapshot.captionText, libraryItemId: slot.library_item_id, targets: slot.snapshot.targets.map(target => ({ socialConnectionId: target.connectionId })), metadata: {} })),
  cancelUserSchedule: async (input) => {
    cancelled.push(input);
    if (cancelFails === true || cancelFails === input.postId) throw new Error("Publishing has already started");
    return { status: unconfirmedCancel ? "publishing" : "cancelled" };
  },
} });
mock.module(local("./unified-daily-feed-db.ts"), { namedExports: { getTrendingPlanEntitlement: async () => ({ dailyLimit, displayName: "Growth", planKey: "creator" }) } });
mock.module(local("./creative-edit-service.ts"), { namedExports: { loadSavedTrendingCreativeEditForDownstream: async () => null } });
mock.module(local("../../worker/src/lib/carousel-manual-render.ts"), { namedExports: { renderCarouselManualSlide: async (input) => {
  renderCalls.push(structuredClone(input));
  if (competingSweep) { const run = competingSweep; competingSweep = null; await run(); }
  if (pauseDuringRender) automation.status = "paused";
  if (renderFails) throw new Error("background download failed");
  return renderCarouselManualSlide(input);
} } });
process.env.SUPABASE_URL = "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
const { sweepActiveSlideshowAutomationForUser, pauseSlideshowAutomation, mutateAutomationSlot, saveAutomationDraftOrSettings, activateSlideshowAutomation } = await import("./slideshow-automation-service.ts");
const { prepareAutomationLibraryInput } = await import("./slideshow-automation-render.ts");

test("collection-only automation renders every real background, body/CTA and saved cover/body style into scheduled copies", async () => {
  reset();
  automation.config.backgrounds = { mode: "collection_only", collectionId: "collection", collectionName: "Owned", selectionMode: "subset", selectedAssetIds: [assets[1].id, assets[2].id] };
  automation.config.visualStyle = { ...automation.config.visualStyle, mode: "saved", styleId: "style", styleName: "Brand",
    style: { ...automation.config.visualStyle.style, fontSize: 36, headingSize: 64, color: "#fedcba", headingColor: "#ffdd00", outline: false }, textPosition: { x: .45, y: .55 } };
  const before = structuredClone(candidates[0]);
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.ok(schedules.length > 0);
  assert.equal(renderCalls.length, 4, "use actual four-slide count, not a hardcoded six");
  assert.deepEqual(renderCalls.map((r) => r.assetUrl), [assets[1].url, assets[2].url, assets[1].url, assets[2].url]);
  for (const call of renderCalls) {
    assert.deepEqual(call.slide.textStyle, automation.config.visualStyle.style);
    assert.deepEqual(call.slide.textPosition, { x: .45, y: .55 });
  }
  assert.equal(renderCalls[1].slide.subtext, "Body copy 1");
  assert.equal(renderCalls[3].slide.ctaText, "Learn more");
  for (let i = 0; i < uploads.length; i++) {
    const { data, info } = await sharp(uploads[i].buffer).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1080); assert.equal(info.height, 1350);
    const rgb = [...data.subarray(0, 3)];
    const expected = i % 2 === 0 ? [32, 64, 224] : [32, 192, 64];
    rgb.forEach((v, c) => assert.ok(Math.abs(v - expected[c]) < 12, "published image pixels use selected collection background"));
    const textRgb = i === 0 ? [255, 221, 0] : [254, 220, 186];
    let textPixels = 0;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      if (textRgb.every((v, c) => Math.abs(data[offset + c] - v) < 18)) textPixels++;
    }
    // WebP chroma subsampling blends thin body glyphs with the background.
    assert.ok(textPixels > 20, `slide ${i + 1}: saved heading/body colors produce actual visible text pixels (${textPixels})`);
    const artifact = new URL("../../.tmp/automation-render-qa/", import.meta.url);
    await mkdir(artifact, { recursive: true });
    await writeFile(new URL(`slide-${i + 1}.webp`, artifact), uploads[i].buffer);
  }
  assert.ok(saved[0].sourceId.startsWith("automation:"));
  assert.notEqual(saved[0].sourceId, before.generation.id);
  assert.ok(saved[0].slides.every((s) => s.renderedUrl.startsWith("https://derived.test/")));
  assert.equal(schedules[0].input.source.id, "library-1");
  assert.deepEqual(candidates[0], before, "original Trending slides and edit stay unchanged");
  assert.equal(slots[0].snapshot.slideCount, 4);
  assert.deepEqual(slots[0].snapshot.backgroundAssetIds, [assets[1].id, assets[2].id, assets[1].id, assets[2].id]);
  const scheduleCount = schedules.length;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, scheduleCount, "repeat sweep does not schedule the same slot again");
});

test("saved style alone re-renders raw original backgrounds, never flattened text-bearing slides", async () => {
  reset(); automation.config.visualStyle.mode = "saved";
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls.length, 4);
  assert.ok(renderCalls.every((r) => r.assetUrl === assets[0].url));
  assert.ok(saved[0].slides.every((s) => s.renderedUrl.startsWith("https://derived.test/")));
});

function productStoryFixture() {
  reset();
  candidates = [source("story", "structure_2", 6)];
  Object.assign(candidates[0].generation, { businessProfileId: "owned-profile", categorySlug: "productivity" });
  candidates[0].slides[5].storyRole = "takeaway_cta";
  candidates[0].slides[4].storyRole = "proof_reflection_cta";
  automation.config.counts = { dailyTotal: 1, educationalTipsCount: 0, productStoriesCount: 1 };
  automation.config.dailySlots = syncAutomationDailySlots({ counts: automation.config.counts, currentSlots: [] });
}

test("Structure 2 CTA uses the owned uploaded screenshot while other slides rotate collection images", async () => {
  productStoryFixture();
  productAssets = [{ id: "app-screenshot", url: assets[0].url }];
  automation.config.backgrounds = { mode: "collection_only", collectionId: "collection", collectionName: "Owned", selectionMode: "subset", selectedAssetIds: [assets[1].id, assets[2].id] };
  const before = structuredClone(candidates[0]);
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls.length, 6);
  assert.deepEqual(renderCalls.map(r => r.assetUrl), [1, 2, 1, 2, 1, 0].map(i => assets[i].url));
  assert.equal(renderCalls[5].slide.ctaText, "Learn more");
  assert.equal(slots[0].snapshot.ctaScreenshotAssetId, "app-screenshot");
  assert.deepEqual(slots[0].snapshot.backgroundAssetIds, [assets[1].id, assets[2].id, assets[1].id, assets[2].id, assets[1].id, "app-screenshot"]);
  assert.equal(automation.rotation_cursor, 1, "five collection slides advance the two-image cursor by one; CTA does not consume a position");
  assert.deepEqual(candidates[0], before);
  const { data } = await sharp(uploads[5].buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 170 && data[1] < 80 && data[2] < 80, "CTA contains screenshot pixels");
  const artifact = new URL("../../.tmp/trending-followup/", import.meta.url);
  await mkdir(artifact, { recursive: true });
  await writeFile(new URL("cta-screenshot-fixture.webp", artifact), uploads[5].buffer);
});

test("uploaded screenshot alone replaces only the default Structure 2 CTA, preserving other rendered slides", async () => {
  productStoryFixture(); productAssets = [{ id: "app-screenshot", url: assets[2].url }];
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls.length, 1); assert.equal(renderCalls[0].slide.slideNumber, 6);
  assert.equal(renderCalls[0].assetUrl, assets[2].url);
  assert.deepEqual(saved[0].slides.slice(0, 5), candidates[0].slides.slice(0, 5));
});

test("no active screenshot keeps collection/default CTA backgrounds and never adds screenshots to educational tips", async () => {
  productStoryFixture();
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls.length, 0); assert.deepEqual(saved[0].slides, candidates[0].slides);
  productStoryFixture();
  automation.config.backgrounds = { mode: "collection_only", collectionId: "collection", collectionName: "Owned", selectionMode: "all", selectedAssetIds: [] };
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls[5].assetUrl, assets[2].url);
  assert.equal(slots[0].snapshot.ctaScreenshotAssetId, null);
  reset(); productAssets = [{ id: "app-screenshot", url: assets[2].url }];
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls.length, 0);
});

test("screenshot render failure never silently schedules collection/default fallback", async () => {
  productStoryFixture(); productAssets = [{ id: "app-screenshot", url: assets[2].url }]; renderFails = true;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(saved.length, 0);
  assert.equal(slots[0].status, "preparing");
});

test("default appearance preserves original pixels and creates an isolated Library identity", async () => {
  reset(); await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(renderCalls.length, 0);
  assert.deepEqual(saved[0].slides, candidates[0].slides);
  assert.ok(saved[0].sourceId.startsWith("automation:"));
});

test("wrong format remains preparing without borrowing an available Product Story", async () => {
  reset(); candidates = [source("story", "structure_2")];
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(saved.length, 0);
  assert.ok(slots.every((s) => s.status === "preparing" && s.creative_id === null));
  assert.match(slots[0].hold_message, /Educational Tips/);
});

test("an empty selected subset never broadens to all collection images", async () => {
  reset(); automation.config.backgrounds = { mode: "collection_only", collectionId: "collection", collectionName: "Owned", selectionMode: "subset", selectedAssetIds: [] };
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(renderCalls.length, 0);
  assert.equal(slots[0].status, "held_collection_empty");
});

test("render failure never schedules the original slideshow or fabricates an account failure", async () => {
  reset(); automation.config.visualStyle.mode = "saved"; renderFails = true;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(saved.length, 0);
  assert.equal(slots[0].status, "preparing"); assert.match(slots[0].hold_message, /background download failed/);
  renderFails = false;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 1, "a later sweep retries the retained source after render recovery");
  assert.equal(slots[0].status, "scheduled");
});

test("pause during rendering prevents a stale sweep from creating a schedule", async () => {
  reset(); automation.config.visualStyle.mode = "saved"; pauseDuringRender = true;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0);
});
test("paused automation never starts rendering or scheduling in a background sweep", async () => {
  reset(); automation.status = "paused";
  const result = await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(result.skipped, true); assert.equal(renderCalls.length, 0); assert.equal(schedules.length, 0);
});

test("draft automation never starts background rendering or scheduling", async () => {
  reset(); automation.status = "draft";
  const result = await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(result.skipped, true); assert.equal(renderCalls.length, 0); assert.equal(schedules.length, 0);
});

test("concurrent background sweep cannot render or schedule the same slot twice", async () => {
  reset(); automation.config.visualStyle.mode = "saved";
  competingSweep = async () => {
    const result = await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
    assert.equal(result.scheduledSlotCount, 0);
  };
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 1); assert.equal(renderCalls.length, 4); assert.equal(executionToken, null);
});

test("owner cancellation during rendering fences the slot before Library save and publication", async () => {
  reset(); automation.config.visualStyle.mode = "saved";
  competingSweep = async () => { await mutateAutomationSlot({ userId: "owner", slotId: slots[0].id, action: "cancel" }); };
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(saved.length, 0);
  assert.equal(slots[0].status, "cancelled_by_user");
});

test("lost scheduling response retains atomic schedule checkpoint and a later sweep cannot rerender or repost", async () => {
  reset(); automation.config.visualStyle.mode = "saved"; loseScheduleResponse = true;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(slots[0].schedule_id, "schedule-1"); assert.equal(slots[0].status, "scheduled");
  assert.equal(automation.status, "active", "uncertain response is not fabricated account expiry");
  loseScheduleResponse = false;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 1); assert.equal(renderCalls.length, 4);
  await assert.rejects(mutateAutomationSlot({ userId: "owner", slotId: slots[0].id, action: "retry" }), /already has a saved schedule/);
});

test("failed preference read never uses defaults and releases the lease for recovery", async () => {
  reset(); preferenceFails = true;
  await assert.rejects(sweepActiveSlideshowAutomationForUser({ userId: "owner" }), /preferences unavailable/);
  assert.equal(schedules.length, 0); assert.equal(saved.length, 0); assert.equal(executionToken, null);
  preferenceFails = false;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 1);
});

test("old business-context sources and future-dated inventory cannot be used as today's fresh content", async () => {
  reset(); candidates[0].generation.businessProfileVersion = 0;
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(slots[0].status, "preparing");
  reset(); candidates[0].generation.availableOnLocalDate = "2099-01-01";
  await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(schedules.length, 0); assert.equal(saved.length, 0);
});

async function scheduledFixture() {
  reset(); await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(slots[0].status, "scheduled");
}
test("pause cancellation failure propagates, leaves slot scheduled and automation paused", async () => {
  await scheduledFixture(); cancelFails = true;
  await assert.rejects(pauseSlideshowAutomation({ userId: "owner", action: "cancel_upcoming_auto_slots" }), /Publishing has already started/);
  assert.equal(automation.status, "paused"); assert.equal(slots[0].status, "scheduled");
});
test("cancel and skip failures never record false cancellation", async () => {
  for (const action of ["cancel", "skip"]) {
    await scheduledFixture(); cancelFails = true;
    await assert.rejects(mutateAutomationSlot({ userId: "owner", slotId: slots[0].id, action }), /Publishing has already started/);
    assert.equal(slots[0].status, "scheduled"); assert.equal(slots[0].user_modified, false);
  }
});
test("unconfirmed cancellation never marks the slot cancelled", async () => {
  await scheduledFixture(); unconfirmedCancel = true;
  await assert.rejects(mutateAutomationSlot({ userId: "owner", slotId: slots[0].id, action: "cancel" }), /not confirmed cancellation/);
  assert.equal(slots[0].status, "scheduled");
});
test("partial pause cancellation preserves successes and surfaces the failed slot", async () => {
  await scheduledFixture();
  slots.push({ ...structuredClone(slots[0]), id: "other-slot", schedule_id: "other-schedule", idempotency_key: "other-key", slot_time: "23:00" });
  cancelFails = "other-schedule";
  await assert.rejects(pauseSlideshowAutomation({ userId: "owner", action: "cancel_upcoming_auto_slots" }), /Could not cancel an automated post/);
  assert.equal(automation.status, "paused");
  assert.equal(slots[0].status, "cancelled_by_user");
  assert.equal(slots.find((s) => s.id === "other-slot").status, "scheduled");
});
test("successful cancellation confirms the schedule before updating the slot", async () => {
  await scheduledFixture();
  const upcomingCount = slots.length;
  const result = await pauseSlideshowAutomation({ userId: "owner", action: "cancel_upcoming_auto_slots" });
  assert.equal(cancelled.length, 1); assert.equal(result.cancelledSlotCount, upcomingCount);
  assert.equal(slots[0].status, "cancelled_by_user");
});
test("pause preserves manually changed slots and keep-scheduled choice", async () => {
  await scheduledFixture(); slots[0].user_modified = true;
  await pauseSlideshowAutomation({ userId: "owner", action: "cancel_upcoming_auto_slots" });
  assert.equal(cancelled.length, 0); assert.equal(slots[0].status, "scheduled");
  await scheduledFixture();
  await pauseSlideshowAutomation({ userId: "owner", action: "keep_scheduled_slots" });
  assert.equal(cancelled.length, 0); assert.equal(slots[0].status, "scheduled");
});
test("derived renderer fails closed on missing raw backgrounds and stale saved edits", async () => {
  reset(); const cfg = config(); cfg.visualStyle.mode = "saved";
  const dependencies = { backgrounds: async () => [], savedEdit: async () => null, render: () => assert.fail("must not render"), upload: () => assert.fail("must not upload") };
  await assert.rejects(prepareAutomationLibraryInput({ source: source(), config: cfg, collectionAssets: [], rotationCursor: 0, idempotencyKey: "key" }, dependencies), /background is unavailable/);
  const edited = source(); edited.edit = { id: "edit", revision: 2, slides: [] };
  await assert.rejects(prepareAutomationLibraryInput({ source: edited, config: cfg, collectionAssets: [], rotationCursor: 0, idempotencyKey: "key" }, dependencies), /edit changed/);
});

test("settings save preserves a concurrent pause during collection lookup and cannot schedule afterward", async () => {
  reset(); const originalConfig = structuredClone(automation.config);
  const cfg = config(); cfg.backgrounds = { mode: "collection_only", collectionId: "collection", collectionName: "Owned", selectionMode: "all", selectedAssetIds: [] };
  duringCollectionRead = async () => { await pauseSlideshowAutomation({ userId: "owner", action: "keep_scheduled_slots" }); };
  await assert.rejects(saveAutomationDraftOrSettings({ userId: "owner", config: cfg }), error => error.status === 409 && /changed/.test(error.message));
  assert.equal(automation.status, "paused"); assert.ok(automation.paused_at);
  assert.deepEqual(automation.config, originalConfig); assert.equal(automation.revision, 2);
  const result = await sweepActiveSlideshowAutomationForUser({ userId: "owner" });
  assert.equal(result.skipped, true); assert.equal(schedules.length, 0); assert.equal(renderCalls.length, 0);
});

test("settings save fences a pause immediately before its database write", async () => {
  reset(); const cfg = config(); cfg.caption = { mode: "blank" };
  beforeAutomationUpdate = async () => { await pauseSlideshowAutomation({ userId: "owner", action: "keep_scheduled_slots" }); };
  await assert.rejects(saveAutomationDraftOrSettings({ userId: "owner", config: cfg }), error => error.status === 409);
  assert.equal(automation.status, "paused"); assert.equal(automation.revision, 2);
});

test("stale settings revision cannot overwrite a newer save with the same active status", async () => {
  reset(); const newer = config(); newer.caption = { mode: "saved_caption", captionText: "Newer owner settings" };
  beforeAutomationUpdate = async () => { await saveAutomationDraftOrSettings({ userId: "owner", config: newer }); };
  await assert.rejects(saveAutomationDraftOrSettings({ userId: "owner", config: config() }), error => error.status === 409);
  assert.equal(automation.revision, 3); assert.equal(automation.config.caption.captionText, "Newer owner settings");
});

test("active and attention settings reject mixed structures on single-batch plans without changing saved state", async () => {
  for (const status of ["active", "needs_attention"]) {
    reset(); automation.status = status; dailyLimit = 5;
    const before = structuredClone(automation); const cfg = config(); cfg.counts = { dailyTotal: 3, educationalTipsCount: 1, productStoriesCount: 2 };
    await assert.rejects(saveAutomationDraftOrSettings({ userId: "owner", config: cfg }), error => error.status === 409 && /one structure/.test(error.message));
    assert.deepEqual(automation, before); assert.equal(schedules.length, 0);
  }
});

test("activation applies the same mixed-structure restriction as active settings edits", async () => {
  reset(); automation.status = "draft"; dailyLimit = 5;
  const cfg = config(); cfg.counts = { dailyTotal: 3, educationalTipsCount: 1, productStoriesCount: 2 };
  await saveAutomationDraftOrSettings({ userId: "owner", config: cfg });
  await assert.rejects(activateSlideshowAutomation({ userId: "owner" }), error => error.status === 409 && /one structure/.test(error.message));
  assert.equal(automation.status, "draft"); assert.equal(schedules.length, 0);
});

test("mixed drafts and paused setups stay editable while supported active mixtures and single structures still save", async () => {
  for (const status of ["draft", "paused", "active"]) {
    reset(); automation.status = status; dailyLimit = status === "active" ? 10 : 5;
    const cfg = config(); cfg.counts = { dailyTotal: 3, educationalTipsCount: 1, productStoriesCount: 2 };
    await saveAutomationDraftOrSettings({ userId: "owner", config: cfg });
    assert.equal(automation.status, status); assert.equal(automation.revision, 3);
    assert.deepEqual(automation.config.counts, cfg.counts); assert.equal(schedules.length, 0);
  }
  for (const educationalTipsCount of [0, 3]) {
    reset(); dailyLimit = 5; const cfg = config(); cfg.counts = { dailyTotal: 3, educationalTipsCount, productStoriesCount: 3 - educationalTipsCount };
    await saveAutomationDraftOrSettings({ userId: "owner", config: cfg });
    assert.equal(automation.status, "active"); assert.equal(automation.revision, 3);
  }
});

test("in-flight activation cannot undo a newer pause", async () => {
  reset();
  beforeStorageProbe = async () => { await pauseSlideshowAutomation({ userId: "owner", action: "keep_scheduled_slots" }); };
  await assert.rejects(activateSlideshowAutomation({ userId: "owner" }), error => error.status === 409);
  assert.equal(automation.status, "paused"); assert.equal(schedules.length, 0); assert.equal(renderCalls.length, 0);
});

test("a paused setup stays paused on save and resumes only through explicit activation", async () => {
  reset(); automation.status = "paused"; automation.paused_at = new Date().toISOString();
  await saveAutomationDraftOrSettings({ userId: "owner", config: config() });
  assert.equal(automation.status, "paused"); assert.equal(schedules.length, 0);
  const result = await activateSlideshowAutomation({ userId: "owner" });
  assert.equal(result.automation.status, "active"); assert.equal(result.automation.pausedAt, null);
  assert.equal(schedules.length, 1);
});

test("activation cannot accept settings changed after its validation", async () => {
  reset(); automation.status = "draft"; dailyLimit = 5;
  beforeStorageProbe = async () => {
    const cfg = config(); cfg.counts = { dailyTotal: 3, educationalTipsCount: 1, productStoriesCount: 2 };
    await saveAutomationDraftOrSettings({ userId: "owner", config: cfg });
  };
  await assert.rejects(activateSlideshowAutomation({ userId: "owner" }), error => error.status === 409);
  assert.equal(automation.status, "draft"); assert.equal(automation.revision, 3); assert.equal(schedules.length, 0);
});

test("guarded settings errors never retry through unfenced fallback storage", async () => {
  for (const code of ["NETWORK", "42P01", "PGRST205"]) {
    reset(); const before = structuredClone(automation); settingsWriteError = { code, message: "Fixture guarded write failure" };
    await assert.rejects(saveAutomationDraftOrSettings({ userId: "owner", config: config() }), error => error.status === 503);
    assert.deepEqual(automation, before); assert.equal(schedules.length, 0);
  }
});

test("real Supabase update filters and PostgreSQL reject a save after Pause commits", async () => {
  reset(); const db = new PGlite(); const requests = [];
  try {
    await db.exec("create table trending_slideshow_automations (user_id text primary key,status text,revision integer,config jsonb,rotation_cursor integer,activated_at text,paused_at text,updated_at text,attention_reason text,attention_message text)");
    const initial = Object.entries(automation);
    await db.query(`insert into trending_slideshow_automations (${initial.map(([key]) => key).join(",")}) values (${initial.map((_, index) => `$${index + 1}`).join(",")})`, initial.map(([, value]) => typeof value === "object" && value !== null ? JSON.stringify(value) : value));
    let pauseBeforeWrite = true;
    databaseClient = createActualClient("https://example.invalid", "fixture-only", { auth: { persistSession: false }, global: {
      fetch: async (input, init) => {
        const url = new URL(input); const patch = init.method === "PATCH" ? JSON.parse(init.body) : null;
        requests.push({ method: init.method, search: url.search });
        if (patch?.config && pauseBeforeWrite) {
          pauseBeforeWrite = false;
          await pauseSlideshowAutomation({ userId: "owner", action: "keep_scheduled_slots" });
        }
        const values = []; const fields = new Set(Object.keys(automation));
        const bind = value => { values.push(value); return `$${values.length}`; };
        const assignments = patch ? Object.entries(patch).map(([key, value]) => {
          assert.ok(fields.has(key)); return `${key}=${bind(key === "config" ? JSON.stringify(value) : value)}`;
        }) : [];
        const filters = [...url.searchParams].filter(([key]) => key !== "select").map(([key, value]) => {
          assert.ok(fields.has(key)); assert.ok(value.startsWith("eq."));
          return `${key}=${bind(value.slice(3))}`;
        });
        const sql = patch ? `update trending_slideshow_automations set ${assignments.join(",")} where ${filters.join(" and ")} returning *`
          : `select * from trending_slideshow_automations where ${filters.join(" and ")}`;
        const { rows } = await db.query(sql, values);
        const objectResponse = new Headers(init.headers).get("accept")?.includes("application/vnd.pgrst.object+json");
        if (objectResponse && rows.length === 0) return new Response(JSON.stringify({ code: "PGRST116", details: "The result contains 0 rows", message: "Cannot coerce the result to a single JSON object" }), { status: 406, headers: { "Content-Type": "application/json" } });
        return new Response(JSON.stringify(objectResponse ? rows[0] : rows), { headers: { "Content-Type": "application/json" } });
      },
    } });
    await assert.rejects(saveAutomationDraftOrSettings({ userId: "owner", config: config() }), error => error.status === 409);
    const { rows: [row] } = await db.query("select * from trending_slideshow_automations");
    assert.equal(row.status, "paused"); assert.ok(row.paused_at); assert.equal(row.revision, 2);
    assert.ok(requests.some(request => request.method === "PATCH" && request.search.includes("revision=eq.2") && request.search.includes("status=eq.active")));
    // Reload and an ordinary paused settings save still succeed through the
    // actual client, without treating a saved draft as a request to activate.
    const cfg = config(); cfg.caption = { mode: "blank" };
    const result = await saveAutomationDraftOrSettings({ userId: "owner", config: cfg });
    assert.equal(result.status, "paused"); assert.equal(result.revision, 3);
  } finally { databaseClient = null; await db.close(); }
});
