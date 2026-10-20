import assert from "node:assert/strict";
import test from "node:test";
import fixture from "./carousel-config/visual-repair-synthetic-batch.json" with { type: "json" };
import { CAROUSEL_BATCH_POSITION_KEYS } from "./carousel-batch-positions.js";
import { CAROUSEL_COUNTED_BODY_REPAIR_VERSION, decodeCountedPlanBodies } from "./carousel-counted-body-repair.js";
import { buildCarouselContentPlanBatch, CarouselPartialBatchPlanningError, type CarouselBatchContentPlanInput } from "./carousel-llm-slide-plan.js";
import type { WebsiteBusinessAnalysis } from "../types.js";
import { renderCarouselSlideWithDiagnostics } from "./carousel-render-slide.js";
import sharp from "sharp";

// Captured from a live synthetic (not customer) baseline that completed 2/5.
const analysis: WebsiteBusinessAnalysis = {
  businessName: "CampaignFlow", category: "marketing software", categories: ["campaign planning"],
  brandTone: "clear and practical", confidence: "high", claimsToAvoid: ["guaranteed revenue growth"],
  carouselAngles: ["A calmer campaign handoff"], ctaIdeas: ["Organize your next campaign"],
  differentiators: ["Planning and reporting stay in one workspace"],
  mainProblem: "Campaign planning and reporting are scattered across tools",
  mainPromise: "Keep campaign work in one organized workflow", painPoints: ["Missed follow-ups"],
  productSummary: "A workspace for planning and reporting marketing campaigns.",
  targetAudience: ["small marketing teams"], valueProps: ["Connect planning, follow-up, and reporting"],
  visualKeywords: ["paper calendar", "organized desk"],
};
const originals = CAROUSEL_BATCH_POSITION_KEYS.map(key => fixture.initial.items[key].plan);
const input: CarouselBatchContentPlanInput = {
  analysis, businessDescription: analysis.productSummary!, recentHistory: [],
  bodyRepairPolicy: { version: CAROUSEL_COUNTED_BODY_REPAIR_VERSION },
  items: originals.map((plan, slotIndex) => ({ slotIndex, candidateIndex: slotIndex,
    contentFormatId: plan.contentStrategy.contentFormatId, hookFamilyId: plan.contentStrategy.hookFamilyId,
    creativeSeed: plan.concept, emotion: "relief", hookTemplateId: null, hookTemplateVersion: null, planningBrief: null })),
};
const repairBySlot = new Map([0, 2, 3, 4].map((slot, index) => [slot, fixture.repairs[index]!]));
let probeNumber = 0;
async function probe(mode: "valid" | "unsafe" | "malformed") {
  const previousFetch = globalThis.fetch, previousKey = process.env.OPENAI_API_KEY;
  const requests: Array<{ response_format: { json_schema: { name: string; schema: { required: string[] } } }; messages: Array<{ content: string }> }> = [];
  let currentSlot = 0;
  let malformedSent = false;
  process.env.OPENAI_API_KEY = `synthetic-no-network-${mode}-${++probeNumber}`;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)); requests.push(request);
    assert.ok(requests.length <= 9, "One initial batch and at most two repairs per rejected slot");
    const schema = request.response_format.json_schema;
    let content: unknown = fixture.initial;
    if (schema.name !== "carousel_content_batch") {
      assert.equal(schema.name, "scoped_carousel_batch_repair");
      assert.deepEqual(schema.schema.required, ["imageDirectionsBySlide"], "Visual repair must never request a full copy rewrite");
      const user = JSON.parse(request.messages.at(-1).content);
      currentSlot = originals.findIndex(plan => plan.concept === user.frozenPlan.concept);
      assert.ok(currentSlot >= 0);
      if (mode === "malformed" && !malformedSent) { content = {}; malformedSent = true; }
      else if (mode === "unsafe") {
        content = { imageDirectionsBySlide: Object.fromEntries(user.scope.imageDirections.map((n: number) => [`slide${n}`, "A team at a desk."])) };
      } else content = repairBySlot.get(currentSlot);
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try { return { completed: await buildCarouselContentPlanBatch(input), requests }; }
  finally { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
}

test("the exact synthetic baseline retains all five carousels after visual-only repairs", async () => {
  const { completed, requests } = await probe("valid");
  assert.equal(completed.length, 5);
  assert.equal(requests.length, 5);
  for (const item of completed) {
    const original = decodeCountedPlanBodies(originals[item.slotIndex]) as { slides: Array<Record<string, unknown>> };
    assert.equal(item.plan.validationResult.ok, true);
    for (const [index, slide] of item.plan.slides.entries()) {
      for (const field of ["headline", "body", "listItems", "ctaText", "formatRole", "slideType", "textMode"] as const) {
        assert.deepEqual(slide[field], original.slides[index]![field], `${item.slotIndex}/${index}/${field} must remain frozen`);
      }
    }
  }
  const slotZeroRepair = JSON.parse(requests[1]!.messages.at(-1)!.content);
  assert.deepEqual(slotZeroRepair.scope.imageDirections, [2, 5], "Collect all unsafe directions rather than stopping at the first one");
});

test("unsafe visual repairs stay blocked with slot-specific diagnostics and a bounded budget", async () => {
  await assert.rejects(probe("unsafe"), (error: unknown) => {
    assert.ok(error instanceof CarouselPartialBatchPlanningError);
    assert.deepEqual(error.completedItems.map(item => item.slotIndex), [1]);
    assert.deepEqual(error.failures.map(failure => failure.slotIndex), [0, 2, 3, 4]);
    for (const failure of error.failures) {
      assert.ok(failure.initialIssues.every(issue => issue.code === "unsafe_visual_direction"));
      assert.ok(failure.finalIssues.every(issue => issue.code === "unsafe_visual_direction"));
      assert.match(failure.rawLlmResponse.repair!, /Structure 1 repair attempt/);
      assert.ok(failure.rawLlmResponse.initial);
    }
    return true;
  });
});

test("a malformed scoped provider response uses the second repair without rewriting copy", async () => {
  const { completed, requests } = await probe("malformed");
  assert.equal(completed.length, 5);
  assert.equal(requests.length, 6);
  assert.ok(requests.slice(1).every(request => request.response_format.json_schema.name === "scoped_carousel_batch_repair"));
});

test("all thirty repaired slides render at the actual fixed fonts in both supported ratios", async () => {
  const { completed } = await probe("valid");
  const background = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#405060" } }).png().toBuffer();
  const assetUrl = `data:image/png;base64,${background.toString("base64")}`;
  let renderedCount = 0;
  for (const format of ["1:1", "4:5"] as const) {
    for (const item of completed) {
      for (const slide of item.plan.slides) {
        const rendered = await renderCarouselSlideWithDiagnostics({ assetUrl, slide, format, textStyle: "highlight" });
        const metadata = await sharp(rendered.buffer).metadata();
        assert.equal(metadata.width, 1080);
        assert.equal(metadata.height, format === "1:1" ? 1080 : 1350);
        renderedCount++;
      }
    }
  }
  assert.equal(renderedCount, 60);
});
