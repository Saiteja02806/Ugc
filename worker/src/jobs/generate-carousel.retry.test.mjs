import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { RetryableJobError } from "../../dist/retryable-job-error.js";
const transient = new RetryableJobError("Model request interrupted", { code: "content_plan_provider_transient", retryAfterSeconds: 45 });
mock.module(new URL("../../dist/lib/carousel-generate.js", import.meta.url), { namedExports: {
  generateCarouselBatch: async () => { throw transient; }, generateCarousel: async () => assert.fail("single-item generation must not run"),
} });
const { runGenerateCarouselJob } = await import("../../dist/jobs/generate-carousel.js");
test("transient initial planning keeps durable reservation and generation states for the worker retry", async () => {
  const store = new Proxy({}, { get: () => () => assert.fail("No failure settlement or reservation release on retryable interruption") });
  await assert.rejects(runGenerateCarouselJob({ input_json: { carouselIds: ["1","2","3","4","5"], experimentBatchId: "batch" } }, { store }), error => error === transient);
});
