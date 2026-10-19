import assert from "node:assert/strict";
import { mock, test } from "node:test";

class PartialPlanningError extends Error {
  completedItems = [];
  constructor(failures) { super("Specific failed plan diagnostics"); this.failures = failures; }
}
const failures = Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex,
  message: `Image metadata repair failed for slot ${slotIndex}`,
  initialIssues: [{ code: "unsafe_visual_direction", slideNumber: 2, message: "Unsafe initial direction" }],
  finalIssues: [{ code: "unsafe_visual_direction", slideNumber: 5, message: "Unsafe repaired direction" }],
  rawLlmResponse: { initial: "synthetic initial", repair: "synthetic repair" },
}));
mock.module(new URL("../../dist/lib/carousel-llm-slide-plan.js", import.meta.url), { namedExports: {
  buildCarouselContentPlanBatch: async () => { throw new PartialPlanningError(failures); },
  buildCarouselContentPlan: async () => assert.fail("No single-item planning"),
  CarouselPartialBatchPlanningError: PartialPlanningError,
  CAROUSEL_CONTENT_PLANNER_VERSION: "synthetic-planner-version",
} });
const { runGenerateCarouselJob } = await import("../../dist/jobs/generate-carousel.js");

test("planner-to-job failure settlement preserves individual causes, evidence and reservations", async () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: `carousel-${i}`, status: "processing",
    carousel_experiment_batch_id: "batch", business_profile_id: "profile", business_profile_version: 1,
    generation_batch_id: "generation-batch", project_id: "default", structure_id: "structure_1", structure_version: "1",
    user_id: "synthetic", website_analysis_id: "analysis", content_plan_id: "plan",
    content_plan_item_id: `item-${i}`, content_plan_reservation_id: "reservation", carousel_experiment_assignment_id: `assignment-${i}`,
  }));
  const releases = [], consumes = [], patches = [];
  const store = {
    getCarouselGeneration: async id => structuredClone(rows.find(row => row.id === id)),
    getWebsiteAnalysisForCarousel: async () => ({ analysis_json: {} }),
    getBusinessProfileForCarousel: async () => ({ context_json: {} }),
    getCarouselCreativeBrief: async row => ({ businessDescription: "Synthetic campaign software", contentPlanId: "plan", creativeSeed: row.id, emotion: "relief", planningBrief: null }),
    listRecentAcceptedCarouselCopy: async () => [],
    updateCarouselGeneration: async (id, patch) => { patches.push({ id, patch }); Object.assign(rows.find(row => row.id === id), patch); },
    getCarouselExperimentBatch: async () => ({ requested_structure_id: "structure_1", structure_id: "structure_1", structure_resolution_mode: "requested", structure_planning_attempt_count: 0, structure_mode_snapshot: "structure_1" }),
    updateCarouselExperimentBatch: async () => {}, updateCarouselExperimentAssignment: async () => {},
    consumeCarouselContentPlanItem: async item => consumes.push(item),
    releaseCarouselContentPlanReservationByToken: async value => releases.push(value),
  };
  await assert.rejects(runGenerateCarouselJob({ input_json: { carouselIds: rows.map(row => row.id), experimentBatchId: "batch" } }, { store }), /Specific failed plan diagnostics/);
  assert.equal(consumes.length, 0);
  assert.equal(releases.length, 1);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.status, "failed");
    assert.equal(row.error_message, failures[index].message, "The job wrapper must not overwrite a candidate cause");
    assert.equal(row.content_plan_validation.slotIndex, index);
    assert.deepEqual(row.content_plan_validation.finalIssues, failures[index].finalIssues);
    assert.deepEqual(row.content_plan_raw_response, failures[index].rawLlmResponse);
  }
  assert.equal(patches.filter(({ patch }) => patch.status === "failed").length, 5);
});
