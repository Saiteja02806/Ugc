import assert from "node:assert/strict";
import { test } from "node:test";
import { generateBusinessTrendingWallTextIdeas } from "./generate-trending-wall-text-ideas.ts";
import { deriveWallTextSpatialBudget } from "./wall-layout-engine.ts";
import { getWallTextGenerationWordBudget } from "./wall-text-copy-policy.ts";
import { validateWallTextContent } from "./wall-text-text-logic.ts";
import { createWallTextLayout } from "./wall-text-feed-logic.ts";

test("six-second and longer videos have the same layout-based word allowance", async () => {
  const layout = createWallTextLayout();
  const expected = await deriveWallTextSpatialBudget({ layout });
  for (const durationSeconds of [6, 6.016, 10, 30, 60]) {
    assert.deepEqual(await deriveWallTextSpatialBudget({ durationSeconds, layout }), expected);
  }
  assert.equal(expected.maxWords, 48);
});

test("every layout with room for it keeps the 36-word Wall target", () => {
  assert.deepEqual(getWallTextGenerationWordBudget({ spatialMaximum: 48 }), {
    maximum: 48,
    minimum: 24,
    target: 36,
  });
  assert.deepEqual(getWallTextGenerationWordBudget({ spatialMaximum: 40 }), {
    maximum: 40,
    minimum: 24,
    target: 36,
  });
  // A constrained layout stays render-safe instead of creating an impossible
  // 36-word requirement.
  assert.deepEqual(getWallTextGenerationWordBudget({ spatialMaximum: 32 }), {
    maximum: 32,
    minimum: 24,
    target: 32,
  });
});

test("a six-second job with an old 16-word cap accepts 48 words without reading-time rejection", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "offline-test";
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const writer = body.response_format.json_schema.name === "trending_wall_text_ideas_v8";
    const content = writer
      ? { ideas: [{ candidateIndex: 0, text: "I write a note at the end of each day so I can see what I did, what changed, and what needs care. The list stays clear when I wake up, so I can start with a step instead of trying to hold the plan in my head." }] }
      : { reviews: [{ candidateIndex: 0, approved: true, feedback: "Clear supported daily action.", naturalSpokenLanguage: true, oneCentralThought: true }] };
    return Response.json({ id: "test", object: "chat.completion", created: 0, model: "test", choices: [
      { index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content), refusal: null } },
    ] });
  };
  try {
    const accepted = [];
    const result = await generateBusinessTrendingWallTextIdeas({
      business: { claimsToAvoid: [], differentiators: [], painPoints: [], targetAudience: [], valueProps: [] },
      candidates: [{ candidateIndex: 0, durationSeconds: 6, layout: createWallTextLayout(), maxWords: 16, targetWords: 14 }],
      onChunkAccepted: async ideas => { accepted.push(...ideas); },
    });
    assert.equal(result.length, 1); assert.equal(accepted.length, 1);
    assert.equal(requests.length, 2, "one writer request and one review, no repair");
    const prompt = requests[0].messages[1].content;
    const candidate = JSON.parse(prompt.split("CANDIDATES: REQUIRED WORD RANGES AND ABSOLUTE SAFETY CEILINGS\n")[1].split("\n\nGLOBAL RULES")[0])[0];
    assert.equal(candidate.requiredWordRange.maximum, 48);
    assert.equal(candidate.durationSeconds, undefined);
    assert.equal(result[0].maxWords, 48);
    assert.equal(result[0].content.fullText.split(/\s+/u).length, 48);
    assert.doesNotThrow(() => validateWallTextContent(result[0].content, 6));
    const review = JSON.parse(requests[1].messages[1].content);
    assert.equal(review.candidates[0].durationSeconds, undefined);
    assert.equal(review.readingRule, undefined);
    assert.ok(!("readableWithinClip" in requests[1].response_format.json_schema.schema.properties.reviews.items.properties));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
