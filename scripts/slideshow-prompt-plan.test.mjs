import assert from "node:assert/strict";
import test from "node:test";
import { SlideshowPromptInputSchema, validateSlideshowPromptOutput, slideshowPromptImproverMessage } from "../lib/explore/slideshow-prompt-plan.ts";
import { requestSlideshowPromptRewrite } from "../lib/explore/slideshow-prompt-client.ts";

const input = { prompt: 'Change the first heading to "Everything You Need To Start A SaaS". Use my uploaded screen in the second selected slide.' };
const output = () => ({ version: 1, prompt: 'Change the first heading to "Everything You Need To Start A SaaS". Use the actual uploaded screenshot inside the second selected slide’s screen, preserving the surroundings.', clarifications: [] });

test("rewrite receives user text only: images, attachment metadata and slide arrays are rejected", () => {
  const parsed = SlideshowPromptInputSchema.parse(input);
  const message = JSON.parse(slideshowPromptImproverMessage({ ...parsed, images: ["data:image/png;base64,pixels"], imageUrl: "https://private.test/image.png", slides: [1, 4] }));
  assert.deepEqual(message, { originalRequest: input.prompt });
  for (const extra of [{ images: ["pixels"] }, { imageUrl: "https://private.test/image.png" }, { slides: [1, 4] }, { attachmentCount: 1 }, { businessContext: { businessName: "Company" } }]) assert.equal(SlideshowPromptInputSchema.safeParse({ ...input, ...extra }).success, false);
});

test("only one nonempty prompt can be returned; per-slide forms and oversized output are rejected", () => {
  assert.deepEqual(validateSlideshowPromptOutput(output()), output());
  for (const invalid of [{ version: 1, slides: [{ instructions: "One per slide" }], clarifications: [] }, { ...output(), prompt: " " }, { ...output(), prompt: "x".repeat(8001) }, { ...output(), plans: [] }]) assert.throws(() => validateSlideshowPromptOutput(invalid));
  assert.deepEqual(validateSlideshowPromptOutput({ ...output(), clarifications: ["What should the background show?"] }).clarifications, ["What should the background show?"]);
});

test("lost responses and reloaded clients reuse the paid identity; owners and explicit retries stay separate", async () => {
  const values = new Map(), requests = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const locks = { request: async (_key, callback) => callback() };
  const send = async (url, options) => { requests.push({ url, ...options }); if (requests.length === 1) throw Error("lost response"); return Response.json({ ok: true, output: output() }); };
  const args = { owner: "owner-a", input, token: "token", storage, locks, send };
  await assert.rejects(requestSlideshowPromptRewrite(args), /lost response/);
  assert.deepEqual(await requestSlideshowPromptRewrite(args), output());
  assert.equal(requests[0].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  assert.deepEqual(JSON.parse(requests[1].body), input);
  await requestSlideshowPromptRewrite({ ...args, owner: "owner-b" });
  assert.notEqual(requests[2].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  await requestSlideshowPromptRewrite({ ...args, newAttempt: true });
  assert.notEqual(requests[3].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  const before = requests.length;
  await assert.rejects(requestSlideshowPromptRewrite({ ...args, storage: { ...storage, setItem() { throw Error("storage blocked"); } } }), /storage blocked/);
  assert.equal(requests.length, before);
});

test("different prompts get different request identities, and malformed results never replace user text", async () => {
  const values = new Map(), keys = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const args = { owner: "owner-a", input, token: "token", storage, locks: { request: async (_, callback) => callback() }, send: async (_, options) => { keys.push(options.headers["Idempotency-Key"]); return Response.json({ ok: true, output: output() }); } };
  await requestSlideshowPromptRewrite(args);
  await requestSlideshowPromptRewrite({ ...args, input: { prompt: "Change a different slide" } });
  assert.notEqual(keys[0], keys[1]);
  await assert.rejects(requestSlideshowPromptRewrite({ ...args, send: async () => Response.json({ ok: true, output: { slides: [] } }) }));
  assert.equal(input.prompt.includes('"Everything You Need To Start A SaaS"'), true);
});
