import formatsJson from "./carousel-config/structure-2-formats.json" with {
  type: "json",
};

export const CAROUSEL_STRUCTURE_2_FORMAT_IDS = [
  "wrong_belief",
  "perfect_plan_breaks",
  "stopped_behavior",
  "terrible_at",
  "result_without_sacrifice",
  "identity_transformation",
  "new_rule",
  "wrong_villain",
] as const;

export const CAROUSEL_STRUCTURE_2_STORY_ROLES = [
  "recognition",
  "failure_scene",
  "reframe",
  "product_turning_point",
  "proof_reflection_cta",
] as const;

export type CarouselStructure2FormatId =
  (typeof CAROUSEL_STRUCTURE_2_FORMAT_IDS)[number];
export type CarouselStructure2StoryRole =
  (typeof CAROUSEL_STRUCTURE_2_STORY_ROLES)[number];
export type CarouselStructure2Perspective =
  | "first_person"
  | "first_person_then_viewer";
export type CarouselStructure2ProductMention =
  | "forbidden"
  | "optional"
  | "required";
export type CarouselStructure2CtaPolicy = "native_experiment" | "none";

export type CarouselStructure2SlideDefinition = {
  ctaPolicy: CarouselStructure2CtaPolicy;
  instruction: string;
  maximumWords: number;
  minimumWords: number;
  perspective: CarouselStructure2Perspective;
  productMention: CarouselStructure2ProductMention;
  slideNumber: number;
  storyRole: CarouselStructure2StoryRole;
};

export type CarouselStructure2FormatDefinition = {
  aliases: string[];
  allowedCtaPositions: number[];
  exampleFlows: CarouselStructure2StoryRole[][];
  generationRules: string[];
  id: CarouselStructure2FormatId;
  name: string;
  purpose: string;
  rotationOrder: number;
  selectionWeight: number;
  slides: CarouselStructure2SlideDefinition[];
  version: number;
};

type CarouselStructure2FormatLibrary = {
  backboneVersion: string;
  formats: CarouselStructure2FormatDefinition[];
  version: string;
};

const FORMAT_IDS = new Set<string>(CAROUSEL_STRUCTURE_2_FORMAT_IDS);
const STORY_ROLES = new Set<string>(CAROUSEL_STRUCTURE_2_STORY_ROLES);
const PERSPECTIVES = new Set<CarouselStructure2Perspective>([
  "first_person",
  "first_person_then_viewer",
]);
const PRODUCT_MENTION_POLICIES = new Set<CarouselStructure2ProductMention>([
  "forbidden",
  "optional",
  "required",
]);
const CTA_POLICIES = new Set<CarouselStructure2CtaPolicy>([
  "native_experiment",
  "none",
]);

export const CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY =
  parseCarouselStructure2FormatLibrary(formatsJson);
export const CAROUSEL_STRUCTURE_2_FORMATS_VERSION =
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.version;
export const CAROUSEL_STRUCTURE_2_BACKBONE_VERSION =
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.backboneVersion;

const formatMap = new Map(
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats.map((format) => [
    format.id,
    format,
  ]),
);
const aliasMap = new Map(
  CAROUSEL_STRUCTURE_2_FORMAT_LIBRARY.formats.flatMap((format) =>
    format.aliases.map((alias) => [alias, format.id] as const),
  ),
);

export function isCarouselStructure2FormatId(
  value: unknown,
): value is CarouselStructure2FormatId {
  return typeof value === "string" && FORMAT_IDS.has(value);
}

export function resolveCarouselStructure2FormatId(
  value: unknown,
): CarouselStructure2FormatId | null {
  if (isCarouselStructure2FormatId(value)) return value;
  return typeof value === "string" ? (aliasMap.get(value) ?? null) : null;
}

export function getCarouselStructure2Format(
  formatId: CarouselStructure2FormatId,
) {
  const format = formatMap.get(formatId);

  if (!format) {
    throw new Error(`Unknown Carousel Structure 2 format: ${formatId}.`);
  }

  return format;
}

function parseCarouselStructure2FormatLibrary(
  value: unknown,
): CarouselStructure2FormatLibrary {
  const record = asRecord(value, "Carousel Structure 2 format library");
  const version = getRequiredString(
    record.version,
    "Carousel Structure 2 formats version",
  );
  const backboneVersion = getRequiredString(
    record.backboneVersion,
    "Carousel Structure 2 backbone version",
  );

  if (!Array.isArray(record.formats)) {
    throw new Error("Carousel Structure 2 format library needs a formats array.");
  }

  const formats = record.formats.map(parseFormat);
  assertExactCanonicalIds(formats.map((format) => format.id));
  assertExactRotationOrder(formats);
  assertAliases(formats);

  return { backboneVersion, formats, version };
}

function parseFormat(value: unknown, index: number) {
  const record = asRecord(value, `Carousel Structure 2 format ${index + 1}`);
  const id = getRequiredString(record.id, `Structure 2 format ${index + 1} id`);

  if (!isCarouselStructure2FormatId(id)) {
    throw new Error(`Unknown Carousel Structure 2 format id: ${id}.`);
  }

  if (!Array.isArray(record.slides) || record.slides.length !== 5) {
    throw new Error(`${id} must define exactly five story slides.`);
  }

  const slides = record.slides.map((slide, slideIndex) =>
    parseSlide(slide, id, slideIndex),
  );

  const allowedCtaPositions = getIntegerArray(
    record.allowedCtaPositions,
    `${id} allowed CTA positions`,
    1,
    5,
  );
  const exampleFlows = getStoryRoleFlows(record.exampleFlows, id);

  return {
    aliases: getOptionalStringArray(record.aliases, `${id} aliases`),
    allowedCtaPositions,
    exampleFlows,
    generationRules: getRequiredStringArray(
      record.generationRules,
      `${id} generation rules`,
    ),
    id,
    name: getRequiredString(record.name, `${id} name`),
    purpose: getRequiredString(record.purpose, `${id} purpose`),
    rotationOrder: getInteger(
      record.rotationOrder,
      `${id} rotation order`,
      1,
      CAROUSEL_STRUCTURE_2_FORMAT_IDS.length,
    ),
    selectionWeight: getNumber(
      record.selectionWeight,
      `${id} selection weight`,
      0.1,
      10,
    ),
    slides,
    version: getInteger(record.version, `${id} version`, 1, 10_000),
  } satisfies CarouselStructure2FormatDefinition;
}

