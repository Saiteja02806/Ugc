import assert from "node:assert/strict";
import test from "node:test";
import { planReactionGeneration } from "./reaction-generation.js";
import { RetryableJobError } from "../retryable-job-error.js";

const intents = ["shock", "facepalm", "deadpan", "relief"] as const;
const emotions = ["surprise", "frustration", "irony", "relief"] as const;
const input: Parameters<typeof planReactionGeneration>[0] = {
  backgrounds: [{ id: "bg", status: "active", sourceStorageKey: "bg.png", foregroundPlacement: "bottom_center", contextTags: ["office"] }],
  clips: intents.map((intent, index) => ({ id: `clip-${index}`, status: "active", sourceStorageKey: "clip.webm", hasAlpha: true,
    foregroundAnchor: "bottom_center", foregroundHeightPercent: 0.5, reactions: [intent],
    composition: "bust", durationSeconds: 6, subjectCount: "one" })),
  context: { audience: ["office workers"], commonSituations: ["changing plans"], desiredOutcomes: ["clarity"], pains: ["confusion"] },
  historyByClipId: new Map(), requestedCount: 4, seed: "test",
};
function brief(slotIndex: number, intentIndex = slotIndex) {
  return {
    slotIndex, preferredReactions: [intents[intentIndex]!],
    content: {
      lines: ["When that tiny task", `becomes problem number ${slotIndex + 1}`],
      emotion: emotions[intentIndex]!, languageFormat: "when", visualTreatment: "outlined_text",
      visualContextTags: ["office"],
      semantic: { structure: "expectation_reality", expectation: "A tiny task", reality: "Another problem" },
    },
  };
}
const success = (briefs: unknown[]) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ briefs }) } }] }), {
  status: 200, headers: { "content-type": "application/json" },
});
type CapturedRequest = {
  reasoning_effort: string;
  messages: { content: string }[];
  response_format: { json_schema: { schema: { properties: { briefs: {
    minItems: number; maxItems: number;
    items: { properties: { slotIndex: { enum: number[] }; content: { properties: Record<string, unknown>; required: string[] } } };
  } } } } };
};

test("Reaction repairs preserve validated siblings and enforce the original batch rules", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  const requests: CapturedRequest[] = [];
  let respond: (attempt: number) => Response = () => success([]);
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return respond(requests.length);
  };
  try {
    await t.test("only an incompatible slot is regenerated; the model does not repeat caption text", async () => {
      requests.length = 0;
      const originals = intents.map((_, index) => brief(index));
      respond = (attempt) => success(attempt === 1
        ? originals.map((item, index) => index === 1 ? { ...item, content: { ...item.content, emotion: "relief" } } : item)
        : [brief(1)]);
      const plan = await planReactionGeneration(input);
      assert.equal(plan.items.length, 4);
      assert.equal(requests.length, 2);
      assert.equal(requests[0]!.reasoning_effort, "minimal");
      const schema = requests[1]!.response_format.json_schema.schema.properties.briefs;
      assert.equal(schema.minItems, 1);
      assert.equal(schema.maxItems, 1);
      assert.deepEqual(schema.items.properties.slotIndex.enum, [1]);
      assert.equal("caption" in schema.items.properties.content.properties, false);
      assert.equal(schema.items.properties.content.required.includes("caption"), false);
      assert.match(requests[0]!.messages[1]!.content, /Allowed primary reactions by emotion/);
      assert.match(requests[0]!.messages[1]!.content, /"frustration":\["facepalm"\]/);
      for (const slot of [0, 2, 3]) assert.deepEqual(plan.items[slot]!.content.lines, originals[slot]!.content.lines);
      assert.equal(plan.items[1]!.caption, originals[1]!.content.lines.join(" "));
    });

    await t.test("duplicate primary intents repair only the conflicting slot", async () => {
      requests.length = 0;
      respond = (attempt) => success(attempt === 1 ? [brief(0), brief(1, 0)] : [brief(1)]);
      const plan = await planReactionGeneration({ ...input, requestedCount: 2 });
      assert.deepEqual(plan.items.map((item) => item.primaryReaction), ["shock", "facepalm"]);
      assert.deepEqual(requests[1]!.response_format.json_schema.schema.properties.briefs.items.properties.slotIndex.enum, [1]);
      assert.match(requests[1]!.messages[1]!.content, /"slotIndex":0,"primaryReaction":"shock"/);
    });

    await t.test("duplicated slots remain pending and repair cannot overwrite an accepted slot", async () => {
      requests.length = 0;
      respond = (attempt) => success(attempt === 1
        ? [brief(0), brief(1), brief(1)]
        : [{ ...brief(0), content: { ...brief(0).content, lines: ["A replacement that must never be used"] } }, brief(1)]);
      const plan = await planReactionGeneration({ ...input, requestedCount: 2 });
      assert.deepEqual(plan.items[0]!.content.lines, brief(0).content.lines);
      assert.equal(plan.items.length, 2);
      assert.equal(requests.length, 2);
    });

    await t.test("invalid copy stays rejected after the three-request budget", async () => {
      requests.length = 0;
      const invalid = { ...brief(1), content: { ...brief(1).content, lines: ["Buy now and download our app today"] } };
      respond = (attempt) => success(attempt === 1 ? [brief(0), invalid] : [invalid]);
      await assert.rejects(planReactionGeneration({ ...input, requestedCount: 2 }), /after 3 attempts/);
      assert.equal(requests.length, 3);
      for (const request of requests.slice(1)) {
        assert.deepEqual(request.response_format.json_schema.schema.properties.briefs.items.properties.slotIndex.enum, [1]);
      }
    });

    await t.test("a repair provider outage yields without additional inline requests", async () => {
      requests.length = 0;
      respond = (attempt) => attempt === 1 ? success([brief(0)]) : new Response(JSON.stringify({ error: { message: "temporary outage" } }), {
        status: 503, headers: { "content-type": "application/json" },
      });
      await assert.rejects(planReactionGeneration({ ...input, requestedCount: 2 }), RetryableJobError);
      assert.equal(requests.length, 2);
    });

    await t.test("incompatible catalog intents fail before spending a model request", async () => {
      requests.length = 0;
      await assert.rejects(planReactionGeneration({ ...input, clips: [{ ...input.clips[0]!, reactions: ["playful"] }], requestedCount: 1 }), /no available intent compatible/);
      assert.equal(requests.length, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
