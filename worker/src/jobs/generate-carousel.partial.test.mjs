import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module(new URL("../../dist/lib/carousel-generate.js", import.meta.url), { namedExports: {
  generateCarousel: async () => assert.fail("A batch must not enter single-item generation"),
  generateCarouselBatch: async () => { throw new AggregateError([new Error("One plan failed quality checks")], "Partial batch"); },
} });
const { runGenerateCarouselJob } = await import("../../dist/jobs/generate-carousel.js");

test("partial batch settlement preserves completed siblings and releases only unused reservations", async () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    id: `carousel-${i}`, status: i < 4 ? "completed" : "processing",
    content_plan_item_id: `item-${i}`, content_plan_reservation_id: "reservation", user_id: "owner",
  }));
  const consumed = [], released = [], updated = [], batches = [];
  const store = {
    getCarouselGeneration: async id => structuredClone(rows.find(row => row.id === id)),
    updateCarouselGeneration: async (id, patch) => { updated.push(id); Object.assign(rows.find(row => row.id === id), patch); },
    updateCarouselExperimentBatch: async (id, patch) => batches.push({ id, ...patch }),
    consumeCarouselContentPlanItem: async value => consumed.push(value.planItemId),
    releaseCarouselContentPlanReservationByToken: async value => released.push(value),
  };
  await assert.rejects(runGenerateCarouselJob({ input_json: {
    carouselIds: rows.map(row => row.id), experimentBatchId: "batch",
  } }, { store }), /Partial batch/);
  assert.deepEqual(updated, ["carousel-4"]);
  assert.deepEqual(consumed, ["item-0", "item-1", "item-2", "item-3"]);
  assert.deepEqual(rows.map(row => row.status), ["completed", "completed", "completed", "completed", "failed"]);
  assert.deepEqual(batches, [{ id: "batch", status: "partial" }]);
  assert.deepEqual(released, [{ reservationToken: "reservation", userId: "owner", reason: "Partial batch" }]);
});
