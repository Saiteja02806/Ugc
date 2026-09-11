import {
  CAROUSEL_CONTENT_FORMAT_IDS,
  getCarouselContentFormat,
  getCarouselHookFamily,
  isCarouselContentFormatId,
  isCarouselHookFamilyId,
  type CarouselContentFormatDefinition,
  type CarouselContentFormatId,
  type CarouselHookFamilyDefinition,
  type CarouselHookFamilyId,
} from "./carousel-content-grammar.ts";

/**
 * Structure 1's Slide 1 pattern catalog. A template is prompt guidance, not
 * generated copy: the planner must adapt placeholders to the supported topic
 * and remove any unsupported proof, metric, or time promise.
 */
export const CAROUSEL_HOOK_TEMPLATE_VERSION = 1;
export const CAROUSEL_HOOK_TEMPLATE_CATALOG_VERSION =
  "carousel-hook-templates-v1";

export const CAROUSEL_HOOK_TEMPLATE_IDS = [
  "cracked_the_code",
  "advice_to_ignore",
  "doing_it_wrong",
  "start_from_scratch",
  "improve_fast",
  "stop_doing_this",
  "three_things_i_wish_i_knew",
  "simple_switch_10x",
  "approach_isnt_working",
  "the_real_reason",
  "steal_this_formula",
  "improved_in_30_days",
  "post_format_changed_everything",
  "hook_that_got_me_noticed",
  "stuck_read_this",
  "try_this_first",
  "strategy_no_one_talks_about",
  "tried_for_30_days",
  "improve_in_one_hour",
  "thing_holding_you_back",
] as const;

export type CarouselHookTemplateId =
  (typeof CAROUSEL_HOOK_TEMPLATE_IDS)[number];

export type CarouselHookTemplateFit = "adaptable" | "preferred";

export type CarouselHookTemplateFallbackReason =
  | "format_mismatch"
  | "hook_family_mismatch"
  | "incomplete_assignment"
  | "not_assigned"
  | "unknown_template"
  | "version_mismatch";

export type CarouselHookTemplateDefinition = {
  /** Formats where the pattern can work after a more deliberate rewrite. */
  adaptableFormatIds: CarouselContentFormatId[];
  /** How the planner must treat a performance, time, or personal-result claim. */
  claimHandling: "adapt_if_unsupported" | "plain";
  compatibleHookFamilies: CarouselHookFamilyId[];
  id: CarouselHookTemplateId;
  /** Exact source pattern, retained as a structural guide for Slide 1 only. */
  pattern: string;
  /** Formats whose content promise naturally matches this pattern. */
  preferredFormatIds: CarouselContentFormatId[];
  /** Limits a copywriting-specific pattern to relevant business contexts. */
  requiredContextKeywords?: string[];
  title: string;
  version: number;
};

export type CarouselStructure1CombinedFormat = {
  combinedFormatId: string;
  fallbackReason: CarouselHookTemplateFallbackReason | null;
  format: CarouselContentFormatDefinition;
  hookFamily: CarouselHookFamilyDefinition;
  hookTemplate: CarouselHookTemplateDefinition | null;
  hookTemplateFit: CarouselHookTemplateFit | null;
};

