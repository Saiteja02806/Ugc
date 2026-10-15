import type { CarouselPlanValidationIssue } from "./carousel-llm-slide-plan.js";
import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";

export const CAROUSEL_COUNTED_BODY_REPAIR_VERSION = "structure-1-counted-body-repair-v1";
export type CarouselCountedBodyRepairPolicy = { version: typeof CAROUSEL_COUNTED_BODY_REPAIR_VERSION };
const BODY_CODES = new Set(["body_length", "body_word_limit", "grammar", "generic_copy", "incomplete_ending", "multiple_ideas", "headline_body_repetition", "render_fit"]);

export function validateCountedBodyRepairPolicy(policy?: CarouselCountedBodyRepairPolicy) {
  if (policy === undefined) return false;
  if (!policy || policy.version !== CAROUSEL_COUNTED_BODY_REPAIR_VERSION) throw new Error("Unsupported counted body repair policy.");
  return true;
}

export function getCountedBodyRepairSlides(slides: readonly PlannedCarouselSlide[], issues: readonly CarouselPlanValidationIssue[]) {
  if (!issues.length || issues.some((issue) => {
    const slide = slides.find((s) => s.slideNumber === issue.slideNumber);
    return !slide || slide.slideNumber === 1 || !slide.body || slide.listItems.length > 0 || !BODY_CODES.has(issue.code)
      || (issue.code === "render_fit" && !/^Body/.test(issue.message));
  })) return null;
  return [...new Set(issues.map((issue) => issue.slideNumber!))].sort((a, b) => a - b);
}

export function buildCountedBodyRepairSchema(slideNumbers: readonly number[]) {
  const wordBlock = { type: "array", minItems: 9, maxItems: 12,
    items: { type: "string", minLength: 1, maxLength: 40, description: "Exactly one written word, with punctuation attached if needed. No whitespace or standalone punctuation." } } as const;
  return { type: "object", additionalProperties: false, properties: {
    bodiesBySlide: { type: "object", additionalProperties: false,
      properties: Object.fromEntries(slideNumbers.map((n) => [`slide${n}`, {
        type: "object", additionalProperties: false, properties: { firstWords: wordBlock, secondWords: wordBlock }, required: ["firstWords", "secondWords"],
      }])), required: slideNumbers.map((n) => `slide${n}`),
    },
  }, required: ["bodiesBySlide"] } as const;
}

// Use the same counted representation for initial plans and full-item repairs.
// Otherwise a non-body issue bypasses the body-only repair and reintroduces
// short copy. Persisted plans still contain the original string body contract.
export function withCountedPlanBodies<T>(schema: T): T {
  const result = structuredClone(schema);
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    const properties = node.properties as Record<string, unknown> | undefined;
    if (properties?.slideNumber && properties.body) {
      const body = properties.body as { type?: string };
      if (body.type !== "null") {
        const counted = buildCountedBodyRepairSchema([2]).properties.bodiesBySlide.properties.slide2;
        properties.body = counted;
      }
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }
  visit(result);
  return result;
}

export function decodeCountedPlanBodies(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const plan = value as Record<string, unknown>;
  if (!Array.isArray(plan.slides)) return value;
  return { ...plan, slides: plan.slides.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const slide = value as Record<string, unknown>;
    // Strings remain readable for historical responses and replay fixtures.
    if (!slide.body || typeof slide.body !== "object") return slide;
    const number = slide.slideNumber;
    if (!Number.isInteger(number) || (number as number) < 2 || (number as number) > 6) {
      throw new Error("Counted plan body requires a follow-up slide number.");
    }
    const replacements = parseCountedBodyRepair({ bodiesBySlide: { [`slide${number}`]: slide.body } }, [number as number]);
    return { ...slide, body: replacements.get(number as number)! };
  }) };
}

export function parseCountedBodyRepair(value: unknown, slideNumbers: readonly number[]) {
  function record(value: unknown, keys: string[]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Counted repair must contain objects.");
    const object = value as Record<string, unknown>;
    if (Object.keys(object).length !== keys.length || keys.some((key) => !Object.hasOwn(object, key))) throw new Error("Counted repair returned unexpected or missing fields.");
    return object;
  }
  const root = record(value, ["bodiesBySlide"]);
  const bodies = record(root.bodiesBySlide, slideNumbers.map((n) => `slide${n}`));
  const replacements = new Map<number, string>();
  for (const n of slideNumbers) {
    const blocks = record(bodies[`slide${n}`], ["firstWords", "secondWords"]);
    const text = [blocks.firstWords, blocks.secondWords].map((words) => {
      if (!Array.isArray(words) || words.length < 9 || words.length > 12 || words.some((word) =>
        typeof word !== "string" || word.length > 40 || /\s/u.test(word) || !/^[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*[.!?,]?$/u.test(word),
      )) throw new Error("Counted repair needs 9-12 single words per block.");
      return words.join(" ");
    }).join("\n\n");
    // Both word counters used by the legacy planner must still accept it.
    const count = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g)?.length ?? 0;
    if (text.length > 300 || count < 18 || count > 30) throw new Error("Counted repair exceeds the existing body contract.");
    replacements.set(n, text);
  }
  return replacements;
}
