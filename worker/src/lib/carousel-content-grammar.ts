import formatsJson from "./carousel-config/formats.json" with { type: "json" };
import hookFamiliesJson from "./carousel-config/hook-families.json" with {
  type: "json",
};

import type {
  CarouselTextMode,
  PlannedCarouselSlide,
} from "./carousel-slide-plan.js";

export const CAROUSEL_CONTENT_FORMAT_IDS = [
  "list",
  "mistakes",
  "how_to",
  "comparison",
  "swap",
  "myth_fact",
  "cheat_sheet",
  "checklist",
  "framework",
  "breakdown",
  "problem_solution",
  "beginner_roadmap",
  "resources",
  "examples",
  "before_after",
] as const;

export const CAROUSEL_HOOK_FAMILY_IDS = [
  "curiosity",
  "surprise",
  "comparison",
  "problem_recognition",
  "mistake",
  "specific_outcome",
  "question",
  "contrarian",
  "utility",
  "beginner",
] as const;

export type CarouselContentFormatId =
  (typeof CAROUSEL_CONTENT_FORMAT_IDS)[number];
export type CarouselHookFamilyId =
  (typeof CAROUSEL_HOOK_FAMILY_IDS)[number];

export type CarouselFormatSlideDefinition = {
  instruction: string;
  listItemCount?: number;
  preferredTextModes: CarouselTextMode[];
  role: string;
  slideType: PlannedCarouselSlide["slideType"];
};

export type CarouselContentFormatDefinition = {
  compatibleHookFamilies: CarouselHookFamilyId[];
  generationRules: string[];
  id: CarouselContentFormatId;
  minimumTopicOptions: number;
  name: string;
  purpose: string;
  selectionWeight: number;
  slides: CarouselFormatSlideDefinition[];
};

export type CarouselHookFamilyDefinition = {
  avoid: string[];
  id: CarouselHookFamilyId;
  name: string;
  purpose: string;
  rules: string[];
  useWhen: string[];
};

type CarouselContentGrammar = {
  formats: CarouselContentFormatDefinition[];
  formatsVersion: string;
  hookFamilies: CarouselHookFamilyDefinition[];
  hookFamiliesVersion: string;
  version: string;
};

const SLIDE_TYPES = new Set<PlannedCarouselSlide["slideType"]>([
  "benefit",
  "cta",
  "differentiator",
  "hook",
  "problem",
  "solution",
]);
const TEXT_MODES = new Set<CarouselTextMode>([
  "body_only",
  "checklist",
  "cta_takeaway",
  "headline_body",
  "question_list",
  "single_statement",
]);
const FORMAT_IDS = new Set<string>(CAROUSEL_CONTENT_FORMAT_IDS);
const HOOK_FAMILY_IDS = new Set<string>(CAROUSEL_HOOK_FAMILY_IDS);

export const CAROUSEL_CONTENT_GRAMMAR = parseCarouselContentGrammar({
  formats: formatsJson,
  hookFamilies: hookFamiliesJson,
});

export const CAROUSEL_CONTENT_GRAMMAR_VERSION =
  CAROUSEL_CONTENT_GRAMMAR.version;

const contentFormatMap = new Map(
  CAROUSEL_CONTENT_GRAMMAR.formats.map((format) => [format.id, format]),
);
const hookFamilyMap = new Map(
  CAROUSEL_CONTENT_GRAMMAR.hookFamilies.map((family) => [family.id, family]),
);

export function isCarouselContentFormatId(
  value: unknown,
): value is CarouselContentFormatId {
  return typeof value === "string" && FORMAT_IDS.has(value);
}

export function isCarouselHookFamilyId(
  value: unknown,
): value is CarouselHookFamilyId {
  return typeof value === "string" && HOOK_FAMILY_IDS.has(value);
}

export function getCarouselContentFormat(value: CarouselContentFormatId) {
  const format = contentFormatMap.get(value);

  if (!format) {
    throw new Error(`Unknown Carousel content format: ${value}.`);
  }

  return format;
}

export function getCarouselHookFamily(value: CarouselHookFamilyId) {
  const family = hookFamilyMap.get(value);

  if (!family) {
    throw new Error(`Unknown Carousel hook family: ${value}.`);
  }

  return family;
}

function parseCarouselContentGrammar(input: {
  formats: unknown;
  hookFamilies: unknown;
}): CarouselContentGrammar {
  const formatsRecord = asRecord(input.formats, "Carousel formats config");
  const hookFamiliesRecord = asRecord(
    input.hookFamilies,
    "Carousel hook families config",
  );
  const formatsVersion = getRequiredString(
    formatsRecord.version,
    "Carousel formats version",
  );
  const hookFamiliesVersion = getRequiredString(
    hookFamiliesRecord.version,
    "Carousel hook families version",
  );

  if (!Array.isArray(formatsRecord.formats)) {
    throw new Error("Carousel formats config must contain a formats array.");
  }

  if (!Array.isArray(hookFamiliesRecord.hookFamilies)) {
    throw new Error(
      "Carousel hook families config must contain a hookFamilies array.",
    );
  }

  const hookFamilies = hookFamiliesRecord.hookFamilies.map((value, index) =>
    parseHookFamily(value, index),
  );
  assertExactIds(
    hookFamilies.map((family) => family.id),
    CAROUSEL_HOOK_FAMILY_IDS,
    "hook family",
  );

  const formats = formatsRecord.formats.map((value, index) =>
    parseContentFormat(value, index),
  );
  assertExactIds(
    formats.map((format) => format.id),
    CAROUSEL_CONTENT_FORMAT_IDS,
    "content format",
  );

  for (const format of formats) {
    if (format.slides[0]?.slideType !== "hook") {
      throw new Error(`${format.id} must start with a hook slide.`);
    }

    if (format.slides[4]?.slideType !== "cta") {
      throw new Error(`${format.id} must end with a takeaway/CTA slide.`);
    }

    if (format.compatibleHookFamilies.length === 0) {
      throw new Error(`${format.id} needs at least one compatible hook family.`);
    }
  }

  return {
    formats,
    formatsVersion,
    hookFamilies,
    hookFamiliesVersion,
    version: `${formatsVersion}+${hookFamiliesVersion}`,
  };
}

