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
const business = { businessProfileId: "business-a", businessProfileVersion: 3, businessContext: {
  businessName: "UGC Pilot", productSummary: "Create content for your business", category: "Marketing", mainProblem: "Slow content creation", mainPromise: null, brandTone: "Friendly",
  targetAudience: ["Founders"], valueProps: ["Reusable drafts"], painPoints: [], differentiators: [], visualKeywords: [], ctaIdeas: [], claimsToAvoid: ["Guaranteed viral reach"],
} };
const valid = () => ({ version: 1, clarifications: [], unusedUploadIds: [], slides: [{ targetId: "s4", baseUploadId: null, instructions: "Insert Upload C into the laptop screen.", preserve: ["Keep the room"], attachments: [{ imageId: "upload:c", role: "screenshot" }] }] });

test("one image-aware planning call is saved and reused after reload, with original names beside actual pixels", async () => {
  suppliedOutput = valid();
  const key = crypto.randomUUID(), before = completions.length, downloads = reads.length;
  assert.deepEqual(await planSlideshowRequest("owner-a", key, input, business), suppliedOutput);
  assert.deepEqual(await planSlideshowRequest("owner-a", key, input, business), suppliedOutput);
  assert.equal(completions.length - before, 1); assert.equal(reads.length - downloads, 2);
  const content = completions.at(-1).messages[1].content;
  assert.equal(JSON.parse(content[0].text).originalRequest, input.prompt);
  assert.deepEqual(JSON.parse(content[0].text).businessContext, business);
  assert.deepEqual(rows.get(`owner-a:${key}`).input.businessContext, business);
  assert.equal(rows.get(`owner-a:${key}`).input.plannerVersion, 3);
  assert.match(content[1].text, /Source slide 4; id=s4/);
  assert.equal(Buffer.from(content[2].image_url.url.split(",")[1], "base64").toString(), input.images[0].url);
  assert.match(content[3].text, /Upload C; id=upload:c/);
  assert.equal(Buffer.from(content[4].image_url.url.split(",")[1], "base64").toString(), input.images[1].url);
  await assert.rejects(planSlideshowRequest("owner-a", key, { ...input, prompt: "Different" }, business), /changed/);
  assert.equal(completions.length - before, 1);
  await planSlideshowRequest("owner-b", key, input, business);
  assert.equal(completions.length - before, 2);
});

test("pending, uncertain and malformed plans cannot cause an automatic repeated planning call", async () => {
  const key = crypto.randomUUID(), before = completions.length;
  failCompletion = true;
  try { await assert.rejects(planSlideshowRequest("owner-a", key, input, business), /No image credits/); }
  finally { failCompletion = false; }
  await assert.rejects(planSlideshowRequest("owner-a", key, input, business), /generate again/);
  assert.equal(completions.length - before, 1);
  suppliedOutput = { ...valid(), slides: [{ ...valid().slides[0], targetId: "other-slide" }] };
  await assert.rejects(planSlideshowRequest("owner-a", crypto.randomUUID(), input, business), /No image credits/);
  const pending = crypto.randomUUID();
  // Simulate interruption after the durable claim, before any completion can be saved.
  suppliedOutput = valid();
  await planSlideshowRequest("owner-a", pending, input, business);
  rows.get(`owner-a:${pending}`).status = "pending";
  const paid = completions.length;
  await assert.rejects(planSlideshowRequest("owner-a", pending, input, business), /still pending/);
  assert.equal(completions.length, paid);
});

test("changed saved profile facts, version or planner revision cannot reuse a completed plan", async () => {
  suppliedOutput = valid();
  const key = crypto.randomUUID();
  await planSlideshowRequest("owner-a", key, input, business);
  const before = completions.length;
  for (const changed of [
    { ...business, businessProfileVersion: 4 },
    { ...business, businessProfileId: "business-b" },
    { ...business, businessContext: { ...business.businessContext, productSummary: "Different approved product" } },
  ]) await assert.rejects(planSlideshowRequest("owner-a", key, input, changed), /changed/);
  // A pre-fix clarification stays immutable and is not re-run under a new policy.
  const oldKey = crypto.randomUUID();
  rows.set(`owner-a:${oldKey}`, { hash: "old-planner-hash", status: "completed", output_json: { ...valid(), slides: [], clarifications: ["Write all six slides"] } });
  await assert.rejects(planSlideshowRequest("owner-a", oldKey, input, business), /changed/);
  assert.equal(rows.get(`owner-a:${oldKey}`).output_json.clarifications[0], "Write all six slides");
  assert.equal(completions.length, before);
});

test("invalid or missing business facts fail before a durable claim or provider call", async () => {
  const before = completions.length, claims = rows.size;
  for (const invalid of [undefined, null, { ...business, businessContext: { ...business.businessContext, productSummary: "" } }]) {
    await assert.rejects(planSlideshowRequest("owner-a", crypto.randomUUID(), input, invalid), /saved business context/);
  }
  assert.equal(completions.length, before); assert.equal(rows.size, claims);
});

