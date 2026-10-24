import assert from "node:assert/strict";
import { mock, test } from "node:test";
const local = file => new URL(file, import.meta.url);
const rows = new Map(), completions = [], reads = [];
let failCompletion = false;
let suppliedOutput;
process.env.SUPABASE_URL = "https://db.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-secret";
process.env.OPENAI_API_KEY = "fixture-key";
mock.method(globalThis, "fetch", async () => assert.fail("No network requests in plan tests"));
mock.module("openai", { defaultExport: class {
  constructor(options) { assert.equal(options.maxRetries, 0); }
  chat = { completions: { parse: async input => {
    completions.push(input);
    if (failCompletion) throw new Error("Uncertain response");
    return { choices: [{ message: { parsed: suppliedOutput } }] };
  } } };
} });
mock.module(local("../../worker/src/lib/private-media.ts"), { namedExports: { resolveOwnedPrivateMediaUrl: async (url, owner) => { reads.push({ url, owner }); return url; } } });
mock.module(local("../../worker/src/lib/reference-image-download.ts"), { namedExports: { downloadReferenceImageContext: async urls => urls.map(url => ({ contentType: "image/png", buffer: Buffer.from(url) })) } });
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({
  rpc: async (_name, args) => {
    assert.equal(_name, "explore_claim_slideshow_plan");
    const key = `${args.p_user_id}:${args.p_request_key}`, old = rows.get(key);
    if (old && old.hash !== args.p_payload_hash) return { error: { message: "slideshow_plan_conflict" } };
    if (old) return { data: { claimed: false, status: old.status, output: old.output_json }, error: null };
    rows.set(key, { hash: args.p_payload_hash, status: "pending", input: args.p_input });
    return { data: { claimed: true }, error: null };
  },
  from: table => {
    assert.equal(table, "explore_slideshow_plans");
    return { update: changes => {
      const filters = {};
      const update = () => { const row = rows.get(`${filters.user_id}:${filters.request_key}`); if (!row || row.status !== filters.status) return { data: null, error: null }; Object.assign(row, changes); return { data: { request_key: filters.request_key }, error: null }; };
      return { eq(name, value) { filters[name] = value; return this; }, select() { return this; }, maybeSingle: async () => update(), then(resolve) { return Promise.resolve(update()).then(resolve); } };
    } };
  },
}) } });
const { planSlideshowRequest } = await import("./slideshow-plan-service.ts");
const input = { version: 1, prompt: "Put Upload C inside Source slide 4", targetIds: ["s4"], images: [
  { id: "s4", label: "Source slide 4", kind: "source", url: "https://owned.test/source4.png", sourceSlideNumber: 4 },
  { id: "upload:c", label: "Upload C", kind: "upload", url: "https://owned.test/screenshot.png", sourceSlideNumber: null },
] };
const valid = () => ({ version: 1, clarifications: [], unusedUploadIds: [], slides: [{ targetId: "s4", baseUploadId: null, instructions: "Insert Upload C into the laptop screen.", preserve: ["Keep the room"], attachments: [{ imageId: "upload:c", role: "screenshot" }] }] });

test("one image-aware planning call is saved and reused after reload, with original names beside actual pixels", async () => {
  suppliedOutput = valid();
  const key = crypto.randomUUID(), before = completions.length, downloads = reads.length;
  assert.deepEqual(await planSlideshowRequest("owner-a", key, input), suppliedOutput);
  assert.deepEqual(await planSlideshowRequest("owner-a", key, input), suppliedOutput);
  assert.equal(completions.length - before, 1); assert.equal(reads.length - downloads, 2);
  const content = completions.at(-1).messages[1].content;
  assert.equal(JSON.parse(content[0].text).originalRequest, input.prompt);
  assert.match(content[1].text, /Source slide 4; id=s4/);
  assert.equal(Buffer.from(content[2].image_url.url.split(",")[1], "base64").toString(), input.images[0].url);
  assert.match(content[3].text, /Upload C; id=upload:c/);
  assert.equal(Buffer.from(content[4].image_url.url.split(",")[1], "base64").toString(), input.images[1].url);
  await assert.rejects(planSlideshowRequest("owner-a", key, { ...input, prompt: "Different" }), /changed/);
  assert.equal(completions.length - before, 1);
  await planSlideshowRequest("owner-b", key, input);
  assert.equal(completions.length - before, 2);
});

test("pending, uncertain and malformed plans cannot cause an automatic repeated planning call", async () => {
  const key = crypto.randomUUID(), before = completions.length;
  failCompletion = true;
  try { await assert.rejects(planSlideshowRequest("owner-a", key, input), /No image credits/); }
  finally { failCompletion = false; }
  await assert.rejects(planSlideshowRequest("owner-a", key, input), /generate again/);
  assert.equal(completions.length - before, 1);
  suppliedOutput = { ...valid(), slides: [{ ...valid().slides[0], targetId: "other-slide" }] };
  await assert.rejects(planSlideshowRequest("owner-a", crypto.randomUUID(), input), /No image credits/);
  const pending = crypto.randomUUID();
  // Simulate interruption after the durable claim, before any completion can be saved.
  suppliedOutput = valid();
  await planSlideshowRequest("owner-a", pending, input);
  rows.get(`owner-a:${pending}`).status = "pending";
  const paid = completions.length;
  await assert.rejects(planSlideshowRequest("owner-a", pending, input), /still pending/);
  assert.equal(completions.length, paid);
});
