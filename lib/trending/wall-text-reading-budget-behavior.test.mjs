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
  assert.equal(expected.maxWords, 48);
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
      : { reviews: [{ candidateIndex: 0, approved: true, feedback: "Clear supported daily action.", naturalSpokenLanguage: true, oneCentralThought: true, preservesPlannedSituation: true }] };
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

test("fact-grounded copy still receives a flexible situation-fidelity review", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "offline-test-grounded-situation";
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const writer = body.response_format.json_schema.name === "trending_wall_text_ideas_v8";
    const content = writer
      ? {
          ideas: [{
            candidateIndex: 0,
            text: "A founder opens the content calendar before lunch, keeps every post organized, and chooses what to share instead of searching scattered tabs after a client message changes the afternoon.",
          }],
        }
      : {
          reviews: [{
            approved: true,
            candidateIndex: 0,
            feedback: "The copy keeps the planned client-message moment without copying its phrasing.",
            naturalSpokenLanguage: true,
            oneCentralThought: true,
            preservesPlannedSituation: true,
          }],
        };
    return Response.json({ id: "test", object: "chat.completion", created: 0, model: "test", choices: [
      { index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content), refusal: null } },
    ] });
  };
  try {
    const grounding = {
      assignedFact: {
        id: "capability-content-calendar",
        text: "A content calendar keeps every post organized.",
        type: "capability",
      },
      contextVersion: "wall-text-grounding-v2",
      factSnapshot: {
        claimsToAvoid: [],
        facts: [{
          id: "capability-content-calendar",
          text: "A content calendar keeps every post organized.",
          type: "capability",
        }],
        version: "business-facts-v1",
      },
    };
    const result = await generateBusinessTrendingWallTextIdeas({
      business: { claimsToAvoid: [], differentiators: [], painPoints: [], targetAudience: [], valueProps: [] },
      candidates: [{
        candidateIndex: 0,
        durationSeconds: 6,
        grounding,
        layout: createWallTextLayout(),
        maxWords: 48,
        privateCreativeContext: {
          contentIdea: "A client message reshapes the content plan before the afternoon begins",
          feeling: "relief",
          planningBrief: {
            audienceContext: "Founders managing a changing content calendar",
            creativeSeed: "A single client message reveals how scattered planning becomes",
            emotionalTension: "A calm plan turns into a search through tabs",
            humanMoment: "A client message changes the afternoon after a founder opens the content calendar",
            supportedAngle: "A content calendar keeps every post organized.",
          },
        },
        targetWords: 30,
      }],
    });

    assert.equal(result.length, 1);
    assert.equal(requests.length, 2, "a fact-grounded candidate must not bypass the reviewer");
    assert.equal(
      requests[1].response_format.json_schema.name,
      "trending_wall_text_review_v10",
    );
    const review = JSON.parse(requests[1].messages[1].content);
    assert.equal(
      review.candidates[0].plan.humanMoment,
      "A client message changes the afternoon after a founder opens the content calendar",
    );
    assert.equal(
      review.candidates[0].plan.emotionalTension,
      "A calm plan turns into a search through tabs",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