export const CAROUSEL_HOOK_TEMPLATES: readonly CarouselHookTemplateDefinition[] = [
  template("cracked_the_code", "I finally cracked the code for {topic}", ["curiosity", "specific_outcome"], "adapt_if_unsupported", ["how_to", "framework", "problem_solution"], ["list", "checklist", "breakdown", "beginner_roadmap", "before_after", "examples"]),
  template("advice_to_ignore", "{topic} advice you should really ignore", ["contrarian", "problem_recognition", "question"], "plain", ["myth_fact", "mistakes"], ["problem_solution", "comparison"]),
  template("doing_it_wrong", "You’re doing {topic} wrong (here’s how to fix it)", ["mistake", "problem_recognition", "contrarian"], "plain", ["mistakes", "problem_solution", "myth_fact"], ["swap", "checklist", "beginner_roadmap"]),
  template("start_from_scratch", "If I had to start from scratch, here’s what I’d do about {topic}", ["beginner", "utility"], "adapt_if_unsupported", ["beginner_roadmap", "how_to"], ["checklist", "framework", "resources", "list", "cheat_sheet"]),
  template("improve_fast", "This is what I’d do if I wanted to improve {topic} fast", ["specific_outcome", "utility"], "adapt_if_unsupported", ["how_to", "swap", "beginner_roadmap"], ["checklist", "framework", "before_after"]),
  template("stop_doing_this", "Stop doing this if you want better {topic}", ["mistake", "problem_recognition", "contrarian"], "adapt_if_unsupported", ["mistakes", "swap", "problem_solution"], ["myth_fact", "checklist"]),
  template("three_things_i_wish_i_knew", "3 things I wish I knew before trying {topic}", ["beginner", "utility", "mistake", "curiosity"], "adapt_if_unsupported", ["mistakes", "how_to", "swap", "myth_fact", "framework", "examples", "breakdown"], ["beginner_roadmap"]),
  template("simple_switch_10x", "This simple switch got me 10x better results with {topic}", ["specific_outcome", "surprise", "comparison", "curiosity"], "adapt_if_unsupported", ["before_after"], ["comparison", "problem_solution"]),
  template("approach_isnt_working", "Here’s why your approach to {topic} isn’t working", ["problem_recognition", "contrarian"], "plain", ["problem_solution", "mistakes"], ["myth_fact", "swap", "beginner_roadmap"]),
  template("the_real_reason", "The real reason {topic}", ["curiosity", "problem_recognition", "question"], "plain", ["problem_solution", "breakdown", "myth_fact"], ["mistakes", "comparison", "before_after"]),
  template("steal_this_formula", "Steal this exact formula for {topic}", ["utility", "curiosity"], "plain", ["framework", "how_to"], ["cheat_sheet", "checklist"]),
  template("improved_in_30_days", "I improved my {topic} in 30 days. Here’s how.", ["specific_outcome", "curiosity"], "adapt_if_unsupported", ["before_after"], ["how_to", "beginner_roadmap", "framework"]),
  template("post_format_changed_everything", "This post format changed everything about how I do {topic}", ["curiosity", "surprise"], "adapt_if_unsupported", ["before_after", "examples"], ["how_to", "framework", "comparison"], ["content", "copy", "social", "marketing", "instagram", "linkedin", "creator", "post"]),
  template("hook_that_got_me_noticed", "The hook that made me get noticed (and how to write yours)", ["curiosity", "utility"], "adapt_if_unsupported", ["framework", "how_to", "examples"], [], ["content", "copy", "social", "marketing", "instagram", "linkedin", "creator", "post"]),
  template("stuck_read_this", "If you’re stuck on {topic}, read this", ["problem_recognition", "beginner", "utility"], "plain", ["beginner_roadmap", "problem_solution", "how_to"], ["checklist", "cheat_sheet", "resources"]),
  template("try_this_first", "Don’t do anything else before you try this with {topic}", ["utility", "curiosity", "beginner"], "plain", ["how_to", "beginner_roadmap", "checklist"], ["problem_solution", "framework", "swap", "resources"]),
  template("strategy_no_one_talks_about", "The strategy no one talks about for {topic} (but it works)", ["contrarian", "curiosity", "utility"], "adapt_if_unsupported", ["framework", "problem_solution"], ["how_to", "checklist", "before_after", "breakdown"]),
  template("tried_for_30_days", "I tried {topic} for 30 days. Here’s what happened.", ["curiosity", "surprise"], "adapt_if_unsupported", ["before_after", "examples"], ["how_to", "comparison"]),
  template("improve_in_one_hour", "Here’s how I would improve {topic} if I only had 1 hour", ["utility", "specific_outcome"], "adapt_if_unsupported", ["how_to", "checklist", "cheat_sheet"], ["beginner_roadmap", "framework", "breakdown"]),
  template("thing_holding_you_back", "The thing holding you back with {topic} (and how to fix it)", ["problem_recognition", "mistake", "curiosity"], "plain", ["problem_solution", "mistakes"], ["breakdown", "beginner_roadmap"]),
];

