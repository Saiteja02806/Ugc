import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReactionBriefBatch,
  buildReactionBriefGenerationPrompt,
  ReactionBriefError,
  type ReactionAvailabilityPalette,
  type ReactionBrief,
} from "./briefs.ts";
import {
  buildReactionAvailabilityPalette,
  selectReactionBatch,
} from "./batch-matcher.ts";
import type { ReactionAsset, ReactionBackgroundAsset } from "./matcher.ts";
import { planReactionBatch } from "./planner.ts";
import type { ReactionClipType, ReactionContent } from "./taxonomy.ts";

const background: ReactionBackgroundAsset = {
  contextTags: ["outdoor"],
  foregroundPlacement: "bottom_center",
  id: "background-outdoor",
  status: "active",
};

test("availability gives AI intents and counts, never asset IDs", () => {
  const palette = buildReactionAvailabilityPalette({
    backgrounds: [background],
    clipHistoryById: new Map([
      ["clip-reused", { lastShownAt: "2026-09-01T00:00:00.000Z", shownCount: 1 }],
    ]),
    clips: [
      clip("clip-fresh", "facepalm"),
      clip("clip-reused", "deadpan"),
      { ...clip("clip-no-background", "relief"), placement: { anchor: "center", heightPercent: 0.6 } },
    ],
  });

  assert.deepEqual(palette.availableReactionPalette, [
    { freshClipCount: 1, intent: "facepalm", reusableClipCount: 0 },
    { freshClipCount: 0, intent: "deadpan", reusableClipCount: 1 },
  ]);
  assert.deepEqual(palette.recentlyShownIntents, ["deadpan"]);

  const prompt = buildReactionBriefGenerationPrompt({
    availability: palette,
    context: generationContext(),
    requestedCount: 2,
  });
  assert.match(prompt, /never return a clip ID, background ID, filename, URL, or storage key/u);
  assert.doesNotMatch(prompt, /clip-fresh/u);
});

test("brief validation rejects repeated primary intent when varied eligible intents exist", () => {
  const availability = availabilityFor([
    "facepalm",
    "side_eye",
    "relief",
  ]);
  const response = {
    briefs: [
      rawBrief(0, "facepalm", "frustration"),
      rawBrief(1, "facepalm", "frustration"),
    ],
  };

  assert.throws(
    () => assertReactionBriefBatch({ availability, expectedCount: 2, value: response }),
    (error: unknown) =>
      error instanceof ReactionBriefError &&
      error.issues.some((issue) => issue.includes("repeat a primary reaction")),
  );
});

test("brief validation rejects an unavailable primary reaction even with an available fallback", () => {
  const availability = availabilityFor(["facepalm"]);
  const response = {
    briefs: [
      {
        ...rawBrief(0, "facepalm", "frustration"),
        preferredReactions: ["side_eye", "facepalm"],
      },
    ],
  };

  assert.throws(
    () => assertReactionBriefBatch({ availability, expectedCount: 1, value: response }),
    (error: unknown) =>
      error instanceof ReactionBriefError &&
      error.issues.some((issue) => issue.includes("primary reaction intent is not currently available")),
  );
});

test("batch matching uses fresh unique clips first, then eligible prior clips", () => {
  const types = [
    "facepalm",
    "side_eye",
    "relief",
    "celebration",
    "deadpan",
  ] as const;
  const clips = types.map((type) => clip(`clip-${type}`, type));
  const briefs = types.map((type, slotIndex) => brief(slotIndex, type));
  const result = selectReactionBatch({
    backgrounds: [background],
    briefs,
    clipHistoryById: new Map([
      ["clip-celebration", { lastShownAt: "2026-08-01T00:00:00.000Z", shownCount: 1 }],
      ["clip-deadpan", { lastShownAt: "2026-08-02T00:00:00.000Z", shownCount: 1 }],
    ]),
    clips,
    nowMs: Date.parse("2026-09-06T00:00:00.000Z"),
    seed: "phase3-freshness",
  });

  assert.equal(result.selected.length, 5);
  assert.equal(result.shortfallCount, 0);
  assert.equal(new Set(result.selected.map((selection) => selection.clip.id)).size, 5);
  assert.equal(result.selected.filter((selection) => selection.freshness === "fresh").length, 3);
  assert.equal(result.selected.filter((selection) => selection.freshness === "reused").length, 2);
  assert.ok(
    result.selected
      .filter((selection) => selection.freshness === "reused")
      .every((selection) => selection.reuseReason === "reused_after_fresh_catalog_exhausted"),
  );
});

test("batch matching reports a real catalog shortfall instead of duplicating a clip", () => {
  const onlyClip = clip("clip-facepalm", "facepalm");
  const result = selectReactionBatch({
    backgrounds: [background],
    briefs: [brief(0, "facepalm"), brief(1, "facepalm")],
    clips: [onlyClip],
    nowMs: Date.parse("2026-09-06T00:00:00.000Z"),
    seed: "phase3-shortfall",
  });

  assert.equal(result.selected.length, 1);
  assert.equal(result.shortfallCount, 1);
  assert.deepEqual(result.unmatchedSlotIndexes, [1]);
});

test("a clip shown twice to a user is no longer eligible for another Reaction", () => {
  const exhaustedClip = clip("clip-facepalm", "facepalm");
  const result = selectReactionBatch({
    backgrounds: [background],
    briefs: [brief(0, "facepalm")],
    clipHistoryById: new Map([
      ["clip-facepalm", { lastShownAt: "2026-09-05T00:00:00.000Z", shownCount: 2 }],
    ]),
    clips: [exhaustedClip],
    nowMs: Date.parse("2026-09-06T00:00:00.000Z"),
    seed: "phase3-presentation-cap",
  });

  assert.equal(result.selected.length, 0);
  assert.equal(result.shortfallCount, 1);
});

