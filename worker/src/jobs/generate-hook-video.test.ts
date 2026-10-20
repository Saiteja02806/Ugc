import assert from "node:assert/strict";
import test from "node:test";
import { resolveHookVideoProvider } from "../lib/hook-video-provider.js";
import { ProviderRequestNotSubmittedError, ProviderSubmissionUncertainError } from "../lib/generation-provider.js";

test("untagged legacy Seedance requests retain Runway, while Omni remains Gemini", () => {
  assert.equal(resolveHookVideoProvider({ model: "seedance_2_5" }, null), "runway");
  assert.equal(resolveHookVideoProvider({ model: "google_omni" }, null), "gemini");
});

test("WAN freezes the reference-capable route while preserving earlier image generation routing", () => {
  assert.equal(resolveHookVideoProvider({ model: "wan_3_0" }, null), "openrouter");
  assert.equal(resolveHookVideoProvider({ model: "wan_3_0", provider: "openrouter" }, null), "openrouter");
  assert.equal(resolveHookVideoProvider({ model: "wan_3_0", provider: "runway" }, null), "runway");
  assert.throws(() => resolveHookVideoProvider({ model: "wan_3_0", provider: "gemini" }, null), ProviderRequestNotSubmittedError);
});

test("explicit OpenRouter Seedance routing preserves accepted legacy tasks", () => {
  assert.equal(resolveHookVideoProvider({ model: "seedance_2_5", provider: "openrouter" }, null), "openrouter");
  assert.equal(resolveHookVideoProvider({ model: "seedance_2_5", provider: "openrouter" }, { status: "submitted", provider_operation_id: "legacy" }), "higgsfield");
  assert.throws(() => resolveHookVideoProvider({ model: "google_omni", provider: "openrouter" }, null), ProviderRequestNotSubmittedError);
});
test("new explicitly frozen Seedance and WAN requests use ReAPI while older routes remain recoverable", () => {
  for (const model of ["seedance_2_5", "wan_3_0"] as const) {
    assert.equal(resolveHookVideoProvider({ model, provider: "reapi" }, null), "reapi");
    assert.equal(resolveHookVideoProvider({ model, provider: "runway" }, null), "runway");
    assert.equal(resolveHookVideoProvider({ model, provider: "openrouter" }, null), "openrouter");
  }
  for (const model of ["google_omni", "kling_3_0"] as const) assert.throws(() => resolveHookVideoProvider({ model, provider: "reapi" }, null), ProviderRequestNotSubmittedError);
  assert.throws(() => resolveHookVideoProvider({ model: "seedance_2_5", provider: "reapi" }, { status: "submission_uncertain", provider_operation_id: null }), ProviderSubmissionUncertainError);
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
