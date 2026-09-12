import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const generationJobs = read("lib/carousel/generation-jobs.ts");
const preparation = read("lib/carousel/prepare-business-profile.ts");

test("Carousel queue configuration is checked before durable Carousel work exists", () => {
  assert.match(generationJobs, /export function assertCarouselGenerationRuntimeConfigured/);
  assert.match(
    generationJobs,
    /enqueueCarouselGenerationJob[\s\S]*?assertCarouselGenerationRuntimeConfigured\(\);[\s\S]*?createBackgroundJobWithCreationResult/,
  );
  assert.match(
    generationJobs,
    /enqueueCarouselExperimentBatchJob[\s\S]*?assertCarouselGenerationRuntimeConfigured\(\);[\s\S]*?createOrGetCarouselExperimentBatchJob/,
  );
  assert.match(
    preparation,
    /prepareControlledGenerationBatch[\s\S]*?assertCarouselGenerationRuntimeConfigured\(\);[\s\S]*?reserveCarouselExperimentBatches/,
  );
});

test("ambiguous Carousel Cloud Tasks delivery remains recoverable instead of terminal", () => {
  assert.match(generationJobs, /eventType: "queue_delivery_deferred"/);
  assert.match(generationJobs, /return preserveCarouselJobForDeliveryRecovery/);
  assert.match(generationJobs, /existing stale-delivery lease and worker claim/);
  assert.doesNotMatch(generationJobs, /markBackgroundJobFailed/);
  assert.doesNotMatch(generationJobs, /updateCarouselGeneration\(/);
});

function read(relativePath: string) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}
