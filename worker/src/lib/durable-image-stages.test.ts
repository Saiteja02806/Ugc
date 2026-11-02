import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createDurableImageStageRunner } from "./durable-image-stages.js";
import { generateOpenRouterGeminiHookKeyframe, performOpenRouterFaceSwap, type ImageStageRunner } from "./openrouter-gemini-image.js";
import type { SupabaseJobStore } from "./supabase.js";

async function fixture() {
  const png = await sharp({ create: { width: 24, height: 40, channels: 3, background: "#a77c62" } }).png().toBuffer();
  const objects = new Map<string, Buffer>();
  const operations = new Map<string, { metadata: Record<string, unknown>; request_fingerprint: string; status: string; provider_operation_id: string | null; retry_allowed?: boolean }>();
  const checkpoints: string[] = [];
  let paid = 0, rejectAt = 0, ambiguousAt = 0, failHarmonizer = false, loseWrite = false, loseReceipt = false;
  const store = {
    async reserveGenerationProviderOperation(p: Parameters<SupabaseJobStore["reserveGenerationProviderOperation"]>[0]) {
      const old = operations.get(p.operationKey);
      if (old) {
        assert.equal(old.request_fingerprint, p.requestFingerprint);
        if (old.status === "failed" && old.retry_allowed) {
          Object.assign(old, { status: "reserved", retry_allowed: false });
          return { operation: old, shouldSubmit: true };
        }
        return { operation: old, shouldSubmit: false };
      }
      const row = { metadata: p.metadata ?? {}, request_fingerprint: p.requestFingerprint, status: "reserved", provider_operation_id: null };
      operations.set(p.operationKey, row);
      return { operation: row, shouldSubmit: true };
    },
    async markGenerationProviderSucceeded(p: Parameters<SupabaseJobStore["markGenerationProviderSucceeded"]>[0]) {
      if (loseReceipt) { loseReceipt = false; throw Error("Receipt unavailable"); }
      Object.assign(operations.get(p.operationKey)!, { status: "provider_succeeded", metadata: p.metadata, provider_operation_id: p.providerOperationId ?? null });
    },
    async markGenerationOutputPersisted(p: Parameters<SupabaseJobStore["markGenerationOutputPersisted"]>[0]) {
      Object.assign(operations.get(p.operationKey)!, { status: "output_persisted", metadata: p.metadata, output_reference: p.outputReference });
    },
    async markGenerationProviderFailed(p: Parameters<SupabaseJobStore["markGenerationProviderFailed"]>[0]) { Object.assign(operations.get(p.operationKey)!, { status: "failed", retry_allowed: p.retryAllowed }); },
    async markGenerationProviderSubmissionUncertain(p: Parameters<SupabaseJobStore["markGenerationProviderSubmissionUncertain"]>[0]) { Object.assign(operations.get(p.operationKey)!, { status: "submission_uncertain" }); },
  } as unknown as SupabaseJobStore;
  const storage = {
    async get(key: string) { return objects.has(key) ? { key, url: `https://fixture.invalid/${key}` } : null; },
    async read(key: string) { return objects.get(key)!; },
    async write(p: { key: string; buffer: Buffer }) {
      objects.set(p.key, p.buffer);
      if (loseWrite) { loseWrite = false; throw Error("Lost storage acknowledgement"); }
      return { key: p.key, url: `https://fixture.invalid/${p.key}` };
    },
  };
  const fetchImpl: typeof fetch = async () => {
    paid++;
    if (paid === ambiguousAt) throw Error("Lost provider response");
    if (paid === rejectAt) return new Response("rate limit", { status: 429 });
    return Response.json({ id: `provider-${paid}`, choices: [{ message: { images: [{ url: `data:image/png;base64,${png.toString("base64")}` }] } }] });
  };
  function runner(): ImageStageRunner {
    const run = createDurableImageStageRunner({ jobId: "job", store, storage,
      checkpoint: async stage => { checkpoints.push(stage); } });
    return (stage, input, action) => run(stage, input, async () => {
      if (stage === "harmonize" && failHarmonizer) throw Error("CPU harmonizer failure");
      return action();
    });
  }
  const image = { data: png.toString("base64"), mimeType: "image/png" };
  const common = { apiKey: "fixture", fetchImpl, aspectRatio: "9:16" as const };
  return {
    objects, operations, checkpoints, paid: () => paid,
    reject(at: number) { rejectAt = at; }, ambiguous(at: number) { ambiguousAt = at; },
    failHarmony(value: boolean) { failHarmonizer = value; },
    loseWrite() { loseWrite = true; }, loseReceipt() { loseReceipt = true; },
    run: () => generateOpenRouterGeminiHookKeyframe({ ...common, prompt: "Scene then influencer", referenceImages: [image, image], runStage: runner() }),
    swap: () => performOpenRouterFaceSwap({ ...common, baseImage: image, influencerImage: image, runStage: runner() }),
  };
}

test("Stage 2 rejection cannot succeed; a fresh runner resumes saved Stage 1 without paying again", async () => {
  const f = await fixture(); f.reject(2);
  await assert.rejects(f.run(), /temporarily rejected/);
  assert.equal(f.objects.size, 1);
  assert.equal(f.operations.get("openrouter-image-identity-v1")!.status, "failed");
  await f.run(); assert.equal(f.paid(), 3);
  assert.equal(f.objects.size, 3);
  await f.run(); assert.equal(f.paid(), 3);
  assert.ok([...f.operations.values()].every(row => row.status === "output_persisted"));
});

for (const flow of ["run", "swap"] as const) {
  test(`${flow}: harmonizer failure never reports success and retries use saved paid images`, async () => {
    const f = await fixture(); f.failHarmony(true);
    await assert.rejects(f[flow](), /harmonization failed/);
    const paid = f.paid();
    assert.equal(paid, flow === "run" ? 2 : 1);
    assert.equal(f.operations.get("openrouter-image-harmonize-v1")!.status, "failed");
    f.failHarmony(false); const result = await f[flow]();
    assert.equal(f.paid(), paid); assert.ok(result.buffer.length);
    await f[flow](); assert.equal(f.paid(), paid);
  });
  test(`${flow}: an ambiguous provider response never causes a duplicate paid request`, async () => {
    const f = await fixture(); f.ambiguous(flow === "run" ? 2 : 1);
    await assert.rejects(f[flow](), /duplicate paid request/);
    const paid = f.paid();
    await assert.rejects(f[flow](), /duplicate paid request/);
    assert.equal(f.paid(), paid);
  });
}

for (const interruption of ["loseWrite", "loseReceipt"] as const) {
  test(`${interruption}: stored Stage 1 survives a lost acknowledgement without resubmission`, async () => {
    const f = await fixture(); f[interruption]();
    await assert.rejects(f.run());
    assert.equal(f.paid(), 1);
    await f.run(); assert.equal(f.paid(), 2);
  });
}

test("changed stage inputs and corrupted saved results cannot trigger paid replay", async () => {
  const f = await fixture(); await f.run();
  const scene = f.operations.get("openrouter-image-scene-v1")!;
  scene.metadata.sha256 = "0".repeat(64);
  await assert.rejects(f.run(), /checksum/);
  assert.equal(f.paid(), 2);
  scene.request_fingerprint = "another-input";
  await assert.rejects(f.run());
  assert.equal(f.paid(), 2);
});

test("concurrent deliveries cannot both submit the same paid stages", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([f.run(), f.run()]);
  assert.ok(results.some(result => result.status === "fulfilled"));
  assert.equal(f.paid(), 2);
  await f.run(); assert.equal(f.paid(), 2);
});
