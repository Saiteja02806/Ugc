import assert from "node:assert/strict";
import { test } from "node:test";
import { generateBusinessTrendingWallTextIdeas } from "./generate-trending-wall-text-ideas.ts";
import { deriveWallTextSpatialBudget } from "./wall-layout-engine.ts";
import { validateWallTextContent } from "./wall-text-text-logic.ts";
import { createWallTextLayout } from "./wall-text-feed-logic.ts";

test("six-second and longer videos have the same layout-based word allowance", async () => {
  const layout = createWallTextLayout();
  const expected = await deriveWallTextSpatialBudget({ layout });
  for (const durationSeconds of [6, 6.016, 10, 30, 60]) {
    assert.deepEqual(await deriveWallTextSpatialBudget({ durationSeconds, layout }), expected);
  }
  assert.equal(expected.maxWords, 26);
});

test("a six-second job with an old 16-word cap accepts 26 words without reading-time rejection", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "offline-test";
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const writer = body.response_format.json_schema.name === "trending_wall_text_ideas_v8";
    const content = writer
      ? { ideas: [{ candidateIndex: 0, text: "I keep my ideas in notes and tell myself I will post later. By the end of the week those small plans are still waiting there." }] }
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
    assert.equal(candidate.requiredWordRange.maximum, 26);
    assert.equal(candidate.durationSeconds, undefined);
    assert.equal(result[0].maxWords, 26);
    assert.equal(result[0].content.fullText.split(/\s+/u).length, 26);
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
