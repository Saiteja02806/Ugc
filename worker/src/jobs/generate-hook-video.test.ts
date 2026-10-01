import assert from "node:assert/strict";
import test from "node:test";
import { resolveHookVideoProvider } from "../lib/hook-video-provider.js";
import { ProviderRequestNotSubmittedError, ProviderSubmissionUncertainError } from "../lib/generation-provider.js";

test("new Seedance requests use Runway, while Omni remains Gemini", () => {
  assert.equal(resolveHookVideoProvider({ model: "seedance_2_5" }, null), "runway");
  assert.equal(resolveHookVideoProvider({ model: "google_omni" }, null), "gemini");
});
test("does not replace a paid legacy Higgsfield request with a new Runway task", () => {
  for (const status of ["submitted", "provider_succeeded", "output_persisted"]) {
    assert.equal(resolveHookVideoProvider({ model: "seedance_2_5" }, { status, provider_operation_id: "old-task" }), "higgsfield");
  }
});
test("uncertain and failed legacy requests cannot trigger a new paid generation", () => {
  for (const status of ["reserved", "submission_uncertain", "failed"]) {
    assert.throws(() => resolveHookVideoProvider({ model: "seedance_2_5" }, { status, provider_operation_id: null }), ProviderSubmissionUncertainError);
  }
});
test("rejects direct new Higgsfield selection but leaves other legacy providers unchanged", () => {
  assert.throws(() => resolveHookVideoProvider({ provider: "higgsfield" }, null), ProviderRequestNotSubmittedError);
  for (const provider of ["veo", "runway", "gemini"] as const) assert.equal(resolveHookVideoProvider({ provider }, null), provider);
});