const TEMPLATE_IDS = new Set<string>(CAROUSEL_HOOK_TEMPLATE_IDS);
const templateMap = new Map(
  CAROUSEL_HOOK_TEMPLATES.map((template) => [template.id, template]),
);

assertHookTemplateCatalog();

export function isCarouselHookTemplateId(
  value: unknown,
): value is CarouselHookTemplateId {
  return typeof value === "string" && TEMPLATE_IDS.has(value);
}

export function getCarouselHookTemplate(id: CarouselHookTemplateId) {
  const template = templateMap.get(id);

  if (!template) {
    throw new Error(`Unknown Carousel hook template: ${id}.`);
  }

  return template;
}

export function getCompatibleCarouselHookTemplates(params: {
  contentFormatId: CarouselContentFormatId;
  contextText?: string | null;
  hookFamilyId: CarouselHookFamilyId;
}) {
  const contextText = params.contextText?.toLowerCase() ?? "";

  return CAROUSEL_HOOK_TEMPLATES.filter((template) => {
    if (!template.compatibleHookFamilies.includes(params.hookFamilyId)) {
      return false;
    }

    if (!getCarouselHookTemplateFit(template, params.contentFormatId)) {
      return false;
    }

    return (
      !template.requiredContextKeywords ||
      template.requiredContextKeywords.some((keyword) =>
        contextText.includes(keyword),
      )
    );
  });
}

export function getCarouselHookTemplateFit(
  template: CarouselHookTemplateDefinition,
  contentFormatId: CarouselContentFormatId,
): CarouselHookTemplateFit | null {
  if (template.preferredFormatIds.includes(contentFormatId)) return "preferred";
  if (template.adaptableFormatIds.includes(contentFormatId)) return "adaptable";
  return null;
}

/**
 * Resolve the required Structure 1 format and its optional Slide 1 overlay into
 * one six-slide contract. Optional-template defects deliberately return the
 * native format instead of becoming a generation failure.
 */
export function resolveCarouselStructure1CombinedFormat(params: {
  contentFormatId: CarouselContentFormatId;
  hookFamilyId: CarouselHookFamilyId;
  hookTemplateId?: string | null;
  hookTemplateVersion?: number | null;
}): CarouselStructure1CombinedFormat {
  const baseFormat = getCarouselContentFormat(params.contentFormatId);
  const hookFamily = getCarouselHookFamily(params.hookFamilyId);

  if (!baseFormat.compatibleHookFamilies.includes(params.hookFamilyId)) {
    throw new Error(
      `${params.hookFamilyId} is not compatible with ${params.contentFormatId}.`,
    );
  }

  const native = (
    fallbackReason: CarouselHookTemplateFallbackReason,
  ): CarouselStructure1CombinedFormat => ({
    combinedFormatId: `${baseFormat.id}__native`,
    fallbackReason,
    format: baseFormat,
    hookFamily,
    hookTemplate: null,
    hookTemplateFit: null,
  });

  if (params.hookTemplateId === null || params.hookTemplateId === undefined) {
    return native(
      params.hookTemplateVersion === null ||
        params.hookTemplateVersion === undefined
        ? "not_assigned"
        : "incomplete_assignment",
    );
  }
  if (!isCarouselHookTemplateId(params.hookTemplateId)) {
    return native("unknown_template");
  }

  const hookTemplate = getCarouselHookTemplate(params.hookTemplateId);
  if (params.hookTemplateVersion !== hookTemplate.version) {
    return native("version_mismatch");
  }
  if (!hookTemplate.compatibleHookFamilies.includes(params.hookFamilyId)) {
    return native("hook_family_mismatch");
  }

  const hookTemplateFit = getCarouselHookTemplateFit(
    hookTemplate,
    params.contentFormatId,
  );
  if (!hookTemplateFit) return native("format_mismatch");

  const slides = baseFormat.slides.map((slide, index) =>
    index === 0
      ? {
          ...slide,
          instruction: [
            slide.instruction,
            `Apply the ${hookTemplateFit} Slide 1 pattern “${hookTemplate.pattern}” as an adaptable structure, not literal copy.`,
            `The final cover must honestly preview this format: ${baseFormat.purpose}`,
          ].join(" "),
        }
      : slide,
  );

  return {
    combinedFormatId: `${baseFormat.id}__${hookTemplate.id}`,
    fallbackReason: null,
    format: { ...baseFormat, slides },
    hookFamily,
    hookTemplate,
    hookTemplateFit,
  };
}

