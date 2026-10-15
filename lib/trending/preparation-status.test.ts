import assert from "node:assert/strict";
import test from "node:test";
import { getTrendingPreparationCopy, getTrendingPreparationState } from "./preparation-status.ts";

test("pending slots describe actual jobs, not generation row placeholders", () => {
  assert.equal(getTrendingPreparationState([]), "preparing");
  assert.equal(getTrendingPreparationState([{ status: "queued" }]), "queued");
  assert.equal(getTrendingPreparationState([{ status: "failed" }, { status: "queued" }]), "queued");
  assert.equal(getTrendingPreparationState([{ status: "queued" }, { status: "rendering" }]), "generating");
  assert.equal(getTrendingPreparationState([{ status: "failed" }]), "failed");
  assert.equal(getTrendingPreparationState([{ status: "completed" }]), "finalizing");
  assert.match(getTrendingPreparationCopy("queued").title, /Waiting in queue/);
  assert.match(getTrendingPreparationCopy("failed").title, /failed/);
});
