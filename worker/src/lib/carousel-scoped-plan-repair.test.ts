import assert from "node:assert/strict";
import test from "node:test";
import fixture from "./carousel-config/counted-body-synthetic-fixture.json" with { type: "json" };
import { decodeCountedPlanBodies } from "./carousel-counted-body-repair.js";
import { applyScopedPlanRepair, buildScopedPlanRepairSchema, getScopedPlanRepair } from "./carousel-scoped-plan-repair.js";
import type { CarouselContentPlan } from "./carousel-llm-slide-plan.js";

test("mixed grounding/body repairs cannot replace valid slides, grounding, roles or image directions", () => {
  const plan = decodeCountedPlanBodies(fixture) as CarouselContentPlan;
  const scope = getScopedPlanRepair(plan, [
    { code: "grounding_disconnected", slideNumber: null, message: "Disconnected concept" },
    { code: "grammar", slideNumber: 5, message: "Repeated word" },
  ]);
  assert.ok(scope);
  assert.deepEqual(buildScopedPlanRepairSchema(plan, scope).required, ["bodiesBySlide", "concept"]);
  const patch = { bodiesBySlide: { slide5: fixture.slides[4]!.body }, concept: "A concrete planning decision" };
  const repaired = applyScopedPlanRepair(plan, scope, patch);
  assert.equal(repaired.concept, patch.concept);
  for (let index = 0; index < plan.slides.length; index += 1) {
    const actual = repaired.slides[index]!, original = plan.slides[index]!;
    assert.deepEqual(actual, index === 4 ? { ...original, subtext: original.body } : original);
  }
  assert.equal(repaired.grounding, plan.grounding);
  assert.equal(repaired.contentStrategy, plan.contentStrategy);
  assert.throws(() => applyScopedPlanRepair(plan, scope, { ...patch, grounding: { anchorId: "invented" } }), /unrequested/);
  assert.equal(getScopedPlanRepair(plan, [{ code: "unsupported_claim", slideNumber: 5, message: "False claim" }]), null);
  assert.equal(getScopedPlanRepair(plan, [{ code: "render_fit", slideNumber: 1, message: "Headline overflow" }]), null);
});

test("list repair is scoped to exact configured items and cannot change another slide", () => {
  const plan = decodeCountedPlanBodies(fixture) as CarouselContentPlan;
  const scope = getScopedPlanRepair(plan, [{ code: "grounding_disconnected", slideNumber: 3, message: "Disconnected middle" }]);
  assert.ok(scope);
  const items = ["Check the campaign approval", "Record the planning decision"];
  const result = applyScopedPlanRepair(plan, scope, { listsBySlide: { slide3: items } });
  assert.deepEqual(result.slides[2]!.listItems, items);
  assert.equal(result.slides[3], plan.slides[3]);
  assert.throws(() => applyScopedPlanRepair(plan, scope, { listsBySlide: { slide2: items } }), /invalid list/);
});
