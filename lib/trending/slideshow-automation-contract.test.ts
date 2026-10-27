import assert from "node:assert/strict";
import test from "node:test";

import { defaultCarouselManualTextStyle } from "@/lib/carousel/manual-text";
import {
  adjustAutomationFormatCount,
  allocateCollectionOnlySlideBackgrounds,
  applyAutomationQuickMode,
  createDefaultAutomationConfig,
  deriveQuickModeFromCounts,
  evaluateAutomationSlotTiming,
  mapAutomationFormatToBackendStyle,
  mapAutomationFormatToStructureId,
  planUpcomingAutomationOccurrences,
  selectSlotsToCancelOnPause,
  setAutomationDailyTotal,
  syncAutomationDailySlots,
  TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META,
  type TrendingSlideshowAutomationSlotRecord,
  validateAutomationConfigForActivation,
  validateAutomationContentCounts,
} from "@/lib/trending/slideshow-automation-contract";

test("maps Option A frontend naming cleanly to existing backend styles and structures", () => {
  assert.equal(
    TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META.educational_tips.title,
    "Educational Tips",
  );
  assert.equal(
    TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META.educational_tips.subtitle,
    "Value-first · No product pitch",
  );
  assert.equal(
    mapAutomationFormatToBackendStyle("educational_tips"),
    "helpful_tips",
  );
  assert.equal(
    mapAutomationFormatToStructureId("educational_tips"),
    "structure_1",
  );

  assert.equal(
    TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META.product_stories.title,
    "Product Stories",
  );
  assert.equal(
    TRENDING_SLIDESHOW_AUTOMATION_FORMAT_META.product_stories.subtitle,
    "Story-led · Ends with a CTA",
  );
  assert.equal(
    mapAutomationFormatToBackendStyle("product_stories"),
    "product_stories_cta",
  );
  assert.equal(
    mapAutomationFormatToStructureId("product_stories"),
    "structure_2",
  );
});

test("maintains exact daily counts across quick modes, steppers, and daily total changes", () => {
  const custom = applyAutomationQuickMode({
    dailyTotal: 3,
    quickMode: "custom_mix",
  });
  assert.deepEqual(custom, {
    dailyTotal: 3,
    educationalTipsCount: 1,
    productStoriesCount: 2,
  });
  assert.equal(deriveQuickModeFromCounts(custom), "custom_mix");
  assert.equal(validateAutomationContentCounts(custom, 5).ok, true);

  const incremented = adjustAutomationFormatCount({
    counts: custom,
    delta: 1,
    format: "educational_tips",
    maxAllowance: 5,
  });
  assert.deepEqual(incremented, {
    dailyTotal: 3,
    educationalTipsCount: 2,
    productStoriesCount: 1,
  });

  const allProduct = applyAutomationQuickMode({
    dailyTotal: 3,
    quickMode: "all_product_stories",
  });
  assert.deepEqual(allProduct, {
    dailyTotal: 3,
    educationalTipsCount: 0,
    productStoriesCount: 3,
  });
  assert.equal(deriveQuickModeFromCounts(allProduct), "all_product_stories");

  const resized = setAutomationDailyTotal({
    counts: custom,
    dailyTotal: 4,
    maxAllowance: 5,
    quickMode: "custom_mix",
  });
  assert.equal(resized.counts.dailyTotal, 4);
  assert.equal(
    resized.counts.educationalTipsCount + resized.counts.productStoriesCount,
    4,
  );
});

test("synchronizes Step 3 daily posting time slots with Step 1 exact format counts", () => {
  const slots = syncAutomationDailySlots({
    counts: {
      dailyTotal: 3,
      educationalTipsCount: 1,
      productStoriesCount: 2,
    },
    currentSlots: [
      { format: "product_stories", slotIndex: 1, time: "10:15" },
      { format: "product_stories", slotIndex: 2, time: "15:45" },
    ],
  });

  assert.equal(slots.length, 3);
  assert.deepEqual(
    slots.map((slot) => ({
      format: slot.format,
      slotIndex: slot.slotIndex,
      time: slot.time,
    })),
    [
      { format: "educational_tips", slotIndex: 1, time: "10:15" },
      { format: "product_stories", slotIndex: 2, time: "15:45" },
      { format: "product_stories", slotIndex: 3, time: "18:00" },
    ],
  );
});

test("enforces strict collection-only background rotation and never substitutes default images when empty", () => {
  const emptyResult = allocateCollectionOnlySlideBackgrounds({
    availableCollectionAssetIds: [],
    collectionName: "Summer Studio",
    rotationCursor: 0,
    selectionMode: "all",
    slideCount: 6,
  });
  assert.equal(emptyResult.ok, false);
  if (!emptyResult.ok) {
    assert.equal(emptyResult.status, "held_collection_empty");
    assert.match(emptyResult.holdMessage, /0 usable images/);
    assert.match(
      emptyResult.holdMessage,
      /default backgrounds are never substituted automatically/,
    );
  }

  const smallPoolResult = allocateCollectionOnlySlideBackgrounds({
    availableCollectionAssetIds: ["asset-1", "asset-2", "asset-3", "asset-4"],
    collectionName: "Summer Studio",
    rotationCursor: 1,
    selectionMode: "all",
    slideCount: 6,
  });
  assert.equal(smallPoolResult.ok, true);
  if (smallPoolResult.ok) {
    assert.deepEqual(smallPoolResult.AssignedAssetIds, [
      "asset-2",
      "asset-3",
      "asset-4",
      "asset-1",
      "asset-2",
      "asset-3",
    ]);
    assert.equal(smallPoolResult.repeatedWithinSlideshow, true);
    assert.equal(smallPoolResult.nextRotationCursor, 3);
    assert.match(smallPoolResult.warningMessage ?? "", /images will repeat/);
  }
});

