import assert from "node:assert/strict";
import test from "node:test";
import { buildCountedBodyRepairSchema, decodeCountedPlanBodies, getCountedBodyRepairSlides, parseCountedBodyRepair, validateCountedBodyRepairPolicy, withCountedPlanBodies } from "./carousel-counted-body-repair.js";
import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";
const words = "Keep the campaign context beside the next decision today.".split(" ");

test("counted generation and full repairs enforce body arrays without changing cover/list schemas", () => {
  const stringBody = { anyOf: [{ type: "string" }, { type: "null" }] };
  const schema = { items: { anyOf: [
    { properties: { slideNumber: { enum: [1] }, body: { type: "null" } } },
    { properties: { slideNumber: { enum: [2] }, body: stringBody } },
    { properties: { slideNumber: { enum: [3] }, body: { type: "null" } } },
  ] } };
  const counted = withCountedPlanBodies(schema);
  assert.deepEqual(schema.items.anyOf[1]!.properties.body, stringBody);
  assert.deepEqual(counted.items.anyOf[0]!.properties.body, { type: "null" });
  assert.deepEqual(counted.items.anyOf[2]!.properties.body, { type: "null" });
  assert.match(JSON.stringify(counted.items.anyOf[1]), /firstWords/);
  const decoded = decodeCountedPlanBodies({ concept: "Specific workflow", slides: [
    { slideNumber: 1, body: null },
    { slideNumber: 2, body: { firstWords: words, secondWords: words } },
  ] }) as { slides: { body: string | null }[] };
  assert.equal(decoded.slides[0]!.body, null);
  assert.equal(decoded.slides[1]!.body, `${words.join(" ")}\n\n${words.join(" ")}`);
  assert.throws(() => decodeCountedPlanBodies({ slides: [{ slideNumber: 2, body: { firstWords: ["short"], secondWords: words } }] }));
});

test("counted repair rejects whitespace tokens, missing blocks, extra fields and word padding", () => {
  const good = { bodiesBySlide: { slide6: { firstWords: words, secondWords: words } } };
  assert.equal(parseCountedBodyRepair(good, [6]).get(6), `${words.join(" ")}\n\n${words.join(" ")}`);
  for (const invalid of [
    { bodiesBySlide: { slide6: { firstWords: [...words.slice(1)], secondWords: words } } },
    { bodiesBySlide: { slide6: { firstWords: ["two words", ...words.slice(1)], secondWords: words } } },
    { bodiesBySlide: { slide6: { firstWords: [".", ...words.slice(1)], secondWords: words } } },
    { bodiesBySlide: { slide6: { firstWords: words } } },
    { bodiesBySlide: { slide6: { firstWords: words, secondWords: words }, slide2: {} } },
  ]) assert.throws(() => parseCountedBodyRepair(invalid, [6]));
  assert.doesNotMatch(JSON.stringify(buildCountedBodyRepairSchema([6])), /"pattern"/);
});

test("counted repair only selects scoped non-list body failures and rejects unknown policy", () => {
  const slide = { slideNumber: 6, body: "Keep the next decision visible", listItems: [] } as unknown as PlannedCarouselSlide;
  assert.deepEqual(getCountedBodyRepairSlides([slide], [{ code: "body_length", slideNumber: 6, message: "Short body" }]), [6]);
  for (const issue of [
    { code: "grounding_disconnected" as const, slideNumber: null, message: "Disconnected" },
    { code: "render_fit" as const, slideNumber: 6, message: "Headline does not fit" },
    { code: "unsupported_claim" as const, slideNumber: 6, message: "Unknown claim" },
  ]) assert.equal(getCountedBodyRepairSlides([slide], [issue]), null);
  assert.equal(getCountedBodyRepairSlides([{ ...slide, listItems: ["One", "Two"] }], [{ code: "body_length", slideNumber: 6, message: "Short" }]), null);
  assert.equal(validateCountedBodyRepairPolicy(), false);
  assert.throws(() => validateCountedBodyRepairPolicy({ version: "unknown" } as never), /Unsupported/);
});