test("six-slide shared-face plans carry grounded copy and both person references to execution", async () => {
  const request = { ...input, prompt: "UGCpilot: wherever a face appears use the influencer images I supplied; change the content accordingly.",
    targetIds: Array.from({ length: 6 }, (_, i) => `s${i + 1}`), images: [
      ...Array.from({ length: 6 }, (_, i) => ({ ...input.images[0], id: `s${i + 1}`, label: `Source slide ${i + 1}`, sourceSlideNumber: i + 1, url: `https://owned.test/source${i + 1}.png` })),
      ...["B", "C"].map(name => ({ ...input.images[1], id: `upload:${name}`, label: `Upload ${name}`, url: `https://owned.test/face-${name}.png` })),
    ] };
  const copy = ["Create content for your business", "For founders", "Slow content creation?", "Start with a reusable draft", "Reuse your drafts", "UGC Pilot"];
  suppliedOutput = { version: 1, clarifications: [], unusedUploadIds: [], slides: request.targetIds.map((targetId, i) => ({ targetId, baseUploadId: null,
    instructions: `Recreate the person using Upload B and Upload C. Replace the text with "${copy[i]}".`, preserve: ["Keep source scene, clothing, pose and layout"],
    attachments: ["B", "C"].map(name => ({ imageId: `upload:${name}`, role: "person" })),
  })) };
  const plan = await planSlideshowRequest("owner-a", crypto.randomUUID(), request, business);
  assert.equal(plan.clarifications.length, 0);
  const message = JSON.parse(completions.at(-1).messages[1].content[0].text);
  assert.deepEqual(message.businessContext, business); assert.deepEqual(message.targetIds, request.targetIds);
  const { compileSlideshowOutputPlan } = await import("./slideshow-request-plan.ts");
  for (let i = 0; i < 6; i++) {
    const compiled = compileSlideshowOutputPlan(request, plan, i);
    assert.deepEqual(compiled.urls, [request.images[i].url, request.images[6].url, request.images[7].url]);
    assert.deepEqual(compiled.plan.images.map(image => image.role), ["source", "person", "person"]);
    assert.ok(compiled.plan.instructions.includes(copy[i]));
  }
});

test("named slide 5 device replacement keeps person and screenshot roles scoped through planning and execution", async () => {
  const request = { ...input,
    prompt: "Change the content for UGC Pilot and use the influencer face I supplied. On the fifth image replace the phone with a laptop; open the image I gave on it.",
    targetIds: Array.from({ length: 6 }, (_, i) => `s${i + 1}`),
    images: [
      ...Array.from({ length: 6 }, (_, i) => ({ ...input.images[0], id: `s${i + 1}`, label: `Source slide ${i + 1}`, sourceSlideNumber: i + 1, url: `https://owned.test/source${i + 1}.png` })),
      { ...input.images[1], id: "upload:a", label: "Upload A", url: "https://owned.test/person.png" },
      { ...input.images[1], id: "upload:b", label: "Upload B", url: "https://owned.test/website.png" },
    ] };
  suppliedOutput = { version: 1, clarifications: [], unusedUploadIds: [], slides: request.targetIds.map((targetId, i) => ({
    targetId, baseUploadId: null, instructions: i === 4 ? "Replace the phone with a held laptop displaying Upload B; use Upload A for the face." : "Use Upload A for the face. Preserve the scene.",
    preserve: ["Keep source layout and clothing"], attachments: [{ imageId: "upload:a", role: "person" }, ...(i === 4 ? [{ imageId: "upload:b", role: "screenshot" }] : [])],
  })) };
  const output = await planSlideshowRequest("owner-a", crypto.randomUUID(), request, business);
  const call = completions.at(-1), message = JSON.parse(call.messages[1].content[0].text);
  assert.equal(message.originalRequest, request.prompt); assert.deepEqual(message.targetIds, request.targetIds);
  assert.match(call.messages[0].content, /replacement laptop is the destination/);
  assert.match(call.messages[0].content, /competing screen destinations remain unresolved, clarify/);
  const { compileSlideshowOutputPlan } = await import("./slideshow-request-plan.ts");
  for (let i = 0; i < 6; i++) {
    const compiled = compileSlideshowOutputPlan(request, output, i);
    assert.deepEqual(compiled.plan.images.map(image => image.role), i === 4 ? ["source", "person", "screenshot"] : ["source", "person"]);
    assert.equal(compiled.urls.includes(request.images[7].url), i === 4);
    assert.equal(compiled.plan.sourceSlideNumber, i + 1);
  }
  // This test supplies a model response; it proves handoff and execution scoping,
  // not that a live model will always resolve an ambiguous instruction.
});