function template(
  id: CarouselHookTemplateId,
  pattern: string,
  compatibleHookFamilies: CarouselHookFamilyId[],
  claimHandling: CarouselHookTemplateDefinition["claimHandling"],
  preferredFormatIds: CarouselContentFormatId[],
  adaptableFormatIds: CarouselContentFormatId[] = [],
  requiredContextKeywords?: string[],
): CarouselHookTemplateDefinition {
  return {
    adaptableFormatIds,
    claimHandling,
    compatibleHookFamilies,
    id,
    pattern,
    preferredFormatIds,
    requiredContextKeywords,
    title: pattern.replace("{topic}", "…"),
    version: CAROUSEL_HOOK_TEMPLATE_VERSION,
  };
}

function assertHookTemplateCatalog() {
  if (CAROUSEL_HOOK_TEMPLATES.length !== CAROUSEL_HOOK_TEMPLATE_IDS.length) {
    throw new Error("Carousel hook template catalog must define exactly 20 templates.");
  }

  for (const template of CAROUSEL_HOOK_TEMPLATES) {
    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(template.id)) {
      throw new Error(`Carousel hook template has invalid id: ${template.id}.`);
    }
    if (!template.pattern.trim() || template.version < 1) {
      throw new Error(`Carousel hook template ${template.id} is incomplete.`);
    }
    if (!template.compatibleHookFamilies.length) {
      throw new Error(`Carousel hook template ${template.id} needs a hook family.`);
    }
    if (template.preferredFormatIds.length + template.adaptableFormatIds.length === 0) {
      throw new Error(`Carousel hook template ${template.id} needs at least one format mapping.`);
    }
    if (
      template.compatibleHookFamilies.some(
        (hookFamilyId) => !isCarouselHookFamilyId(hookFamilyId),
      ) ||
      [...template.preferredFormatIds, ...template.adaptableFormatIds].some(
        (formatId) => !isCarouselContentFormatId(formatId),
      )
    ) {
      throw new Error(`Carousel hook template ${template.id} has invalid compatibility.`);
    }
    if (
      template.preferredFormatIds.some((formatId) =>
        template.adaptableFormatIds.includes(formatId),
      )
    ) {
      throw new Error(`Carousel hook template ${template.id} repeats a format mapping.`);
    }
    for (const formatId of [
      ...template.preferredFormatIds,
      ...template.adaptableFormatIds,
    ]) {
      const format = getCarouselContentFormat(formatId);
      if (
        !template.compatibleHookFamilies.some((hookFamilyId) =>
          format.compatibleHookFamilies.includes(hookFamilyId),
        )
      ) {
        throw new Error(
          `Carousel hook template ${template.id} cannot pair with ${formatId}.`,
        );
      }
    }
  }

  if (new Set(CAROUSEL_HOOK_TEMPLATES.map((template) => template.id)).size !== 20) {
    throw new Error("Carousel hook template catalog contains duplicate ids.");
  }

  // A valid Structure 1 format is intentionally allowed to have no template
  // candidate. Runtime resolution then keeps the format's native cover hook.
  void CAROUSEL_CONTENT_FORMAT_IDS;
}
