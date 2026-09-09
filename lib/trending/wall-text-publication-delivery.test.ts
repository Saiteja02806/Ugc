import assert from "node:assert/strict";
import test from "node:test";

import { wallTextPublicationNeedsRetry } from "./wall-text-publication-delivery.ts";

test("a failed Wall publication admission keeps its Cloud Task retryable", () => {
  assert.equal(wallTextPublicationNeedsRetry([{ error: "admission unavailable" }]), true);
  assert.equal(wallTextPublicationNeedsRetry([{ jobId: "existing-writer" }]), false);
});
