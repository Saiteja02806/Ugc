import assert from "node:assert/strict";
import test from "node:test";

import {
  createVisibleCarouselConceptFingerprint,
  isVisibleCarouselConceptFingerprint,
} from "./carousel-concept-fingerprint.ts";
import {
  DAILY_CAROUSEL_REFILL_REPAIR_INTERVAL_MS,
  canExtendDailyCarouselRefill,
  getDailyCarouselReplacementBatchRequestedCount,
  getDailyCarouselRefillPlan,
  getMissingDailyCarouselCandidateIndexes,
  hasTerminalDailyCarouselGenerationFailure,
  isCarouselGenerationAvailableOnDate,
  rotateDailyCarouselAngles,
  selectAssignableDailyCarouselCandidates,
} from "./daily-replenishment-logic.ts";

const visibleSlides = [
  {
    ctaText: null,
    headline: "The hidden cost of busywork",
    slideNumber: 1,
    subtext: "Five places your team loses time.",
  },
  {
    ctaText: "Start today",
    headline: "Give the time back",
    slideNumber: 2,
    subtext: "Automate the repeatable steps.",
  },
];

test("requests ten new carousels when all ten were completed before the new day", () => {
  assert.deepEqual(
    getDailyCarouselRefillPlan({
      dailyLimit: 10,
      existingBatchCandidateCount: 0,
      existingRequestedCount: 0,
      feedItemCount: 0,
      viableUnassignedGenerationCount: 0,
    }),
    {
      generationDeficit: 10,
      pendingSlotCount: 10,
      requestedBatchCandidateCount: 10,
    },
  );
});

test("uses five existing current-day slots and requests only the five-carousel shortfall", () => {
  const plan = getDailyCarouselRefillPlan({
    dailyLimit: 10,
    existingBatchCandidateCount: 0,
    existingRequestedCount: 0,
    feedItemCount: 5,
    viableUnassignedGenerationCount: 0,
  });

  assert.equal(plan.pendingSlotCount, 5);
  assert.equal(plan.generationDeficit, 5);
  assert.equal(plan.requestedBatchCandidateCount, 5);
});

test("uses a full current-day feed and requests no new generation", () => {
  const plan = getDailyCarouselRefillPlan({
    dailyLimit: 10,
    existingBatchCandidateCount: 0,
    existingRequestedCount: 0,
    feedItemCount: 10,
    viableUnassignedGenerationCount: 0,
  });

  assert.equal(plan.pendingSlotCount, 0);
  assert.equal(plan.generationDeficit, 0);
  assert.equal(plan.requestedBatchCandidateCount, 0);
});

test("same-day completions do not refill occupied daily feed positions", () => {
  const plan = getDailyCarouselRefillPlan({
    dailyLimit: 10,
    existingBatchCandidateCount: 0,
    existingRequestedCount: 0,
    feedItemCount: 10,
    viableUnassignedGenerationCount: 0,
  });

  assert.equal(plan.generationDeficit, 0);
});

test("ready or processing inventory reduces the generated shortfall", () => {
  const plan = getDailyCarouselRefillPlan({
    dailyLimit: 10,
    existingBatchCandidateCount: 0,
    existingRequestedCount: 0,
    feedItemCount: 5,
    viableUnassignedGenerationCount: 2,
  });

  assert.equal(plan.generationDeficit, 3);
  assert.equal(plan.requestedBatchCandidateCount, 3);
});

test("repeated reconciliation keeps the same batch target", () => {
  const plan = getDailyCarouselRefillPlan({
    dailyLimit: 10,
    existingBatchCandidateCount: 5,
    existingRequestedCount: 5,
    feedItemCount: 5,
    viableUnassignedGenerationCount: 5,
  });

  assert.equal(plan.generationDeficit, 0);
  assert.equal(plan.requestedBatchCandidateCount, 5);
});

test("a failed reserved candidate exposes a one-slot replacement deficit", () => {
  const plan = getDailyCarouselRefillPlan({
    dailyLimit: 10,
    existingBatchCandidateCount: 5,
    existingRequestedCount: 5,
    feedItemCount: 5,
    viableUnassignedGenerationCount: 4,
  });

  assert.equal(plan.generationDeficit, 1);
  assert.equal(plan.requestedBatchCandidateCount, 6);
  assert.equal(
    getDailyCarouselReplacementBatchRequestedCount({
      generationDeficit: plan.generationDeficit,
    }),
    1,
  );
});

