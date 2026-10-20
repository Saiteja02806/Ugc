import type { CarouselContentPlan, CarouselPlanValidationIssue } from "./carousel-llm-slide-plan.js";
import { buildCountedBodyRepairSchema, parseCountedBodyRepair } from "./carousel-counted-body-repair.js";

type Plan = Pick<CarouselContentPlan, "concept" | "broadSituations" | "contentStrategy" | "slides">;
export function getScopedPlanRepair(plan: Plan, issues: readonly CarouselPlanValidationIssue[]) {
  const bodies = new Set<number>(), lists = new Set<number>(), imageDirections = new Set<number>();
  let concept = false, angle = false, broadSituations = false;
  function addSlide(number: number) {
    const slide = plan.slides.find((item) => item.slideNumber === number);
    if (!slide || number === 1 || slide.headline) return false;
    if (slide.listItems.length > 0) lists.add(number);
    else if (slide.body) bodies.add(number);
    else return false;
    return true;
  }
  for (const issue of issues) {
    if (issue.code === "unsafe_visual_direction") {
      if (issue.slideNumber === null || issue.slideNumber < 2 || !plan.slides.some(slide => slide.slideNumber === issue.slideNumber)) return null;
      imageDirections.add(issue.slideNumber);
    } else if (issue.code === "grounding_disconnected") {
      if (issue.slideNumber === null) concept = true;
      else if (!addSlide(issue.slideNumber)) return null;
    } else if (issue.code === "generic_copy" && issue.slideNumber === null) {
      concept = angle = broadSituations = true;
    } else if (["body_length", "body_word_limit", "grammar", "generic_copy", "incomplete_ending", "multiple_ideas", "repeated_punctuation"].includes(issue.code)
      || (issue.code === "render_fit" && /^Body|^List/.test(issue.message))) {
      if (issue.slideNumber === null || !addSlide(issue.slideNumber)) return null;
    } else return null;
  }
  if (!issues.length) return null;
  return { bodies: [...bodies].sort(), lists: [...lists].sort(), imageDirections: [...imageDirections].sort(), concept, angle, broadSituations };
}
type Scope = NonNullable<ReturnType<typeof getScopedPlanRepair>>;
export function buildScopedPlanRepairSchema(plan: Plan, scope: Scope) {
  const properties: Record<string, unknown> = {};
  if (scope.imageDirections.length) {
    const directions = Object.fromEntries(scope.imageDirections.map(number => [`slide${number}`, {
      type: "string", minLength: 1, maxLength: 180,
      description: "Describe physical objects and text-safe space only. No person, team, customer, worker, face, hand, body or silhouette, even as a label or exclusion.",
    }]));
    properties.imageDirectionsBySlide = { type: "object", additionalProperties: false, properties: directions, required: Object.keys(directions) };
  }
  if (scope.bodies.length) properties.bodiesBySlide = buildCountedBodyRepairSchema(scope.bodies).properties.bodiesBySlide;
  if (scope.lists.length) {
    const lists = Object.fromEntries(scope.lists.map((number) => {
      const count = plan.slides.find((slide) => slide.slideNumber === number)!.listItems.length;
      return [`slide${number}`, { type: "array", minItems: count, maxItems: count, items: { type: "string", minLength: 1, maxLength: 88 } }];
    }));
    properties.listsBySlide = { type: "object", additionalProperties: false, properties: lists, required: Object.keys(lists) };
  }
  if (scope.concept) properties.concept = { type: "string", minLength: 1, maxLength: 120 };
  if (scope.angle) properties.angle = { type: "string", minLength: 1, maxLength: 160 };
  if (scope.broadSituations) properties.broadSituations = { type: "array", minItems: 3, maxItems: 8, items: { type: "string", minLength: 1, maxLength: 120 } };
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

export function applyScopedPlanRepair<T extends Plan>(plan: T, scope: Scope, value: unknown): T {
  const schema = buildScopedPlanRepairSchema(plan, scope);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Scoped repair must be an object.");
  const patch = value as Record<string, unknown>;
  if (Object.keys(patch).length !== schema.required.length || schema.required.some((key) => !Object.hasOwn(patch, key))) {
    throw new Error("Scoped repair changed unrequested fields.");
  }
  const bodies = scope.bodies.length ? parseCountedBodyRepair({ bodiesBySlide: patch.bodiesBySlide }, scope.bodies) : new Map<number, string>();
  const directions = patch.imageDirectionsBySlide as Record<string, unknown> | undefined;
  if (scope.imageDirections.length && (!directions || typeof directions !== "object" || Array.isArray(directions)
    || Object.keys(directions).length !== scope.imageDirections.length
    || scope.imageDirections.some(number => typeof directions[`slide${number}`] !== "string"
      || !(directions[`slide${number}`] as string).trim() || (directions[`slide${number}`] as string).length > 180))) {
    throw new Error("Scoped repair returned invalid image direction fields.");
  }
  const lists = patch.listsBySlide as Record<string, unknown> | undefined;
  if (scope.lists.length && (!lists || typeof lists !== "object" || Array.isArray(lists)
    || Object.keys(lists).length !== scope.lists.length || scope.lists.some((number) => !Array.isArray(lists[`slide${number}`])))) {
    throw new Error("Scoped repair returned invalid list fields.");
  }
  // Full shape and publishing validation run immediately after this merge.
  return { ...plan,
    ...(scope.concept ? { concept: patch.concept } : {}),
    ...(scope.angle ? { contentStrategy: { ...plan.contentStrategy, angle: patch.angle } } : {}),
    ...(scope.broadSituations ? { broadSituations: patch.broadSituations } : {}),
    slides: plan.slides.map(slide => !bodies.has(slide.slideNumber) && !scope.lists.includes(slide.slideNumber) && !scope.imageDirections.includes(slide.slideNumber)
      ? slide : ({ ...slide,
      ...(bodies.has(slide.slideNumber) ? { body: bodies.get(slide.slideNumber)!, subtext: bodies.get(slide.slideNumber)! } : {}),
      ...(scope.lists.includes(slide.slideNumber) ? { listItems: lists![`slide${slide.slideNumber}`] } : {}),
      ...(scope.imageDirections.includes(slide.slideNumber) ? { imageDirection: directions![`slide${slide.slideNumber}`] } : {}),
    })),
  } as T;
}