test("holds missed posting windows instead of silently publishing late", () => {
  const nowMs = Date.parse("2026-10-26T14:00:00.000Z"); // 10:00 EDT in America/New_York
  const missed = evaluateAutomationSlotTiming({
    localDate: "2026-10-26",
    minimumLeadMinutes: 5,
    nowMs,
    slotTime: "09:00",
    timezone: "America/New_York",
  });
  assert.equal(missed.ok, false);
  if (!missed.ok) {
    assert.equal(missed.status, "missed_posting_time");
    assert.match(missed.holdMessage, /never publishes late/);
  }

  const upcoming = evaluateAutomationSlotTiming({
    localDate: "2026-10-26",
    minimumLeadMinutes: 5,
    nowMs,
    slotTime: "13:30",
    timezone: "America/New_York",
  });
  assert.equal(upcoming.ok, true);
});

test("validates activation requirements and respects userModified slots when pausing", () => {
  const config = createDefaultAutomationConfig({
    dailyAllowance: 5,
    nowMs: Date.parse("2026-10-26T12:00:00.000Z"),
    timezone: "America/New_York",
  });

  // Missing destination accounts fails activation
  const missingTargets = validateAutomationConfigForActivation({
    config,
    dailyAllowance: 5,
  });
  assert.equal(missingTargets.ok, false);

  // Add valid Instagram and TikTok targets
  config.targets = [
    {
      accountLabel: "@brand.ig",
      connectionId: "conn-ig-1",
      platform: "instagram",
    },
    {
      accountLabel: "@brand.tt",
      connectionId: "conn-tt-1",
      platform: "tiktok",
      tiktokAiGeneratedContent: false,
      tiktokMusicUsageAccepted: true,
      tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE",
    },
  ];
  const validResult = validateAutomationConfigForActivation({
    config,
    dailyAllowance: 5,
  });
  assert.equal(validResult.ok, true);

  const occurrences = planUpcomingAutomationOccurrences({
    config,
    horizonHours: 36,
    nowMs: Date.parse("2026-10-26T12:00:00.000Z"),
  });
  assert.equal(occurrences.length >= 2, true);

  const sampleSlots: TrendingSlideshowAutomationSlotRecord[] = [
    {
      createdAt: "2026-10-26T12:00:00.000Z",
      creativeId: "c-1",
      format: "educational_tips",
      holdMessage: null,
      id: "slot-auto-1",
      idempotencyKey: "automation:u1:2026-10-26:18:00",
      libraryItemId: "lib-1",
      localDate: "2026-10-26",
      scheduleId: "sched-1",
      scheduledFor: "2026-10-26T22:00:00.000Z",
      slotIndex: 1,
      slotTime: "18:00",
      snapshot: {
        backgroundAssetIds: [],
        backgroundMode: "default",
        captionText: "",
        collectionId: null,
        collectionName: null,
        configRevision: 1,
        format: "educational_tips",
        headlinePreview: "5 Daily Habits",
        slideCount: 6,
        structureId: "structure_1",
        targets: config.targets,
        visualStyle: defaultCarouselManualTextStyle(),
        visualStyleName: "Default style",
      },
      status: "scheduled",
      timezone: "America/New_York",
      updatedAt: "2026-10-26T12:00:00.000Z",
      userId: "u1",
      userModified: false,
    },
    {
      createdAt: "2026-10-26T12:00:00.000Z",
      creativeId: "c-2",
      format: "product_stories",
      holdMessage: null,
      id: "slot-user-edited-2",
      idempotencyKey: "automation:u1:2026-10-27:09:00",
      libraryItemId: "lib-2",
      localDate: "2026-10-27",
      scheduleId: "sched-2",
      scheduledFor: "2026-10-27T13:00:00.000Z",
      slotIndex: 2,
      slotTime: "09:00",
      snapshot: {
        backgroundAssetIds: [],
        backgroundMode: "default",
        captionText: "",
        collectionId: null,
        collectionName: null,
        configRevision: 1,
        format: "product_stories",
        headlinePreview: "Why We Built It",
        slideCount: 6,
        structureId: "structure_2",
        targets: config.targets,
        visualStyle: defaultCarouselManualTextStyle(),
        visualStyleName: "Default style",
      },
      status: "scheduled",
      timezone: "America/New_York",
      updatedAt: "2026-10-26T12:00:00.000Z",
      userId: "u1",
      userModified: true,
    },
  ];

  const cancelledIds = selectSlotsToCancelOnPause({
    action: "cancel_upcoming_auto_slots",
    nowMs: Date.parse("2026-10-26T12:00:00.000Z"),
    slots: sampleSlots,
  });
  assert.deepEqual(cancelledIds, ["slot-auto-1"]);
});