function parseSlide(
  value: unknown,
  formatId: CarouselStructure2FormatId,
  slideIndex: number,
) {
  const label = `${formatId} slide ${slideIndex + 1}`;
  const record = asRecord(value, label);
  const storyRole = getRequiredString(record.storyRole, `${label} story role`);
  const perspective = getRequiredString(
    record.perspective,
    `${label} perspective`,
  );
  const productMention = getRequiredString(
    record.productMention,
    `${label} product mention policy`,
  );
  const ctaPolicy = getRequiredString(record.ctaPolicy, `${label} CTA policy`);
  const minimumWords = getInteger(
    record.minimumWords,
    `${label} minimum words`,
    1,
    60,
  );
  const maximumWords = getInteger(
    record.maximumWords,
    `${label} maximum words`,
    minimumWords,
    60,
  );

  if (!STORY_ROLES.has(storyRole)) {
    throw new Error(`${label} has invalid story role ${storyRole}.`);
  }
  if (!PERSPECTIVES.has(perspective as CarouselStructure2Perspective)) {
    throw new Error(`${label} has invalid perspective ${perspective}.`);
  }
  if (
    !PRODUCT_MENTION_POLICIES.has(
      productMention as CarouselStructure2ProductMention,
    )
  ) {
    throw new Error(
      `${label} has invalid product mention policy ${productMention}.`,
    );
  }
  if (!CTA_POLICIES.has(ctaPolicy as CarouselStructure2CtaPolicy)) {
    throw new Error(`${label} has invalid CTA policy ${ctaPolicy}.`);
  }
  if (record.slideNumber !== slideIndex + 1) {
    throw new Error(`${label} has an invalid slide number.`);
  }

  const expectedProductMention =
    slideIndex < 3 ? "forbidden" : slideIndex === 3 ? "required" : "optional";
  const expectedPerspective =
    slideIndex === 4 ? "first_person_then_viewer" : "first_person";
  const expectedCtaPolicy = slideIndex === 4 ? "native_experiment" : "none";

  if (
    productMention !== expectedProductMention ||
    perspective !== expectedPerspective ||
    ctaPolicy !== expectedCtaPolicy
  ) {
    throw new Error(`${label} violates the locked Structure 2 story backbone.`);
  }

  return {
    ctaPolicy: ctaPolicy as CarouselStructure2CtaPolicy,
    instruction: getRequiredString(record.instruction, `${label} instruction`),
    maximumWords,
    minimumWords,
    perspective: perspective as CarouselStructure2Perspective,
    productMention: productMention as CarouselStructure2ProductMention,
    slideNumber: slideIndex + 1,
    storyRole: storyRole as CarouselStructure2StoryRole,
  } satisfies CarouselStructure2SlideDefinition;
}

function assertExactCanonicalIds(actualIds: readonly string[]) {
  if (
    actualIds.length !== CAROUSEL_STRUCTURE_2_FORMAT_IDS.length ||
    CAROUSEL_STRUCTURE_2_FORMAT_IDS.some((id) => !actualIds.includes(id)) ||
    new Set(actualIds).size !== actualIds.length
  ) {
    throw new Error(
      "Carousel Structure 2 config must define exactly eight canonical format ids.",
    );
  }
}

function assertExactRotationOrder(
  formats: readonly CarouselStructure2FormatDefinition[],
) {
  const actual = formats
    .map((format) => format.rotationOrder)
    .sort((left, right) => left - right);

  if (actual.some((value, index) => value !== index + 1)) {
    throw new Error(
      "Carousel Structure 2 formats must define rotation orders 1 through 8 exactly once.",
    );
  }
}

function assertAliases(formats: readonly CarouselStructure2FormatDefinition[]) {
  const aliases = formats.flatMap((format) => format.aliases);

  if (
    aliases.some((alias) => FORMAT_IDS.has(alias)) ||
    new Set(aliases).size !== aliases.length
  ) {
    throw new Error(
      "Carousel Structure 2 aliases must be unique and cannot be canonical ids.",
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

function getRequiredStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }

  return value.map((item, index) =>
    getRequiredString(item, `${label} item ${index + 1}`),
  );
}

function getOptionalStringArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a string array.`);
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

function getIntegerArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty integer array.`);
  }

  const result = value.map((item, index) =>
    getInteger(item, `${label} item ${index + 1}`, minimum, maximum),
  );

  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }

  return result;
}

function getStoryRoleFlows(value: unknown, formatId: CarouselStructure2FormatId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${formatId} exampleFlows must be a non-empty array.`);
  }

  return value.map((flow, flowIndex) => {
    if (!Array.isArray(flow) || flow.length !== 5) {
      throw new Error(`${formatId} example flow ${flowIndex + 1} must contain five roles.`);
    }

    return flow.map((role, roleIndex) => {
      if (typeof role !== "string" || !STORY_ROLES.has(role)) {
        throw new Error(
          `${formatId} example flow ${flowIndex + 1} role ${roleIndex + 1} is invalid.`,
        );
      }

      return role as CarouselStructure2StoryRole;
    });
  });
}
