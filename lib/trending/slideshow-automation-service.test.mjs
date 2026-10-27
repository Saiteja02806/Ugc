import assert from "node:assert/strict";
import { mock, test } from "node:test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { renderCarouselManualSlide } from "../../worker/dist/lib/carousel-manual-render.js";

const local = (path) => new URL(path, import.meta.url);
const { createDefaultAutomationConfig, syncAutomationDailySlots } =
  await import("./slideshow-automation-contract.ts");
let automation, slots, candidates, saved, schedules, cancelled, renderCalls, uploads;
let cancelFails, renderFails, pauseDuringRender, databaseFails, unconfirmedCancel;
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
    edit: null, generation: { id, userId: "owner", projectId: "project", status: "completed", structureId, format: "4:5", slideCount: count },
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
  slots = []; candidates = [source()]; saved = []; schedules = []; cancelled = []; renderCalls = []; uploads = [];
  cancelFails = false; renderFails = false; pauseDuringRender = false; databaseFails = false; unconfirmedCancel = false;
}
function query(table) {
  let action = "select", patch, filters = [];
  const builder = {
    select() { return this; }, order() { return this; }, limit() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    update(value) { action = "update"; patch = value; return this; },
    insert(value) { action = "insert"; patch = value; return this; },
    upsert(value) { action = "upsert"; patch = value; return this; },
    single() { return execute(true); }, maybeSingle() { return execute(true); },
    then(resolve, reject) { return execute(false).then(resolve, reject); },
  };
  async function execute(single) {
    if (databaseFails) return { data: null, error: { code: "NETWORK", message: "database unavailable" } };
    const rows = table === "trending_slideshow_automations" ? [automation] : table === "trending_slideshow_automation_slots" ? slots : [];
    const matches = rows.filter((row) => filters.every(([k, v]) => row[k] === v));
    if (action === "update") matches.forEach((row) => Object.assign(row, structuredClone(patch)));
    if (action === "insert") { slots.push(structuredClone(patch)); return { data: patch, error: null }; }
    return { data: single ? matches[0] ?? null : matches, error: null };
  }
  return builder;
}
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({ from: query }) } });
mock.module(local("../carousel/db.ts"), { namedExports: {
  listCarouselGenerationStatusesForUser: async () => candidates.map((item) => ({ generation: item.generation, slides: item.slides })),
  getCarouselEditBackgrounds: async (ids) => ids.map((id) => ({ id, url: assets[0].url })),
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
    assert.equal(userId, "owner"); assert.equal(groupId, "collection"); return { assets: assets.map((asset) => ({ asset })) };
  },
} });
mock.module(local("../media/image-library.ts"), { namedExports: { isAvailableLibraryImage: (asset) => asset.status === "ready" } });
mock.module(local("../scheduling/publishing-preferences-db.ts"), { namedExports: { getPublishingPreferences: async () => ({}) } });
mock.module(local("../scheduling/saved-captions-db.ts"), { namedExports: { getSavedCaptions: async () => ({ captions: [], revision: 0 }) } });
mock.module(local("../scheduling/service.ts"), { namedExports: {
  createUserSchedule: async (input) => { schedules.push(input); return { schedule: { id: `schedule-${schedules.length}` } }; },
  listUserSchedules: async () => slots.filter((slot) => slot.schedule_id).map((slot) => ({ id: slot.schedule_id, status: "scheduled", scheduledFor: slot.scheduled_for, targets: [] })),
  cancelUserSchedule: async (input) => {
    cancelled.push(input);
    if (cancelFails === true || cancelFails === input.postId) throw new Error("Publishing has already started");
    return { status: unconfirmedCancel ? "publishing" : "cancelled" };
  },
} });
mock.module(local("./unified-daily-feed-db.ts"), { namedExports: { getTrendingPlanEntitlement: async () => ({ dailyLimit: 3, displayName: "Growth", planKey: "creator" }) } });
mock.module(local("./creative-edit-service.ts"), { namedExports: { loadSavedTrendingCreativeEditForDownstream: async () => null } });
mock.module(local("../../worker/src/lib/carousel-manual-render.ts"), { namedExports: { renderCarouselManualSlide: async (input) => {
  renderCalls.push(structuredClone(input));
  if (pauseDuringRender) automation.status = "paused";
  if (renderFails) throw new Error("background download failed");
  return renderCarouselManualSlide(input);
} } });
process.env.SUPABASE_URL = "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
const { sweepActiveSlideshowAutomationForUser, pauseSlideshowAutomation, mutateAutomationSlot } = await import("./slideshow-automation-service.ts");
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