test("daily candidate indexes extend a batch without recreating existing rows", () => {
  assert.deepEqual(
    getMissingDailyCarouselCandidateIndexes({
      existingCandidateIndexes: [],
      targetCandidateCount: 5,
    }),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(
    getMissingDailyCarouselCandidateIndexes({
      existingCandidateIndexes: [0, 1, 2, 3, 4],
      targetCandidateCount: 6,
    }),
    [5],
  );
  assert.deepEqual(
    getMissingDailyCarouselCandidateIndexes({
      existingCandidateIndexes: [0, 1, 2, 3, 4, 5],
      targetCandidateCount: 6,
    }),
    [],
  );
});

test("replacement extension starts exactly at the repair cooldown boundary", () => {
  const now = Date.parse("2026-07-17T12:00:00.000Z");
  const params = {
    currentRequestedCount: 10,
    hasExistingBatch: true,
    requestedCount: 11,
  };

  assert.equal(
    canExtendDailyCarouselRefill({
      ...params,
      lastUpdatedAt: new Date(
        now - DAILY_CAROUSEL_REFILL_REPAIR_INTERVAL_MS + 1,
      ).toISOString(),
      now,
    }),
    false,
  );
  assert.equal(
    canExtendDailyCarouselRefill({
      ...params,
      lastUpdatedAt: new Date(
        now - DAILY_CAROUSEL_REFILL_REPAIR_INTERVAL_MS,
      ).toISOString(),
      now,
    }),
    true,
  );
});

test("a terminal Carousel job bypasses the replacement cooldown", () => {
  const now = Date.parse("2026-07-17T12:00:00.000Z");

  assert.equal(
    canExtendDailyCarouselRefill({
      currentRequestedCount: 5,
      hasExistingBatch: true,
      hasTerminalFailure: true,
      lastUpdatedAt: new Date(now - 1_000).toISOString(),
      now,
      requestedCount: 6,
    }),
    true,
  );
});

test("a failed row does not replace a Carousel while its shared job is active", () => {
  assert.equal(
    hasTerminalDailyCarouselGenerationFailure({
      generations: [{ status: "failed", triggerRunId: "job-1" }],
      jobs: [{ id: "job-1", status: "processing" }],
    }),
    false,
  );
});

test("failed and cancelled Carousel jobs are terminal replacement signals", () => {
  for (const status of ["failed", "cancelled"]) {
    assert.equal(
      hasTerminalDailyCarouselGenerationFailure({
        generations: [{ status: "processing", triggerRunId: "job-1" }],
        jobs: [{ id: "job-1", status }],
      }),
      true,
    );
  }
});

test("an orphaned failed Carousel generation is terminal", () => {
  assert.equal(
    hasTerminalDailyCarouselGenerationFailure({
      generations: [{ status: "failed", triggerRunId: null }],
      jobs: [],
    }),
    true,
  );
});

test("future daily generations stay hidden until their eligible local date", () => {
  assert.equal(
    isCarouselGenerationAvailableOnDate({
      availableOnLocalDate: "2026-07-18",
      localDate: "2026-07-17",
    }),
    false,
  );
  assert.equal(
    isCarouselGenerationAvailableOnDate({
      availableOnLocalDate: "2026-07-18",
      localDate: "2026-07-18",
    }),
    true,
  );
  assert.equal(
    isCarouselGenerationAvailableOnDate({
      availableOnLocalDate: null,
      localDate: "2026-07-17",
    }),
    true,
  );
});

test("a duplicate ready concept does not count as assignable inventory", () => {
  const assignable = selectAssignableDailyCarouselCandidates({
    assignedCarouselIds: [],
    candidates: [
      {
        availableOnLocalDate: "2026-07-17",
        carouselId: "duplicate-ready",
        conceptFingerprint: "already-used",
        generationSource: "auto_generated",
        runtimeReady: true,
      },
      {
        availableOnLocalDate: "2026-07-17",
        carouselId: "fresh-ready",
        conceptFingerprint: "fresh-concept",
        generationSource: "auto_generated",
        runtimeReady: true,
      },
      {
        availableOnLocalDate: "2026-07-17",
        carouselId: "same-fresh-concept",
        conceptFingerprint: "fresh-concept",
        generationSource: "auto_generated",
        runtimeReady: true,
      },
    ],
    existingConceptFingerprints: ["already-used"],
    localDate: "2026-07-17",
  });

  assert.deepEqual(
    assignable.map((candidate) => candidate.carouselId),
    ["fresh-ready"],
  );
});

test("daily angle rotation is deterministic and preserves distinct batch angles", () => {
  const angles = Array.from({ length: 20 }, (_, index) => `Angle ${index + 1}`);
  const first = rotateDailyCarouselAngles({
    angles,
    candidateCount: 10,
    localDate: "2026-07-18",
    profileId: "profile-a",
  });
  const repeated = rotateDailyCarouselAngles({
    angles,
    candidateCount: 10,
    localDate: "2026-07-18",
    profileId: "profile-a",
  });

  assert.deepEqual(first, repeated);
  assert.equal(new Set(first).size, 10);
});

test("concept fingerprints use normalized user-visible copy in slide order", () => {
  const fingerprint = createVisibleCarouselConceptFingerprint(visibleSlides);
  const sameVisibleCopy = createVisibleCarouselConceptFingerprint([
    {
      ...visibleSlides[1],
      ctaText: "  START TODAY! ",
      headline: "Give the time back.",
    },
    {
      ...visibleSlides[0],
      headline: "THE HIDDEN COST OF BUSYWORK",
    },
  ]);

  assert.equal(fingerprint, sameVisibleCopy);
  assert.equal(isVisibleCarouselConceptFingerprint(fingerprint), true);
  assert.equal(isVisibleCarouselConceptFingerprint(fingerprint.slice(16)), false);
});

test("visible CTA changes a concept fingerprint", () => {
  const fingerprint = createVisibleCarouselConceptFingerprint(visibleSlides);
  const changedCta = createVisibleCarouselConceptFingerprint([
    visibleSlides[0],
    { ...visibleSlides[1], ctaText: "Book a demo" },
  ]);

  assert.notEqual(fingerprint, changedCta);
});

test("internal angle and category cannot change a visible-copy fingerprint", () => {
  const firstGeneration = {
    categorySlug: "marketing-saas",
    selectedAngle: "The hidden cost",
    slides: visibleSlides,
  };
  const secondGeneration = {
    categorySlug: "productivity-saas",
    selectedAngle: "A faster workflow",
    slides: visibleSlides,
  };

  assert.equal(
    createVisibleCarouselConceptFingerprint(firstGeneration.slides),
    createVisibleCarouselConceptFingerprint(secondGeneration.slides),
  );
});