function parseContentFormat(
  value: unknown,
  index: number,
): CarouselContentFormatDefinition {
  const record = asRecord(value, `Carousel content format ${index + 1}`);
  const id = getRequiredString(record.id, `format ${index + 1} id`);

  if (!isCarouselContentFormatId(id)) {
    throw new Error(`Unknown Carousel content format id: ${id}.`);
  }

  if (!Array.isArray(record.slides) || record.slides.length !== 5) {
    throw new Error(`${id} must define exactly five slides.`);
  }

  const compatibleHookFamilies = getStringArray(
    record.compatibleHookFamilies,
    `${id} compatible hook families`,
  ).map((hookFamilyId) => {
    if (!isCarouselHookFamilyId(hookFamilyId)) {
      throw new Error(
        `${id} references unknown hook family ${hookFamilyId}.`,
      );
    }

    return hookFamilyId;
  });

  return {
    compatibleHookFamilies,
    generationRules: getStringArray(
      record.generationRules,
      `${id} generation rules`,
    ),
    id,
    minimumTopicOptions: getInteger(
      record.minimumTopicOptions,
      `${id} minimumTopicOptions`,
      1,
      12,
    ),
    name: getRequiredString(record.name, `${id} name`),
    purpose: getRequiredString(record.purpose, `${id} purpose`),
    selectionWeight: getNumber(
      record.selectionWeight,
      `${id} selectionWeight`,
      0.1,
      10,
    ),
    slides: record.slides.map((slide, slideIndex) =>
      parseFormatSlide(slide, id, slideIndex),
    ),
  };
}

function parseFormatSlide(
  value: unknown,
  formatId: CarouselContentFormatId,
  index: number,
): CarouselFormatSlideDefinition {
  const record = asRecord(value, `${formatId} slide ${index + 1}`);
  const slideType = getRequiredString(
    record.slideType,
    `${formatId} slide ${index + 1} type`,
  );

  if (!SLIDE_TYPES.has(slideType as PlannedCarouselSlide["slideType"])) {
    throw new Error(`${formatId} slide ${index + 1} has invalid slideType.`);
  }

  const preferredTextModes = getStringArray(
    record.preferredTextModes,
    `${formatId} slide ${index + 1} preferredTextModes`,
  ).map((textMode) => {
    if (!TEXT_MODES.has(textMode as CarouselTextMode)) {
      throw new Error(
        `${formatId} slide ${index + 1} has invalid text mode ${textMode}.`,
      );
    }

    return textMode as CarouselTextMode;
  });
  const listItemCount =
    record.listItemCount === undefined
      ? undefined
      : getInteger(
          record.listItemCount,
          `${formatId} slide ${index + 1} listItemCount`,
          2,
          4,
        );

  return {
    instruction: getRequiredString(
      record.instruction,
      `${formatId} slide ${index + 1} instruction`,
    ),
    ...(listItemCount === undefined ? {} : { listItemCount }),
    preferredTextModes,
    role: getRequiredString(
      record.role,
      `${formatId} slide ${index + 1} role`,
    ),
    slideType: slideType as PlannedCarouselSlide["slideType"],
  };
}

function parseHookFamily(
  value: unknown,
  index: number,
): CarouselHookFamilyDefinition {
  const record = asRecord(value, `Carousel hook family ${index + 1}`);
  const id = getRequiredString(record.id, `hook family ${index + 1} id`);

  if (!isCarouselHookFamilyId(id)) {
    throw new Error(`Unknown Carousel hook family id: ${id}.`);
  }

  return {
    avoid: getStringArray(record.avoid, `${id} avoid rules`),
    id,
    name: getRequiredString(record.name, `${id} name`),
    purpose: getRequiredString(record.purpose, `${id} purpose`),
    rules: getStringArray(record.rules, `${id} rules`),
    useWhen: getStringArray(record.useWhen, `${id} useWhen rules`),
  };
}

function assertExactIds(
  actualIds: readonly string[],
  expectedIds: readonly string[],
  label: string,
) {
  if (
    actualIds.length !== expectedIds.length ||
    expectedIds.some((id) => !actualIds.includes(id)) ||
    new Set(actualIds).size !== actualIds.length
  ) {
    throw new Error(
      `Carousel ${label} config must define every canonical id exactly once.`,
    );
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function getRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function getStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }

  return value.map((item, index) =>
    getRequiredString(item, `${label} item ${index + 1}`),
  );
}

function getInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }

  return value;
}

function getNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }

  return value;
}
