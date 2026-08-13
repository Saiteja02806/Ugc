import assert from "node:assert/strict";
import test from "node:test";

import { getPersistedCarouselSlideCopy } from "./carousel-slide-persistence.js";
import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";

test("body-only slides are not persisted as duplicate headline and subtext", () => {
  assert.deepEqual(
    getPersistedCarouselSlideCopy(createSlide({
      body: "Choose the reference that matches the current question.",
      headline: null,
      subtext: "Choose the reference that matches the current question.",
      textMode: "cta_takeaway",
    })),
    {
      headline: "Choose the reference that matches the current question.",
      subtext: null,
    },
  );
});

test("headline and distinct supporting copy remain separate", () => {
  assert.deepEqual(
    getPersistedCarouselSlideCopy(createSlide({
      body: "Keep the meal context beside the saved entry.",
      headline: "Preserve the useful context",
      subtext: "Keep the meal context beside the saved entry.",
    })),
    {
      headline: "Preserve the useful context",
      subtext: "Keep the meal context beside the saved entry.",
    },
  );
});

test("normalized duplicate supporting copy is removed", () => {
  assert.deepEqual(
    getPersistedCarouselSlideCopy(createSlide({
      body: "Review progress before adjusting.",
      headline: "Review progress before adjusting",
      subtext: "  review PROGRESS before adjusting! ",
    })),
    {
      headline: "Review progress before adjusting",
      subtext: null,
    },
  );
});

function createSlide(
  overrides: Partial<PlannedCarouselSlide>,
): PlannedCarouselSlide {
  return {
    body: null,
    ctaText: null,
    formatRole: "pattern_cta",
    headline: null,
    imageDirection: "Use an object-only meal image.",
    layoutPreset: "middle-statement",
    listItems: [],
    slideNumber: 5,
    slideType: "cta",
    subtext: null,
    textMode: "headline_body",
    textPosition: "center",
    ...overrides,
  };
}
