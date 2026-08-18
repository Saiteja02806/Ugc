import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  buildCarouselBusinessContentContext,
  resolveCarouselBusinessContentOption,
  type CarouselBusinessContentContext,
} from "./carousel-business-content-context.js";
import {
  getCarouselStructure2Format,
  isCarouselStructure2FormatId,
  resolveCarouselStructure2FormatId,
  type CarouselStructure2FormatDefinition,
  type CarouselStructure2FormatId,
  type CarouselStructure2StoryRole,
} from "./carousel-structure-2-formats.js";

export const CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION =
  "carousel-structure-2-story-plan-v1";
export const CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT = 10;

const MAX_ANGLE_LENGTH = 180;
const MAX_STRATEGY_TEXT_LENGTH = 220;
const MAX_STORY_TEXT_LENGTH = 260;
const MAX_CTA_TEXT_LENGTH = 180;
const MAX_VISUAL_CONTEXT_LENGTH = 180;

const FIRST_PERSON_PATTERN =
  /\b(?:i|i'm|i’m|i'd|i’d|i've|i’ve|me|my|mine)\b/i;
const SECOND_PERSON_PATTERN =
  /\b(?:you|you're|you’re|you've|you’ve|your|yours)\b/i;
const PRODUCT_REFERENCE_PATTERN =
  /\b(?:(?:this|the|our|my new)\s+(?:app|application|platform|product|software|tool)|(?:app|application|platform|product|software|tool)\s+(?:called|named))\b/i;
const BEHAVIOR_PATTERN =
  /\b(?:add(?:ed|ing)?|ask(?:ed|ing)?|avoid(?:ed|ing)?|blam(?:ed|ing)|build|built|chang(?:ed|ing)|check(?:ed|ing)?|chose|choosing|click(?:ed|ing)?|clos(?:ed|ing)|compar(?:ed|ing)|decid(?:ed|ing)|delay(?:ed|ing)?|forgot|forgetting|kept|keep|log(?:ged|ging)?|look(?:ed|ing)?|map(?:ped|ping)?|mov(?:ed|ing)|open(?:ed|ing)?|order(?:ed|ing)?|plan(?:ned|ning)?|prioritiz(?:ed|ing)|react(?:ed|ing)|rearrang(?:e|ed|ing)|rebuild|rebuilt|recheck(?:ed|ing)?|refresh(?:ed|ing)?|repeat(?:ed|ing)?|replan(?:ned|ning)?|restart(?:ed|ing)?|rewr(?:ite|ote|iting)|schedul(?:e|ed|ing)|skip(?:ped|ping)?|sort(?:ed|ing)?|spend|spent|start(?:ed|ing)?|stop(?:ped|ping)?|switch(?:ed|ing)?|track(?:ed|ing)?|train(?:ed|ing)?|work(?:ed|ing)?|writ(?:e|ing)|wrote)\b/i;
const PRODUCT_ACTION_PATTERN =
  /\b(?:adapted|applied|asked|built|calculated|checked|connected|created|flagged|gave|generated|grouped|helped|kept|logged|mapped|organized|picked|planned|prioritized|recommended|reminded|showed|sorted|suggested|tracked|used)\b/i;
const EXPERIMENT_CTA_PATTERN =
  /\b(?:add|ask|enter|give|load|log|map|put|show|test|try|use)\b[\s\S]*\b(?:check|find|get|notice|pick|plan|prioritize|see|show|suggest|try)\b/i;
const CORPORATE_LANGUAGE_PATTERN =
  /\b(?:boost productivity|effortlessly|enhance(?:d)? efficiency|game[- ]changing|life[- ]changing|next level|revolutionary|seamless(?:ly)?|streamline(?:d|s)? (?:the |your )?workflow|transform(?:ed|s)? your|unlock efficiency|work smarter)\b/i;
const EXAGGERATED_CLAIM_PATTERN =
  /\b(?:always works|completely transformed|doubled|guaranteed|instantly fixed|never fail|tripled|zero effort)\b/i;

export type CarouselStructure2ProductVisualEligibility =
  | "allowed"
  | "forbidden"
  | "preferred";

export type CarouselStructure2StorySlide = {
  ctaText: string | null;
  productVisualEligibility: CarouselStructure2ProductVisualEligibility;
  slideNumber: number;
  storyRole: CarouselStructure2StoryRole;
  storyText: string;
  visualContext: string;
};

export type CarouselStructure2StoryStrategy = {
  angle: string;
  audience: string;
  audienceId: string;
  centralProblem: string;
  ctaAngle: string;
  customerGoal: string;
  customerGoalId: string;
  problem: string;
  problemId: string;
  productMechanism: string;
  reframe: string;
  storyFormatId: CarouselStructure2FormatId;
  topic: string;
  topicId: string;
  visibleBehavior: string;
};

export type CarouselStructure2RecentHistoryInput = {
  centralProblem?: string | null;
  ctaAngle?: string | null;
  hookIdea?: string | null;
  productMechanism?: string | null;
  storyAngle?: string | null;
  storyFormatId?: string | null;
  summary?: string | null;
};

export type CarouselStructure2StoryHistorySummary = {
  centralProblem: string;
  ctaAngle: string;
  hookIdea: string;
  productMechanism: string;
  storyAngle: string;
  storyFormatId: CarouselStructure2FormatId;
  summary: string;
};

export type CarouselStructure2StoryPlan = {
  historySummary: CarouselStructure2StoryHistorySummary;
  schemaVersion: string;
  slides: CarouselStructure2StorySlide[];
  strategy: CarouselStructure2StoryStrategy;
};

export type CarouselStructure2StoryValidationIssue = {
  code:
    | "copy_repetition"
    | "cta_mismatch"
    | "generic_copy"
    | "invalid_plan"
    | "perspective"
    | "product_timing"
    | "recent_repetition"
    | "story_backbone"
    | "story_coherence"
    | "unsupported_claim"
    | "word_count";
  message: string;
  slideNumber: number | null;
};

export type CarouselStructure2StoryBusinessContext =
  CarouselBusinessContentContext & {
    productMechanisms: string[];
  };

export type CarouselStructure2StoryAssignment = {
  candidateIndex: number;
  slotIndex: number;
  storyFormatId: CarouselStructure2FormatId;
};

export function buildCarouselStructure2StoryBusinessContext(
  analysis: WebsiteBusinessAnalysis,
): CarouselStructure2StoryBusinessContext {
  const base = buildCarouselBusinessContentContext(analysis);
  const productMechanisms = uniqueCleanStrings(
    [
      ...(analysis.differentiators ?? []),
      ...(analysis.valueProps ?? []),
      analysis.productSummary,
      analysis.mainPromise,
    ],
    12,
  );

  if (productMechanisms.length === 0) {
    productMechanisms.push(base.brand.productSummary);
  }

  return { ...base, productMechanisms };
}

export function parseCarouselStructure2StoryPlan(
  value: unknown,
  params: {
    analysis: WebsiteBusinessAnalysis;
    storyFormatId: CarouselStructure2FormatId;
  },
): CarouselStructure2StoryPlan {
  const format = getCarouselStructure2Format(params.storyFormatId);
  const businessContext = buildCarouselStructure2StoryBusinessContext(
    params.analysis,
  );
  const record = asRecord(value, "Carousel Structure 2 story plan");
  const strategyRecord = asRecord(record.strategy, "Structure 2 story strategy");
  const returnedFormatId = getRequiredString(
    strategyRecord.storyFormatId,
    "Structure 2 story format id",
    80,
  );

  if (returnedFormatId !== format.id) {
    throw new Error(
      `Structure 2 story format must remain ${format.id}; received ${returnedFormatId}.`,
    );
  }

  const audienceId = getRequiredString(
    strategyRecord.audienceId,
    "Structure 2 audience id",
    100,
  );
  const problemId = getRequiredString(
    strategyRecord.problemId,
    "Structure 2 problem id",
    100,
  );
  const customerGoalId = getRequiredString(
    strategyRecord.customerGoalId,
    "Structure 2 customer goal id",
    100,
  );
  const topicId = getRequiredString(
    strategyRecord.topicId,
    "Structure 2 topic id",
    100,
  );
  const audience = resolveCarouselBusinessContentOption(
    businessContext.audiences,
    audienceId,
    "audience",
  );
  const problem = resolveCarouselBusinessContentOption(
    businessContext.problems,
    problemId,
    "problem",
  );
  const customerGoal = resolveCarouselBusinessContentOption(
    businessContext.customerGoals,
    customerGoalId,
    "customer goal",
  );
  const topic = resolveCarouselBusinessContentOption(
    businessContext.topics,
    topicId,
    "topic",
  );
  const productMechanism = getRequiredString(
    strategyRecord.productMechanism,
    "Structure 2 product mechanism",
    MAX_STRATEGY_TEXT_LENGTH,
  );

  if (!businessContext.productMechanisms.includes(productMechanism)) {
    throw new Error(
      "Structure 2 selected a product mechanism that is not saved business evidence.",
    );
  }

  const strategy: CarouselStructure2StoryStrategy = {
    angle: getRequiredString(
      strategyRecord.angle,
      "Structure 2 story angle",
      MAX_ANGLE_LENGTH,
    ),
    audience: audience.label,
    audienceId,
    centralProblem: getRequiredString(
      strategyRecord.centralProblem,
      "Structure 2 central problem",
      MAX_STRATEGY_TEXT_LENGTH,
    ),
    ctaAngle: getRequiredString(
      strategyRecord.ctaAngle,
      "Structure 2 CTA angle",
      MAX_STRATEGY_TEXT_LENGTH,
    ),
    customerGoal: customerGoal.label,
    customerGoalId,
    problem: problem.label,
    problemId,
    productMechanism,
    reframe: getRequiredString(
      strategyRecord.reframe,
      "Structure 2 reframe",
      MAX_STRATEGY_TEXT_LENGTH,
    ),
    storyFormatId: format.id,
    topic: topic.label,
    topicId,
    visibleBehavior: getRequiredString(
      strategyRecord.visibleBehavior,
      "Structure 2 visible behavior",
      MAX_STRATEGY_TEXT_LENGTH,
    ),
  };

  if (!Array.isArray(record.slides) || record.slides.length !== 5) {
    throw new Error("Structure 2 story plan must contain exactly five slides.");
  }

  const slides = record.slides.map((slideValue, index) =>
    parseStorySlide(slideValue, format, index),
  );

  return {
    historySummary: buildCarouselStructure2HistorySummary({ slides, strategy }),
    schemaVersion: CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION,
    slides,
    strategy,
  };
}

function parseStorySlide(
  value: unknown,
  format: CarouselStructure2FormatDefinition,
  index: number,
): CarouselStructure2StorySlide {
  const definition = format.slides[index]!;
  const label = `Structure 2 slide ${index + 1}`;
  const record = asRecord(value, label);
  const slideNumber = getInteger(record.slideNumber, `${label} number`, 1, 5);
  const storyRole = getRequiredString(
    record.storyRole,
    `${label} story role`,
    80,
  );
  const ctaText = getOptionalString(
    record.ctaText,
    `${label} CTA text`,
    MAX_CTA_TEXT_LENGTH,
  );

  if (slideNumber !== index + 1 || storyRole !== definition.storyRole) {
    throw new Error(
      `${label} must use role ${definition.storyRole} at position ${index + 1}.`,
    );
  }
  if (index < 4 && ctaText !== null) {
    throw new Error("Only Structure 2 slide 5 may include CTA text.");
  }
  if (index === 4 && ctaText === null) {
    throw new Error("Structure 2 slide 5 requires a native experiment CTA.");
  }

  return {
    ctaText,
    productVisualEligibility:
      index === 3 ? "preferred" : index === 4 ? "allowed" : "forbidden",
    slideNumber,
    storyRole: definition.storyRole,
    storyText: getRequiredString(
      record.storyText,
      `${label} story text`,
      MAX_STORY_TEXT_LENGTH,
    ),
    visualContext: getRequiredString(
      record.visualContext,
      `${label} visual context`,
      MAX_VISUAL_CONTEXT_LENGTH,
    ),
  };
}

export function validateCarouselStructure2StoryPlan(
  plan: CarouselStructure2StoryPlan,
  params: {
    analysis: WebsiteBusinessAnalysis;
    recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
  },
) {
  const issues: CarouselStructure2StoryValidationIssue[] = [];
  const format = getCarouselStructure2Format(plan.strategy.storyFormatId);
  const businessContext = buildCarouselStructure2StoryBusinessContext(
    params.analysis,
  );
  const businessName = businessContext.brand.businessName;
  const evidenceText = normalizeText(JSON.stringify(params.analysis));
  const claimsToAvoid = businessContext.brand.claimsToAvoid.map(normalizeText);

  if (plan.slides.length !== 5) {
    issues.push({
      code: "story_backbone",
      message: "Structure 2 requires exactly five story slides.",
      slideNumber: null,
    });
    return issues;
  }

  for (const [index, slide] of plan.slides.entries()) {
    const definition = format.slides[index]!;
    const combinedText = [slide.storyText, slide.ctaText]
      .filter((item): item is string => Boolean(item))
      .join(" ");
    const wordCount = countWords(combinedText);

    if (
      slide.slideNumber !== index + 1 ||
      slide.storyRole !== definition.storyRole
    ) {
      issues.push({
        code: "story_backbone",
        message: `Slide ${index + 1} must use ${definition.storyRole}.`,
        slideNumber: index + 1,
      });
    }

    if (
      wordCount < definition.minimumWords ||
      wordCount > definition.maximumWords
    ) {
      issues.push({
        code: "word_count",
        message: `Slide ${index + 1} must contain ${definition.minimumWords}-${definition.maximumWords} total words; received ${wordCount}.`,
        slideNumber: index + 1,
      });
    }

    if (!FIRST_PERSON_PATTERN.test(slide.storyText)) {
      issues.push({
        code: "perspective",
        message: "Structure 2 story copy must remain first person.",
        slideNumber: index + 1,
      });
    }

    if (index < 4 && SECOND_PERSON_PATTERN.test(slide.storyText)) {
      issues.push({
        code: "perspective",
        message: "Viewer-facing language is reserved for the final CTA.",
        slideNumber: index + 1,
      });
    }

    if (
      index < 3 &&
      (containsProductMention(slide.storyText, businessName) ||
        containsProductMention(slide.visualContext, businessName))
    ) {
      issues.push({
        code: "product_timing",
        message: "The product must not enter before Slide 4.",
        slideNumber: index + 1,
      });
    }

    if (
      index === 3 &&
      (!containsExactPhrase(slide.storyText, businessName) ||
        !PRODUCT_ACTION_PATTERN.test(slide.storyText))
    ) {
      issues.push({
        code: "product_timing",
        message:
          "Slide 4 must name the saved business and show one understandable product action.",
        slideNumber: 4,
      });
    }

    if (index === 1 && !BEHAVIOR_PATTERN.test(slide.storyText)) {
      issues.push({
        code: "story_coherence",
        message: "Slide 2 must show a concrete repeated behavior or action.",
        slideNumber: 2,
      });
    }

    if (CORPORATE_LANGUAGE_PATTERN.test(combinedText)) {
      issues.push({
        code: "generic_copy",
        message: "Structure 2 copy contains corporate or generic advertising language.",
        slideNumber: index + 1,
      });
    }

    if (
      EXAGGERATED_CLAIM_PATTERN.test(combinedText) ||
      containsUnsupportedNumber(combinedText, evidenceText) ||
      claimsToAvoid.some(
        (claim) => claim && normalizeText(combinedText).includes(claim),
      )
    ) {
      issues.push({
        code: "unsupported_claim",
        message: "Structure 2 copy contains an unsupported or prohibited claim.",
        slideNumber: index + 1,
      });
    }
  }

  const finalSlide = plan.slides[4]!;

  if (
    !finalSlide.ctaText ||
    !SECOND_PERSON_PATTERN.test(finalSlide.ctaText) ||
    !EXPERIMENT_CTA_PATTERN.test(finalSlide.ctaText)
  ) {
    issues.push({
      code: "cta_mismatch",
      message:
        "Slide 5 must invite the viewer to test the same product mechanism with their own situation or inputs.",
      slideNumber: 5,
    });
  } else if (
    getTokenOverlap(
      finalSlide.ctaText,
      [
        plan.strategy.centralProblem,
        plan.strategy.visibleBehavior,
        plan.slides[0]?.storyText ?? "",
        plan.slides[1]?.storyText ?? "",
      ].join(" "),
    ) === 0
  ) {
    issues.push({
      code: "cta_mismatch",
      message: "The final CTA must resolve or mirror the opening problem.",
      slideNumber: 5,
    });
  }

  for (let index = 0; index < plan.slides.length; index += 1) {
    for (let prior = 0; prior < index; prior += 1) {
      if (
        isMeaningfullySimilar(
          plan.slides[index]!.storyText,
          plan.slides[prior]!.storyText,
          0.72,
        )
      ) {
        issues.push({
          code: "copy_repetition",
          message: `Slide ${index + 1} repeats the meaning of Slide ${prior + 1}.`,
          slideNumber: index + 1,
        });
      }
    }
  }

  const normalizedHistory = normalizeCarouselStructure2RecentHistory(
    params.recentHistory,
  );

  for (const previous of normalizedHistory) {
    const hookRepeated = isMeaningfullySimilar(
      plan.historySummary.hookIdea,
      previous.hookIdea ?? "",
      0.72,
    );
    const problemAndAngleRepeated =
      isMeaningfullySimilar(
        plan.strategy.centralProblem,
        previous.centralProblem ?? "",
        0.78,
      ) &&
      isMeaningfullySimilar(
        plan.strategy.angle,
        previous.storyAngle ?? "",
        0.68,
      );
    const summaryRepeated = isMeaningfullySimilar(
      plan.historySummary.summary,
      previous.summary ?? "",
      0.7,
    );

    if (hookRepeated || problemAndAngleRepeated || summaryRepeated) {
      issues.push({
        code: "recent_repetition",
        message:
          "The hook, central problem, or story angle repeats recent Structure 2 history.",
        slideNumber: hookRepeated ? 1 : null,
      });
      break;
    }
  }

  return dedupeCarouselStructure2ValidationIssues(issues);
}

export function buildCarouselStructure2StoryPlanSchema(params: {
  analysis: WebsiteBusinessAnalysis;
  storyFormatId: CarouselStructure2FormatId;
}) {
  const format = getCarouselStructure2Format(params.storyFormatId);
  const businessContext = buildCarouselStructure2StoryBusinessContext(
    params.analysis,
  );
  const optionIds = (values: readonly { id: string }[]) =>
    values.map((item) => item.id);

  return {
    additionalProperties: false,
    properties: {
      slides: {
        items: {
          anyOf: format.slides.map((slide, index) => ({
            additionalProperties: false,
            properties: {
              ctaText:
                index === 4
                  ? {
                      maxLength: MAX_CTA_TEXT_LENGTH,
                      minLength: 1,
                      type: "string",
                    }
                  : { type: "null" },
              slideNumber: { enum: [index + 1], type: "integer" },
              storyRole: { enum: [slide.storyRole], type: "string" },
              storyText: {
                maxLength: MAX_STORY_TEXT_LENGTH,
                minLength: 1,
                type: "string",
              },
              visualContext: {
                maxLength: MAX_VISUAL_CONTEXT_LENGTH,
                minLength: 1,
                type: "string",
              },
            },
            required: [
              "ctaText",
              "slideNumber",
              "storyRole",
              "storyText",
              "visualContext",
            ],
            type: "object",
          })),
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
      strategy: {
        additionalProperties: false,
        properties: {
          angle: {
            maxLength: MAX_ANGLE_LENGTH,
            minLength: 1,
            type: "string",
          },
          audienceId: {
            enum: optionIds(businessContext.audiences),
            type: "string",
          },
          centralProblem: {
            maxLength: MAX_STRATEGY_TEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
          ctaAngle: {
            maxLength: MAX_STRATEGY_TEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
          customerGoalId: {
            enum: optionIds(businessContext.customerGoals),
            type: "string",
          },
          problemId: {
            enum: optionIds(businessContext.problems),
            type: "string",
          },
          productMechanism: {
            enum: businessContext.productMechanisms,
            type: "string",
          },
          reframe: {
            maxLength: MAX_STRATEGY_TEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
          storyFormatId: { enum: [format.id], type: "string" },
          topicId: {
            enum: optionIds(businessContext.topics),
            type: "string",
          },
          visibleBehavior: {
            maxLength: MAX_STRATEGY_TEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
        },
        required: [
          "angle",
          "audienceId",
          "centralProblem",
          "ctaAngle",
          "customerGoalId",
          "problemId",
          "productMechanism",
          "reframe",
          "storyFormatId",
          "topicId",
          "visibleBehavior",
        ],
        type: "object",
      },
    },
    required: ["slides", "strategy"],
    type: "object",
  } as const;
}

export function buildCarouselStructure2StoryBatchSchema(params: {
  analysis: WebsiteBusinessAnalysis;
  assignments: readonly CarouselStructure2StoryAssignment[];
}) {
  assertCarouselStructure2StoryAssignments(params.assignments);

  return {
    additionalProperties: false,
    properties: {
      items: {
        items: {
          anyOf: params.assignments.map((assignment) => ({
            additionalProperties: false,
            properties: {
              plan: buildCarouselStructure2StoryPlanSchema({
                analysis: params.analysis,
                storyFormatId: assignment.storyFormatId,
              }),
              slotIndex: { enum: [assignment.slotIndex], type: "integer" },
            },
            required: ["plan", "slotIndex"],
            type: "object",
          })),
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
    },
    required: ["items"],
    type: "object",
  } as const;
}

export function buildCarouselStructure2BatchMessages(params: {
  analysis: WebsiteBusinessAnalysis;
  assignments: readonly CarouselStructure2StoryAssignment[];
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
}) {
  assertCarouselStructure2StoryAssignments(params.assignments);
  const businessContext = buildCarouselStructure2StoryBusinessContext(
    params.analysis,
  );
  const assignments = [...params.assignments]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((assignment) => ({
      candidateIndex: assignment.candidateIndex,
      format: getCarouselStructure2Format(assignment.storyFormatId),
      slotIndex: assignment.slotIndex,
    }));

  return [
    {
      role: "system" as const,
      content:
        "You write native first-person Instagram story carousels for Carousel Structure 2. This is not the informational Structure 1 writer. The backend already selected each of the eight Structure 2 story formats; never change, replace, or borrow a Structure 1 format. Produce exactly five independent carousels with exactly five slides each and return only the requested JSON.",
    },
    {
      role: "user" as const,
      content: [
        "Write one complete Structure 2 story plan for every assigned slot.",
        "The locked backbone is Slide 1 recognition, Slide 2 failure scene, Slide 3 reframe, Slide 4 product turning point, and Slide 5 proof/reflection plus a native experiment CTA.",
        "Select exact audienceId, problemId, customerGoalId, topicId, and productMechanism values from the supplied saved business context.",
        "Keep the assigned storyFormatId exactly. Do not return not_applicable and do not borrow any Structure 1 format or hook family.",
        "Slides 1-4 must be first person. Only the Slide 5 CTA speaks to the viewer.",
        "Slides 1-3 must not introduce or name the business or its product. Generic lived context such as switching between several apps is allowed when it is part of the honest failure scene.",
        `Slide 4 must name the saved business exactly as ${JSON.stringify(businessContext.brand.businessName)}, show one understandable product action supported by productMechanism, and state the immediate lived behavior change.`,
        "Slide 5 must underclaim the result, reflect on what changed, and invite the viewer to test the same mechanism with their own situation or inputs.",
        "Write like someone remembering an ordinary mistake: lowercase conversational phrasing, contractions, mild vulnerability, concrete actions, and restrained outcomes.",
        "Translate every abstract benefit into visible behavior. Do not sound like a teacher, spokesperson, case study, feature list, or advertisement.",
        "Do not invent product capabilities, proof, customers, exact numbers, health outcomes, financial outcomes, or guaranteed performance. Respect claimsToAvoid.",
        "Avoid corporate language such as boost productivity, streamline your workflow, unlock efficiency, seamless, work smarter, revolutionary, or next level.",
        "Use casual authenticity markers sparingly. Do not force honestly, actually, or turns out into every slide.",
        "Use visualContext only to describe the lived scene or product moment. Do not select an asset, assign hook/human/static roles, or change the separate 1:2:2 image plan.",
        "Avoid the same central problem, behavior, reframe, hook, product mechanism, CTA angle, or story summary found in recent Structure 2 history when another saved option exists.",
        "Also keep all five stories in this response substantially different from one another.",
        "Saved Structure 2 business context:",
        JSON.stringify(businessContext),
        "Locked Structure 2 slot assignments:",
        JSON.stringify(assignments),
        "Recent compact Structure 2 history only:",
        JSON.stringify(
          normalizeCarouselStructure2RecentHistory(params.recentHistory),
        ),
        "Full normalized business analysis for evidence validation:",
        JSON.stringify(params.analysis),
      ].join("\n"),
    },
  ];
}

export function buildCarouselStructure2RepairMessages(params: {
  analysis: WebsiteBusinessAnalysis;
  assignment: CarouselStructure2StoryAssignment;
  issues: readonly CarouselStructure2StoryValidationIssue[];
  rawPlan: unknown;
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
}) {
  const businessContext = buildCarouselStructure2StoryBusinessContext(
    params.analysis,
  );
  const format = getCarouselStructure2Format(
    params.assignment.storyFormatId,
  );

  return [
    {
      role: "system" as const,
      content:
        "You repair one Carousel Structure 2 story plan. Preserve the selected Structure 2 format and exact five-role backbone. Never use Structure 1 formats, hook families, informational templates, or unsupported business claims. Return only the repaired plan JSON.",
    },
    {
      role: "user" as const,
      content: [
        `Repair slot ${params.assignment.slotIndex} using storyFormatId ${format.id}.`,
        "Rebuild the affected story rather than lightly paraphrasing invalid copy.",
        "Keep Slides 1-3 product-free, name the saved business on Slide 4, and keep viewer language inside the Slide 5 experiment CTA.",
        "Respect every configured role, word range, perspective, product timing rule, and CTA policy.",
        "Choose only exact IDs and productMechanism values from businessContext.",
        "If repetition failed, choose a different saved problem, topic, goal, behavior, reframe, or CTA angle and rewrite all five slides.",
        "Validation failures:",
        JSON.stringify(params.issues),
        "Saved businessContext:",
        JSON.stringify(businessContext),
        "Locked Structure 2 format:",
        JSON.stringify(format),
        "Recent compact Structure 2 history only:",
        JSON.stringify(
          normalizeCarouselStructure2RecentHistory(params.recentHistory),
        ),
        "Full normalized business analysis for evidence validation:",
        JSON.stringify(params.analysis),
        "Invalid original plan:",
        JSON.stringify(params.rawPlan),
      ].join("\n"),
    },
  ];
}

export function buildDeterministicCarouselStructure2StoryPlan(params: {
  analysis: WebsiteBusinessAnalysis;
  assignment: CarouselStructure2StoryAssignment;
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
}) {
  const format = getCarouselStructure2Format(params.assignment.storyFormatId);
  const context = buildCarouselStructure2StoryBusinessContext(params.analysis);
  const offset = Math.max(0, params.assignment.candidateIndex);
  const audience = context.audiences[offset % context.audiences.length]!;
  const problem = context.problems[offset % context.problems.length]!;
  const customerGoal =
    context.customerGoals[(offset + 1) % context.customerGoals.length]!;
  const topic = context.topics[(offset + 2) % context.topics.length]!;
  const productMechanism =
    context.productMechanisms[(offset + 3) % context.productMechanisms.length]!;
  const businessName = context.brand.businessName;
  const problemPhrase = compactPhrase(
    removeExactPhrase(problem.label, businessName),
    5,
    "the same daily problem",
  );
  const goalPhrase = compactPhrase(
    removeExactPhrase(customerGoal.label, businessName),
    5,
    "steady progress",
  );
  const topicPhrase = compactPhrase(
    removeExactPhrase(topic.label, businessName),
    4,
    "my routine",
  );
  const mechanismPhrase = compactPhrase(
    productMechanism,
    6,
    "one clearer next step",
  );
  const visibleBehavior =
    `i kept reacting to ${problemPhrase}, changing the plan whenever it felt urgent, then losing track of what i had already decided.`;
  const reframe = getDeterministicReframe(
    format.id,
    problemPhrase,
    topicPhrase,
  );
  const opening = getDeterministicOpening(
    format.id,
    problemPhrase,
    goalPhrase,
    topicPhrase,
  );
  const failure = getDeterministicFailure(format.id, problemPhrase, topicPhrase);
  const productTurn =
    `then i tried ${businessName}; it ${getMechanismVerb(productMechanism)} ${mechanismPhrase} and gave me one clearer next step before i changed the plan again.`;
  const proof =
    `i'm still testing it, but ${goalPhrase} feels less dependent on perfect days.`;
  const cta =
    `if your ${problemPhrase} feels familiar, try ${businessName} and see what changes first.`;
  const strategy: CarouselStructure2StoryStrategy = {
    angle: `${format.name}: ${problem.label}`.slice(0, MAX_ANGLE_LENGTH),
    audience: audience.label,
    audienceId: audience.id,
    centralProblem: problem.label,
    ctaAngle: `test ${businessName} against ${problemPhrase}`,
    customerGoal: customerGoal.label,
    customerGoalId: customerGoal.id,
    problem: problem.label,
    problemId: problem.id,
    productMechanism,
    reframe,
    storyFormatId: format.id,
    topic: topic.label,
    topicId: topic.id,
    visibleBehavior,
  };
  const rawPlan = {
    slides: [
      {
        ctaText: null,
        slideNumber: 1,
        storyRole: "recognition",
        storyText: opening,
        visualContext: `an ordinary ${topicPhrase} moment before the routine changes`,
      },
      {
        ctaText: null,
        slideNumber: 2,
        storyRole: "failure_scene",
        storyText: failure,
        visualContext: `the repeated friction around ${problemPhrase} during a normal day`,
      },
      {
        ctaText: null,
        slideNumber: 3,
        storyRole: "reframe",
        storyText: reframe,
        visualContext: `a quieter reset that makes the mistaken assumption visible`,
      },
      {
        ctaText: null,
        slideNumber: 4,
        storyRole: "product_turning_point",
        storyText: productTurn,
        visualContext: `${businessName} supporting ${mechanismPhrase} at the decision moment`,
      },
      {
        ctaText: cta,
        slideNumber: 5,
        storyRole: "proof_reflection_cta",
        storyText: proof,
        visualContext: `the ordinary outcome after ${goalPhrase} becomes easier to repeat`,
      },
    ],
    strategy: {
      angle: strategy.angle,
      audienceId: strategy.audienceId,
      centralProblem: strategy.centralProblem,
      ctaAngle: strategy.ctaAngle,
      customerGoalId: strategy.customerGoalId,
      problemId: strategy.problemId,
      productMechanism: strategy.productMechanism,
      reframe: strategy.reframe,
      storyFormatId: strategy.storyFormatId,
      topicId: strategy.topicId,
      visibleBehavior: strategy.visibleBehavior,
    },
  };
  const plan = parseCarouselStructure2StoryPlan(rawPlan, {
    analysis: params.analysis,
    storyFormatId: params.assignment.storyFormatId,
  });
  const issues = validateCarouselStructure2StoryPlan(plan, {
    analysis: params.analysis,
    recentHistory: params.recentHistory,
  }).filter((issue) => issue.code !== "recent_repetition");

  if (issues.length > 0) {
    throw new Error(
      `Invalid deterministic Structure 2 fallback: ${formatValidationIssues(issues)}`,
    );
  }

  return plan;
}

function getDeterministicOpening(
  formatId: CarouselStructure2FormatId,
  problem: string,
  goal: string,
  topic: string,
) {
  switch (formatId) {
    case "wrong_belief":
      return `i thought ${problem} meant i simply needed to try harder`;
    case "perfect_plan_breaks":
      return `i kept building the perfect plan for ${topic}`;
    case "stopped_behavior":
      return `i stopped rechecking ${topic} whenever the day changed`;
    case "terrible_at":
      return `i was terrible at handling ${problem} consistently`;
    case "result_without_sacrifice":
      return `how i moved toward ${goal} without forcing a perfect routine`;
    case "identity_transformation":
      return `i stopped being the person who kept restarting ${topic}`;
    case "new_rule":
      return `i made one rule before changing ${topic} again`;
    case "wrong_villain":
      return `i kept blaming my routine for ${problem}`;
  }
}

function getDeterministicFailure(
  formatId: CarouselStructure2FormatId,
  problem: string,
  topic: string,
) {
  switch (formatId) {
    case "perfect_plan_breaks":
      return `every morning i mapped ${topic}, then one ordinary change brought ${problem} back and i rebuilt the whole plan before lunch.`;
    case "stopped_behavior":
      return `i used to recheck ${topic} whenever ${problem} appeared, and each refresh pulled me away from the decision i had already made.`;
    case "terrible_at":
      return `i kept changing my answer whenever ${problem} appeared, so even simple choices around ${topic} felt harder than they needed to.`;
    case "result_without_sacrifice":
      return `i kept adding more effort whenever ${problem} returned, then wondered why ${topic} still felt difficult to repeat on ordinary days.`;
    case "identity_transformation":
      return `i would restart ${topic} whenever ${problem} appeared, and that repeated reset made the old identity feel true every single week.`;
    case "new_rule":
      return `i used to rebuild ${topic} whenever ${problem} showed up, which meant one interruption could change every decision that followed.`;
    case "wrong_villain":
      return `i kept adjusting my routine because ${problem} looked like a scheduling issue, yet the same confusion returned after every new plan.`;
    default:
      return `i kept reacting to ${problem}, changing ${topic} whenever it felt urgent, then losing track of what i had already decided.`;
  }
}

function getDeterministicReframe(
  formatId: CarouselStructure2FormatId,
  problem: string,
  topic: string,
) {
  switch (formatId) {
    case "perfect_plan_breaks":
      return `i realized real life was not breaking my plan; the plan had no room for ${problem} when ordinary things changed.`;
    case "stopped_behavior":
      return `i replaced that habit with one rule: decide around ${problem} once, then keep moving until something genuinely changed.`;
    case "terrible_at":
      return `i realized i was not bad at ${topic}; i was making the same choice around ${problem} over and over.`;
    case "result_without_sacrifice":
      return `i realized extra effort was not the answer; a clearer way through ${problem} mattered more than forcing another perfect routine.`;
    case "identity_transformation":
      return `i realized that identity came from repeating one reaction to ${problem}, not from something permanent about me or ${topic}.`;
    case "new_rule":
      return `my rule became simple: when ${problem} appeared, i kept one priority instead of rebuilding everything around it again.`;
    case "wrong_villain":
      return `i realized my routine was not the real problem; repeating the same decision around ${problem} was what kept draining me.`;
    default:
      return `i realized effort was not the missing piece; the repeated decision around ${problem} was what kept slowing me down.`;
  }
}

function getMechanismVerb(value: string) {
  const normalized = normalizeText(value);

  if (/\b(?:show|display|surface|visibility)\b/.test(normalized)) return "showed me";
  if (/\b(?:recommend|suggest)\b/.test(normalized)) return "suggested";
  if (/\b(?:plan|schedule|organize)\b/.test(normalized)) return "organized";
  if (/\b(?:track|log|monitor)\b/.test(normalized)) return "tracked";
  if (/\b(?:priorit|rank|sort)\b/.test(normalized)) return "prioritized";

  return "used";
}

export function normalizeCarouselStructure2RecentHistory(
  history: readonly CarouselStructure2RecentHistoryInput[] | undefined,
) {
  return (history ?? [])
    .slice(0, CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT)
    .map((item) => ({
      centralProblem: cleanOptionalHistoryText(item.centralProblem),
      ctaAngle: cleanOptionalHistoryText(item.ctaAngle),
      hookIdea: cleanOptionalHistoryText(item.hookIdea),
      productMechanism: cleanOptionalHistoryText(item.productMechanism),
      storyAngle: cleanOptionalHistoryText(item.storyAngle),
      storyFormatId: resolveCarouselStructure2FormatId(item.storyFormatId),
      summary: cleanOptionalHistoryText(item.summary, 360),
    }));
}

export function assertCarouselStructure2StoryAssignments(
  assignments: readonly CarouselStructure2StoryAssignment[],
) {
  const slots = assignments.map((assignment) => assignment.slotIndex);

  if (
    assignments.length !== 5 ||
    new Set(slots).size !== 5 ||
    slots.some((slot) => !Number.isInteger(slot) || slot < 0 || slot > 4) ||
    assignments.some(
      (assignment) =>
        !isCarouselStructure2FormatId(assignment.storyFormatId) ||
        !Number.isSafeInteger(assignment.candidateIndex) ||
        assignment.candidateIndex < 0,
    )
  ) {
    throw new Error(
      "A Structure 2 story batch requires exactly five valid assignments for slots 0 through 4.",
    );
  }
}

export function createCarouselStructure2InvalidPlanIssue(
  error: unknown,
): CarouselStructure2StoryValidationIssue {
  return {
    code: "invalid_plan",
    message: getErrorMessage(error).slice(0, 500),
    slideNumber: null,
  };
}

export function dedupeCarouselStructure2ValidationIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.slideNumber ?? "plan"}:${issue.code}:${issue.message}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatCarouselStructure2ValidationIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  return formatValidationIssues(issues);
}

function buildCarouselStructure2HistorySummary(params: {
  slides: readonly CarouselStructure2StorySlide[];
  strategy: CarouselStructure2StoryStrategy;
}): CarouselStructure2StoryHistorySummary {
  const summary = [
    params.strategy.visibleBehavior,
    params.strategy.reframe,
    `The product mechanism was ${params.strategy.productMechanism}.`,
  ]
    .join(" ")
    .slice(0, 360);

  return {
    centralProblem: params.strategy.centralProblem,
    ctaAngle: params.strategy.ctaAngle,
    hookIdea: params.slides[0]?.storyText ?? params.strategy.angle,
    productMechanism: params.strategy.productMechanism,
    storyAngle: params.strategy.angle,
    storyFormatId: params.strategy.storyFormatId,
    summary,
  };
}

function containsProductMention(value: string, businessName: string) {
  return (
    containsExactPhrase(value, businessName) ||
    PRODUCT_REFERENCE_PATTERN.test(value)
  );
}

function containsExactPhrase(value: string, phrase: string) {
  const normalizedPhrase = normalizeText(phrase);

  return Boolean(
    normalizedPhrase && normalizeText(value).includes(normalizedPhrase),
  );
}

function containsUnsupportedNumber(value: string, evidenceText: string) {
  const numbers = value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];

  return numbers.some((number) => !evidenceText.includes(normalizeText(number)));
}

function getTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(getMeaningfulTokens(left));
  const rightTokens = new Set(getMeaningfulTokens(right));
  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap;
}

function isMeaningfullySimilar(
  left: string,
  right: string,
  threshold: number,
) {
  const leftTokens = new Set(getMeaningfulTokens(left));
  const rightTokens = new Set(getMeaningfulTokens(right));

  if (leftTokens.size < 2 || rightTokens.size < 2) return false;

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 && intersection / union >= threshold;
}

function getMeaningfulTokens(value: string) {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "and",
    "around",
    "before",
    "but",
    "could",
    "every",
    "felt",
    "for",
    "from",
    "had",
    "have",
    "into",
    "just",
    "kept",
    "more",
    "needed",
    "one",
    "really",
    "same",
    "still",
    "than",
    "that",
    "the",
    "then",
    "this",
    "was",
    "what",
    "when",
    "with",
    "would",
    "your",
  ]);

  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function compactPhrase(value: string, maximumWords: number, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const words = cleaned.split(" ").filter(Boolean).slice(0, maximumWords);
  const compact = words.join(" ").replace(
    /\s+(?:a|an|and|for|from|in|of|or|the|to|with)$/i,
    "",
  );

  return compact || fallback;
}

function removeExactPhrase(value: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return escaped
    ? value.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ")
    : value;
}

function uniqueCleanStrings(
  values: readonly (string | null | undefined)[],
  maximum: number,
) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 220);
    const key = normalizeText(cleaned);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);

    if (result.length === maximum) break;
  }

  return result;
}

function cleanOptionalHistoryText(value: unknown, maximum = 220) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maximum)
    : null;
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9%\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function getRequiredString(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  const cleaned = value.trim().replace(/\s+/g, " ");

  if (cleaned.length > maximum) {
    throw new Error(`${label} must not exceed ${maximum} characters.`);
  }

  return cleaned;
}

function getOptionalString(value: unknown, label: string, maximum: number) {
  if (value === null) return null;
  return getRequiredString(value, label, maximum);
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

function formatValidationIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  return issues
    .map((issue) =>
      issue.slideNumber
        ? `Slide ${issue.slideNumber}: ${issue.message}`
        : issue.message,
    )
    .join(" ");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