test("batch matching preserves a unique clip for the brief that has no alternative", () => {
  const result = selectReactionBatch({
    backgrounds: [background],
    briefs: [
      {
        ...brief(0, "facepalm"),
        preferredReactions: ["facepalm", "side_eye"],
      },
      brief(1, "facepalm"),
    ],
    clips: [clip("clip-facepalm", "facepalm"), clip("clip-side-eye", "side_eye")],
    nowMs: Date.parse("2026-09-06T00:00:00.000Z"),
    seed: "phase3-global-assignment",
  });

  assert.equal(result.selected.length, 2);
  assert.equal(
    result.selected.find((selection) => selection.brief.slotIndex === 1)?.clip.id,
    "clip-facepalm",
  );
  assert.equal(
    result.selected.find((selection) => selection.brief.slotIndex === 0)?.clip.id,
    "clip-side-eye",
  );
});

test("planner keeps asset IDs outside the AI boundary and returns one batch plan", async () => {
  const clips = [clip("clip-facepalm", "facepalm"), clip("clip-relief", "relief")];
  let prompt = "";
  const plan = await planReactionBatch({
    backgrounds: [background],
    clips,
    context: generationContext(),
    generateBriefs: async (request) => {
      prompt = request.prompt;
      assert.equal(request.expectedCount, 2);
      return {
        briefs: [
          rawBrief(0, "facepalm", "frustration"),
          rawBrief(1, "relief", "relief"),
        ],
      };
    },
    nowMs: Date.parse("2026-09-06T00:00:00.000Z"),
    requestedCount: 2,
    seed: "phase3-orchestration",
  });

  assert.doesNotMatch(prompt, /clip-facepalm|background-outdoor/u);
  assert.equal(plan.briefs.length, 2);
  assert.equal(plan.selection.selected.length, 2);
  assert.equal(plan.selection.shortfallCount, 0);
});

test("planner does not call AI when the active catalog has no eligible pair", async () => {
  let called = false;
  await assert.rejects(
    () =>
      planReactionBatch({
        backgrounds: [],
        clips: [clip("clip-facepalm", "facepalm")],
        context: generationContext(),
        generateBriefs: async () => {
          called = true;
          return { briefs: [] };
        },
        requestedCount: 1,
        seed: "phase3-empty-catalog",
      }),
    ReactionBriefError,
  );
  assert.equal(called, false);
});

function generationContext() {
  return {
    audience: ["social media managers"],
    commonSituations: ["last-minute client changes"],
    desiredOutcomes: ["a calmer publishing week"],
    pains: ["rework"],
    productName: "UGCpilot",
  };
}

function availabilityFor(intents: readonly ReactionClipType[]): ReactionAvailabilityPalette {
  return {
    availableReactionPalette: intents.map((intent) => ({
      freshClipCount: 1,
      intent,
      reusableClipCount: 0,
    })),
    generationRule: "Prefer fresh reaction intents.",
    recentlyShownIntents: [],
  };
}

function clip(id: string, reaction: ReactionClipType): ReactionAsset {
  return {
    composition: "bust",
    hasAlpha: true,
    id,
    placement: { anchor: "bottom_center", heightPercent: 0.62 },
    reactions: [reaction],
    status: "active",
    subjectCount: "one",
  };
}

function brief(slotIndex: number, reaction: ReactionClipType): ReactionBrief {
  const emotion = emotionFor(reaction);
  return {
    content: contentFor(reaction, emotion),
    preferredReactions: [reaction],
    slotIndex,
  };
}

function rawBrief(
  slotIndex: number,
  reaction: ReactionClipType,
  emotion: "frustration" | "relief" | "satisfaction" | "irony",
) {
  return {
    content: contentFor(reaction, emotion),
    preferredReactions: [reaction],
    slotIndex,
  };
}

function contentFor(
  reaction: ReactionClipType,
  emotion: "frustration" | "relief" | "satisfaction" | "irony",
): ReactionContent {
  const copy: Record<typeof emotion, { caption: string; payoff: string; situation: string }> = {
    frustration: {
      caption: "me when the client changes everything again",
      payoff: "changes everything again",
      situation: "the client returns",
    },
    irony: {
      caption: "when the deadline moves for the third time",
      payoff: "the deadline moves again",
      situation: "the plan was final",
    },
    relief: {
      caption: "me when the calendar finally clears today",
      payoff: "the calendar finally clears",
      situation: "the work is done",
    },
    satisfaction: {
      caption: "me when every post gets approved first try",
      payoff: "every post gets approved",
      situation: "the review starts",
    },
  };
  const value = copy[emotion];
  return {
    caption: value.caption,
    emotion,
    languageFormat: "me_when",
    lines: [value.caption],
    semantic: {
      payoff: value.payoff,
      situation: value.situation,
      structure: "situation_payoff",
    },
    visualContextTags: ["outdoor"],
    visualTreatment: "outlined_text",
  };
}

function emotionFor(
  reaction: ReactionClipType,
): "frustration" | "relief" | "satisfaction" | "irony" {
  if (reaction === "relief") return "relief";
  if (reaction === "celebration") return "satisfaction";
  if (reaction === "deadpan") return "irony";
  return "frustration";
}
