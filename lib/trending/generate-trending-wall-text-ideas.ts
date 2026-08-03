import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import { validateWallTextRenderFit } from "@/lib/trending/wall-text-render-validation";
import {
  buildWallTextBusinessContext,
  getWallTextMaximumWords,
  getWallTextPatternForCandidate,
  normalizeWallTextGenerationCandidates,
  validateWallTextContent,
  validateGeneratedWallTextIdeas,
  MAX_WALL_TEXT_RENDERED_LINES,
  MIN_WALL_TEXT_RENDERED_LINES,
  MIN_WALL_TEXT_WORDS,
  WALL_TEXT_PREFERRED_MAX_WORDS,
  WALL_TEXT_PREFERRED_MIN_WORDS,
  type GeneratedWallTextIdea,
  type WallTextGenerationCandidate,
} from "@/lib/trending/wall-text-text-logic";
import type { WallTextPattern } from "@/lib/trending/wall-text-types";

const DEFAULT_MODEL = "gpt-5-mini";
const MAX_WALL_TEXT_IDEA_COUNT = 6;
const MAX_WALL_TEXT_GENERATION_ATTEMPTS = 4;
const MAX_WALL_TEXT_REVIEW_ATTEMPTS = 3;
const READING_WORDS_PER_SECOND = 4.3;

const WALL_TEXT_PATTERN_GUIDANCE: Record<WallTextPattern, string> = {
  action_benefit:
    "Neutral action phrased as a gerund (never an instruction) → what it removes → one directly supported benefit",
  before_after: "Before problem → after one change → new result",
  belief_reframe:
    "Common belief stated as a complete sentence → explicit reframe using not, but, or instead → neutral takeaway, never a command",
  mistake_correction:
    "Mistaken belief stated clearly → explicit correction using not, but, or instead → one supported better understanding",
  problem_change_result: "Problem → one change or product action → result",
  situation_discovery: "Specific situation → discovery → short lesson",
};

const WallTextSegmentSchema = z
  .object({
    lines: z.array(z.string().trim().min(2).max(80)).min(1).max(4),
    role: z.enum(["lead", "support", "closing"]),
  })
  .strict();

const WallTextIdeaOutputSchema = z
  .object({
    ideas: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0),
            fullText: z.string().trim().min(12).max(300),
            pattern: z.enum([
              "problem_change_result",
              "mistake_correction",
              "situation_discovery",
              "before_after",
              "belief_reframe",
              "action_benefit",
            ]),
            segments: z.array(WallTextSegmentSchema).min(2).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_WALL_TEXT_IDEA_COUNT),
  })
  .strict();

const WallTextReviewSchema = z
  .object({
    reviews: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0),
            feedback: z.string().trim().max(300),
            genericMarketingLanguage: z.boolean(),
            hasCallToAction: z.boolean(),
            matchesAssignedPattern: z.boolean(),
            maximumOneProductFeature: z.boolean(),
            naturalSpokenLanguage: z.boolean(),
            oneCentralIdea: z.boolean(),
            openingAndPayoffMatch: z.boolean(),
            readableWithinClip: z.boolean(),
            semanticLineBreaks: z.boolean(),
            unsupportedCapabilityOrOutcome: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_WALL_TEXT_IDEA_COUNT),
  })
  .strict();

let openaiClient: OpenAI | null = null;

export function getTrendingWallTextModelName() {
  return process.env.OPENAI_WALL_TEXT_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateBusinessTrendingWallTextIdeas(params: {
  business: WebsiteBusinessAnalysis;
  candidates: WallTextGenerationCandidate[];
}) {
  const candidates = normalizeWallTextGenerationCandidates(params.candidates);
  const generated = await Promise.all(
    candidates.map((candidate) =>
      generateWallTextCandidateWithRepair({
        business: params.business,
        candidate,
      }),
    ),
  );

  return generated.sort(
    (left, right) => left.candidateIndex - right.candidateIndex,
  );
}

async function generateWallTextCandidateWithRepair(params: {
  business: WebsiteBusinessAnalysis;
  candidate: WallTextGenerationCandidate;
}) {
  let validationFailure: string | null = null;

  for (
    let attempt = 1;
    attempt <= MAX_WALL_TEXT_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const generated = await generateBusinessTrendingWallTextIdeasAttempt(
        {
          business: params.business,
          candidates: [params.candidate],
        },
        validationFailure,
      );

      return generated[0]!;
    } catch (error) {
      validationFailure =
        error instanceof Error
          ? error.message.slice(0, 1_000)
          : "The previous Wall-of-text draft was invalid.";
    }
  }

  throw new Error(
    `Wall-of-text idea ${params.candidate.candidateIndex + 1} could not pass generation and review after ${MAX_WALL_TEXT_GENERATION_ATTEMPTS} attempts: ${validationFailure ?? "unknown validation failure"}`,
  );
}

async function generateBusinessTrendingWallTextIdeasAttempt(
  params: {
    business: WebsiteBusinessAnalysis;
    candidates: WallTextGenerationCandidate[];
  },
  validationFailure: string | null,
) {
  const candidates = normalizeWallTextGenerationCandidates(params.candidates);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OpenAI is not configured.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  const businessProfile = buildWallTextBusinessContext(params.business);
  const model = getTrendingWallTextModelName();
  const completion = await openaiClient.chat.completions.parse({
    model,
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: [
          "Write one compact Wall-of-Text message for each six-second vertical social video.",
          "Wall-of-Text is not Hook copy and must never use a two-line Hook rule.",
          "Write exactly one distinct idea for every supplied candidate.",
          `Target ${WALL_TEXT_PREFERRED_MIN_WORDS}–${WALL_TEXT_PREFERRED_MAX_WORDS} words. Allow ${MIN_WALL_TEXT_WORDS}–${getWallTextMaximumWords()} words and never exceed ${getWallTextMaximumWords()}.`,
          `The validator supports ${MIN_WALL_TEXT_RENDERED_LINES}–${MAX_WALL_TEXT_RENDERED_LINES} short lines, but this generator must return exactly six lines.`,
          "Distribute those six lines as either two semantic segments with three lines each or three semantic segments with two lines each.",
          "Prefer two to five words per line. Six words are allowed only when a natural phrase cannot be split cleanly.",
          "Write two or three short grammatical sentences. Use sentence punctuation; do not return one unpunctuated run-on block.",
          "Every sentence needs an explicit grammatical subject and a finite verb. Reject bare gerund fragments such as 'Thinking one plan fits', comma-linked noun fragments such as 'Clear context, simpler logging', and subject-verb disagreement.",
          "Keep adjective comparisons logically attached to the right noun. Rules may be rigid, guidance may be flexible, and context or choices may be relevant; never describe choices as rigid.",
          "Use precise objects and references. Say 'logging meals' or 'typing meal details', never 'typing meals'. Say what is maintained instead of ending with the vague phrase 'maintain it'.",
          "For guidance, use either 'connects choices to goals' or 'adds context to choices'. Never blend them into 'gives choices context to goals'.",
          "Communicate one idea, one turn, and one matching payoff. The viewer must understand it before the clip loops.",
          "Use 2–3 semantic segments with no more than two small visual gaps.",
          "The semantic roles are storage metadata only. Never print labels such as headline, body, support, closing, hook, problem, or result.",
          "Return lead, optional support, and closing segments in that order.",
          "Write the complete message first, then break it into natural spoken phrases. Do not break by character count.",
          "Keep every visual line compact enough for a 620px-wide Inter Bold text block. A line can still be too wide even when it has only five words.",
          "Do not split a describing word from its noun. Do not leave conjunctions, articles, or prepositions at the end of a non-final line.",
          "Keep the payoff in the final one or two lines. The payoff must answer the opening.",
          "Use at most one product feature and at most one natural product-name mention.",
          "Each candidate has one requiredFocus. If it is present, that is the only product capability the copy may mention. Do not combine it with another value prop, service, expert feature, privacy feature, or progress feature.",
          "Each candidate also has a requiredFocusGuard. Treat it as a hard evidence boundary, not optional style advice.",
          "The forbiddenWords list is a hard lexical ban. Do not output those words, close grammatical variants, or substitute a different time unit.",
          "Do not include any call to action, slogan, promotional closing, or instruction to buy, download, join, start, or try.",
          "Never begin with an imperative verb or tell the viewer what to do. In the action_benefit pattern, describe the action neutrally with a gerund or noun phrase.",
          "For action_benefit, begin with a normal viewer action used as the grammatical subject, such as 'Reviewing progress insights'. Never use a compressed -ing slogan such as 'Ending guesswork'.",
          "Do not invent or list interface components such as charts, bars, graphs, dashboards, scores, reports, comparisons, or timelines unless the Business Profile explicitly names them.",
          "Reject generic AI marketing language such as unlock, transform, seamless, game-changing, supercharge, or get started.",
          "Reject awkward filler, repeated meanings, feature lists, and advertisement language.",
          "Do not use section labels such as Before:, After:, Problem:, Result:, or Benefit:.",
          "Avoid promotional phrases such as take control, reclaim time, log smarter, track confidently, fixes blind spots, or similar ad copy.",
          "Do not invent automatic recognition, one-tap behavior, exact accuracy, time savings measured in seconds/minutes/hours/weeks, sharing behavior, or other implementation details unless that exact claim appears in the Business Profile.",
          "Use simple grammatical spoken phrases. Reject constructions such as 'felt guesswork', 'thinking one plan is common', and compressed slogans.",
          "Good rhythm example: 'Logging meals / takes too long // Save repeat meals / and reuse them // Less typing / more consistency.' Match this plain, compact feeling without copying its claims.",
          "Use only capabilities and outcomes supported by the supplied Business Profile. Respect claimsToAvoid.",
          "The full text remains visible for the clip's native duration. Keep it comfortable to read within durationSeconds.",
          "fullText must contain the exact same words and punctuation as the semantic lines joined in reading order.",
          "This is not Carousel copy, not a headline/body/CTA structure, and not a conventional advertisement.",
          validationFailure
            ? `The previous draft failed validation: ${validationFailure} ${getWallTextRepairInstruction(validationFailure)}`
            : "",
          "Return every supplied candidateIndex unchanged.",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          businessProfile,
          revisionFeedback: validationFailure,
          candidates: candidates.map((candidate) => {
            const requiredFocus = getWallTextCandidateFocus(
              businessProfile,
              candidate.candidateIndex,
            );

            return {
              candidateIndex: candidate.candidateIndex,
              durationSeconds: candidate.durationSeconds,
              requiredPattern: getWallTextPatternForCandidate(
                candidate.candidateIndex,
              ),
              requiredPatternStructure:
                WALL_TEXT_PATTERN_GUIDANCE[
                  getWallTextPatternForCandidate(candidate.candidateIndex)
                ],
              requiredFocus,
              requiredFocusGuard: getWallTextFocusGuard(requiredFocus),
              forbiddenWords: WALL_TEXT_FORBIDDEN_UNSUPPORTED_WORDS,
              maximumComfortableWords: Math.min(
                getWallTextMaximumWords(),
                Math.max(
                  MIN_WALL_TEXT_WORDS,
                  Math.floor(
                    (candidate.durationSeconds - 0.24) *
                      READING_WORDS_PER_SECOND,
                  ),
                ),
              ),
              maximumRenderedLines: MAX_WALL_TEXT_RENDERED_LINES,
              minimumRenderedLines: MIN_WALL_TEXT_RENDERED_LINES,
              preferredRenderedLines: 6,
            };
          }),
        }),
      },
    ],
    response_format: zodResponseFormat(
      WallTextIdeaOutputSchema,
      "trending_wall_text_ideas_v5",
    ),
  });
  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("The AI did not return Trending Wall-of-text ideas.");
  }

  const generated = validateGeneratedWallTextIdeas({
    candidates,
    generated: synchronizeWallTextFullText(
      WallTextIdeaOutputSchema.parse(parsed).ideas as GeneratedWallTextIdea[],
    ),
  });
  validateWallTextEvidenceSpecificity(generated, businessProfile);
  const renderValidation = await Promise.all(
    generated.map(async (idea) => {
      const candidate = candidates.find(
        (entry) => entry.candidateIndex === idea.candidateIndex,
      )!;
      const fitted = await fitWallTextContentForRender(
        idea.content,
        candidate.durationSeconds,
      );

      return {
        candidateIndex: idea.candidateIndex,
        content: fitted.content,
        render: fitted.render,
      };
    }),
  );
  const renderReadyGenerated = generated.map((idea) => {
    const renderEntry = renderValidation.find(
      (entry) => entry.candidateIndex === idea.candidateIndex,
    )!;

    return {
      ...idea,
      content: {
        ...renderEntry.content,
        renderFontSize: renderEntry.render.fontSize as 44 | 46 | 48 | 52,
      },
    };
  });

  let reviewFailure: string | null = null;

  for (
    let reviewAttempt = 1;
    reviewAttempt <= MAX_WALL_TEXT_REVIEW_ATTEMPTS;
    reviewAttempt += 1
  ) {
    try {
      const reviewCompletion = await openaiClient.chat.completions.parse({
        model,
        reasoning_effort: "low",
        messages: [
          {
            role: "system",
            content: [
              "Review already deterministically validated Wall-of-Text overlays.",
              "Do not rewrite them.",
              "Approve readableWithinClip only when a viewer can comfortably absorb the complete block during one native play.",
              "Reject generic marketing language, calls to action, multiple competing ideas, more than one product feature, and any capability or outcome not supported by the Business Profile.",
              "Reject awkward phrasing, feature lists, repeated meanings, an opening without a matching payoff, and line breaks that damage natural phrases.",
              "Reject any sentence without an explicit subject and finite verb, bare gerund fragments, comma-linked noun fragments, and subject-verb disagreement.",
              "Reject wrong verb objects such as 'typing meals', vague endings such as 'maintain it', and blended phrases such as 'gives choices context to goals'.",
              "Reject section labels, compressed slogans, awkward grammar, promotional imperatives, and unsupported implementation details or quantified time claims.",
              "A single direct, supported result of requiredFocus is its payoff, not a second product feature. For progress insights, easier visibility or understanding is the same central idea.",
              "In action_benefit, a neutral gerund such as 'Reviewing progress insights' is descriptive; an imperative such as 'See your progress' is a call to action and must be rejected.",
              "Phrases like take control, reclaim time, log smarter, track confidently, felt guesswork, or fixes blind spots are not natural Wall-of-Text copy.",
              "Confirm that each idea follows its assigned six-second pattern.",
              "Wall-of-Text is not Hook copy; do not apply a two-line Hook rule.",
              "Keep every boolean consistent with the written feedback. If the feedback says a check passes, its rejection boolean must not contradict that statement.",
              reviewFailure
                ? `The previous review was internally inconsistent or invalid: ${reviewFailure} Review the same deterministic content again.`
                : "",
              "Return one review for each candidateIndex.",
            ]
              .filter(Boolean)
              .join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              businessProfile,
              candidates: renderReadyGenerated.map((idea) => {
                const candidate = candidates.find(
                  (entry) => entry.candidateIndex === idea.candidateIndex,
                )!;
                const render = renderValidation.find(
                  (entry) => entry.candidateIndex === idea.candidateIndex,
                )!.render;

                return {
                  candidateIndex: idea.candidateIndex,
                  content: idea.content,
                  durationSeconds: candidate.durationSeconds,
                  deterministicRender: render,
                  requiredPattern: getWallTextPatternForCandidate(
                    idea.candidateIndex,
                  ),
                  requiredFocus: getWallTextCandidateFocus(
                    businessProfile,
                    idea.candidateIndex,
                  ),
                  requiredFocusGuard: getWallTextFocusGuard(
                    getWallTextCandidateFocus(
                      businessProfile,
                      idea.candidateIndex,
                    ),
                  ),
                };
              }),
              previousReviewFailure: reviewFailure,
            }),
          },
        ],
        response_format: zodResponseFormat(
          WallTextReviewSchema,
          "trending_wall_text_review_v5",
        ),
      });
      const review = reviewCompletion.choices[0]?.message.parsed;

      if (!review) {
        throw new Error(
          "The AI did not return a Wall-of-text readability review.",
        );
      }

      validateWallTextReviews(
        candidates.map((candidate) => candidate.candidateIndex),
        WallTextReviewSchema.parse(review).reviews,
      );

      return renderReadyGenerated;
    } catch (error) {
      if (error instanceof WallTextReviewRejectedError) {
        throw error;
      }

      reviewFailure =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "The previous Wall-of-text review was invalid.";
    }
  }

  throw new Error(
    `The AI reviewer could not return a consistent Wall-of-text decision after ${MAX_WALL_TEXT_REVIEW_ATTEMPTS} attempts: ${reviewFailure ?? "unknown review failure"}`,
  );
}

function validateWallTextReviews(
  candidateIndexes: readonly number[],
  reviews: z.infer<typeof WallTextReviewSchema>["reviews"],
) {
  const reviewByIndex = new Map(
    reviews.map((review) => [review.candidateIndex, review]),
  );

  for (const candidateIndex of candidateIndexes) {
    const review = reviewByIndex.get(candidateIndex);

    if (!review) {
      throw new Error("The AI readability review missed a Wall-of-text idea.");
    }

    if (
      !review.readableWithinClip ||
      !review.oneCentralIdea ||
      !review.matchesAssignedPattern ||
      !review.maximumOneProductFeature ||
      !review.naturalSpokenLanguage ||
      !review.openingAndPayoffMatch ||
      !review.semanticLineBreaks ||
      review.genericMarketingLanguage ||
      review.hasCallToAction ||
      review.unsupportedCapabilityOrOutcome
    ) {
      throw new WallTextReviewRejectedError(
        `Wall-of-text idea ${candidateIndex + 1} failed readability or evidence review: ${review.feedback || "revise the copy"} Flags: ${JSON.stringify({
          genericMarketingLanguage: review.genericMarketingLanguage,
          hasCallToAction: review.hasCallToAction,
          matchesAssignedPattern: review.matchesAssignedPattern,
          maximumOneProductFeature: review.maximumOneProductFeature,
          naturalSpokenLanguage: review.naturalSpokenLanguage,
          oneCentralIdea: review.oneCentralIdea,
          openingAndPayoffMatch: review.openingAndPayoffMatch,
          readableWithinClip: review.readableWithinClip,
          semanticLineBreaks: review.semanticLineBreaks,
          unsupportedCapabilityOrOutcome:
            review.unsupportedCapabilityOrOutcome,
        })}`,
      );
    }
  }

  if (reviewByIndex.size !== candidateIndexes.length) {
    throw new Error("The AI returned an invalid Wall-of-text review mapping.");
  }
}

function synchronizeWallTextFullText(
  ideas: readonly GeneratedWallTextIdea[],
): GeneratedWallTextIdea[] {
  return ideas.map((idea) => ({
    ...idea,
    fullText: idea.segments
      .flatMap((segment) => segment.lines)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim(),
  }));
}

function getWallTextRepairInstruction(validationFailure: string) {
  const normalizedFailure = validationFailure.toLowerCase();

  if (normalizedFailure.includes("assigned candidate format")) {
    return "Use the exact requiredPattern supplied for this candidate and follow its requiredPatternStructure in reading order.";
  }

  if (
    normalizedFailure.includes("matchesassignedpattern") ||
    normalizedFailure.includes("awkward grammar") ||
    normalizedFailure.includes("awkward grammatical") ||
    normalizedFailure.includes("naturalspoken")
  ) {
    return "Rewrite the whole draft in plain subject-and-verb sentences. Follow requiredPatternStructure exactly, keep only requiredFocus plus one direct supported payoff, and remove compressed noun stacks, slogans, and lists of product details.";
  }

  if (normalizedFailure.includes("seconds to read")) {
    return "Shorten the copy toward 16–19 words while preserving one opening, one turn, and one matching payoff.";
  }

  if (
    normalizedFailure.includes("two or three short grammatical sentences")
  ) {
    return "Rewrite as exactly two or three complete grammatical sentences. Mark each sentence with a period, question mark, or exclamation mark. Do not return fragments, a colon-led list, or one unpunctuated run-on block.";
  }

  if (normalizedFailure.includes("semantic lines")) {
    return "Return exactly six semantic lines: either two segments with three lines each or three segments with two lines each. Count all lines before returning.";
  }

  if (normalizedFailure.includes("does not fit")) {
    return "The quoted line is physically too wide in the real Inter renderer. Do not return that same line again. Split it at a natural phrase boundary when the result stays within seven total lines; otherwise replace it with shorter plain words. Never reduce the font or exceed seven lines.";
  }

  if (
    normalizedFailure.includes("line break") ||
    normalizedFailure.includes("orphan") ||
    normalizedFailure.includes("lines cannot exceed")
  ) {
    return "Rewrite the line breaks at natural phrase boundaries. Use two to five words per line where possible, never more than six, and do not end a non-final line with an article, conjunction, or preposition.";
  }

  if (
    normalizedFailure.includes("copy must contain") &&
    normalizedFailure.includes("words")
  ) {
    return "Rewrite to 18–21 words when possible and never leave the 16–24 word hard range.";
  }

  if (
    normalizedFailure.includes("maximumoneproductfeature") ||
    normalizedFailure.includes("more than one product") ||
    normalizedFailure.includes("multiple product")
  ) {
    return "Choose exactly one supported product action or feature. Remove every other feature, expert service, privacy claim, and secondary benefit. Keep one matching result for that single action.";
  }

  if (normalizedFailure.includes("unsupported specific claim")) {
    return "Remove the quoted unsupported mechanism, accuracy, sharing, or time claim. Use only the plain requiredFocus and one directly supported result from the Business Profile. If a time word failed, do not replace it with another duration, interval, frequency, or speed claim; express the benefit with no time unit at all.";
  }

  if (
    normalizedFailure.includes("hascalltoaction") ||
    normalizedFailure.includes("call to action")
  ) {
    return "Remove every command, invitation, and promotional closing. End with the natural result or reframe, not an instruction to the viewer.";
  }

  return "Correct that exact failure before returning the complete candidate set again.";
}

function getWallTextCandidateFocus(
  businessProfile: ReturnType<typeof buildWallTextBusinessContext>,
  candidateIndex: number,
) {
  const preferredCapabilities = businessProfile.valueProps.filter(
    (value, index, values) => value.trim() && values.indexOf(value) === index,
  );
  const focusedCapabilities =
    preferredCapabilities.length > 0
      ? preferredCapabilities
      : businessProfile.differentiators.filter(
          (value, index, values) =>
            value.trim() && values.indexOf(value) === index,
        );

  if (focusedCapabilities.length > 0) {
    return focusedCapabilities[
      Math.abs(Math.trunc(candidateIndex)) % focusedCapabilities.length
    ]!;
  }

  return (
    businessProfile.mainPromise ??
    businessProfile.productSummary ??
    businessProfile.mainProblem
  );
}

const WALL_TEXT_FORBIDDEN_UNSUPPORTED_WORDS = [
  "automatically",
  "auto-identifies",
  "one-tap",
  "precisely",
  "accurately",
  "exactly",
  "seconds",
  "minutes",
  "hours",
  "daily",
  "assuming",
  "ending",
  "finding",
  "weekly",
  "thinking",
  "shares data",
] as const;

function getWallTextFocusGuard(requiredFocus: string | null) {
  if (!requiredFocus) {
    return "Use one directly supported Business Profile idea only. Do not infer an implementation mechanism, quantified result, schedule, or guarantee.";
  }

  const normalizedFocus = requiredFocus.toLocaleLowerCase("en-US");

  if (/\b(?:progress|insight|pattern|trend)\w*\b/u.test(normalizedFocus)) {
    return "Describe only clearer visibility or understanding. The only allowed direct payoff is that progress or the bigger picture becomes easier to see or understand. Do not add habit change, easier food choices, behavior change, or another outcome. Do not mention a day, week, schedule, interval, frequency, speed, measured outcome, chart, bar, graph, dashboard, score, report, comparison, timeline, or invented UI component. A valid action_benefit rhythm is: 'Reviewing progress insights / replaces scattered numbers. // The bigger picture / becomes easier to see, / and easier / to understand.'";
  }

  if (/\b(?:ai|log|photo|draft)\w*\b/u.test(normalizedFocus)) {
    return "Describe assisted logging and fewer manual typing steps only. Say 'logging meals' or 'typing meal details', never 'typing meals'. Name the food record or logging in the payoff; never use the vague phrase 'maintain it'. The direct payoff may be that maintaining the food record feels easier when the Business Profile supports that promise. Do not claim automatic recognition, one-tap behavior, exact accuracy, saved or reusable meals, repetitive-entry removal, a photo workflow, drafting details, or measured time saving unless the Business Profile states that exact mechanism.";
  }

  if (/\b(?:guidance|nutrition|expert|coach|recommend)\w*\b/u.test(normalizedFocus)) {
    return "Describe personalized guidance giving choices clearer context or relevance to goals. Use either 'connects choices to goals' or 'adds context to choices'; never blend them into 'gives choices context to goals'. Rules may be rigid; choices must never be described as rigid. Do not turn guidance into faster, easier, or simpler logging. Do not claim habits or changes will stick, guaranteed behavior change, routine fit, diagnosis, meal planning, medical outcomes, automatic adjustment, or guaranteed results. Valid mistake_correction rhythm: 'One plan should fit / every meal. // But personalized guidance / adds context to choices. // Relevance matters more / than rigid rules.' Valid belief_reframe rhythm: 'Nutrition guidance is not / one fixed rule. // Personalized context / connects choices to goals. // Relevance matters more / than one-size advice.'";
  }

  return "Use the exact supported meaning only. Do not infer an implementation mechanism, quantified result, schedule, or guarantee.";
}

class WallTextReviewRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WallTextReviewRejectedError";
  }
}

function validateWallTextEvidenceSpecificity(
  generated: Array<{
    candidateIndex: number;
    content: { fullText: string };
  }>,
  businessProfile: ReturnType<typeof buildWallTextBusinessContext>,
) {
  const evidence = [
    businessProfile.brandTone,
    businessProfile.businessName,
    businessProfile.category,
    businessProfile.mainProblem,
    businessProfile.mainPromise,
    businessProfile.productSummary,
    ...businessProfile.claimsToAvoid,
    ...businessProfile.differentiators,
    ...businessProfile.painPoints,
    ...businessProfile.targetAudience,
    ...businessProfile.valueProps,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLocaleLowerCase("en-US");
  const specificityRules = [
    {
      copy: /\b(?:auto-identif\w*|automatically identify\w*)\b/iu,
      evidence: /\b(?:auto-identif\w*|automatically identify\w*)\b/iu,
      label: "automatic identification",
    },
    {
      copy: /\bone[- ]tap\b/iu,
      evidence: /\bone[- ]tap\b/iu,
      label: "one-tap behavior",
    },
    {
      copy: /\b(?:precisely|accurately|exactly)\b/iu,
      evidence: /\b(?:precisely|accurately|exactly)\b/iu,
      label: "exact accuracy",
    },
    {
      copy: /\b(?:seconds?|minutes?|hours?|daily|weekly)\b/iu,
      evidence: /\b(?:seconds?|minutes?|hours?|daily|weekly)\b/iu,
      label: "specific time outcome",
    },
    {
      copy: /\blonger\b/iu,
      evidence: /\blonger\b/iu,
      label: "relative time outcome",
    },
    {
      copy: /\b(?:accidental sharing|share(?:d|s|ing)? data)\b/iu,
      evidence: /\b(?:accidental sharing|share(?:d|s|ing)? data)\b/iu,
      label: "data-sharing behavior",
    },
    {
      copy:
        /\b(?:charts?|trend bars?|graphs?|dashboards?|scores?|reports?|comparisons?|timelines?)\b/iu,
      evidence:
        /\b(?:charts?|trend bars?|graphs?|dashboards?|scores?|reports?|comparisons?|timelines?)\b/iu,
      label: "interface visualization",
    },
    {
      copy:
        /\b(?:repetitive entr\w*|saved meals?|reuse(?:d|s|ing)? meals?|photo workflow|draft(?:ed|s|ing)? (?:the )?details?)\b/iu,
      evidence:
        /\b(?:repetitive entr\w*|saved meals?|reuse(?:d|s|ing)? meals?|photo workflow|draft(?:ed|s|ing)? (?:the )?details?)\b/iu,
      label: "logging mechanism",
    },
    {
      copy:
        /\b(?:(?:habits?|changes?) (?:will )?stick|stayed consistent|fit your routine)\b/iu,
      evidence:
        /\b(?:(?:habits?|changes?) (?:will )?stick|stayed consistent|fit your routine)\b/iu,
      label: "behavior-change outcome",
    },
  ] as const;

  for (const idea of generated) {
    for (const rule of specificityRules) {
      const match = idea.content.fullText.match(rule.copy);

      if (match && !rule.evidence.test(evidence)) {
        throw new Error(
          `Wall-of-text idea ${idea.candidateIndex + 1} uses an unsupported specific claim (${rule.label}): "${match[0]}"`,
        );
      }
    }
  }
}

async function fitWallTextContentForRender(
  content: ReturnType<
    typeof validateGeneratedWallTextIdeas
  >[number]["content"],
  durationSeconds: number,
) {
  try {
    return {
      content,
      render: await validateWallTextRenderFit(content),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const overwideLine = message.match(
      /at the 44px minimum: "([^"]+)"$/u,
    )?.[1];
    const repaired = overwideLine
      ? splitSingleOverwideWallTextLine(content, overwideLine)
      : null;

    if (!repaired) {
      throw error;
    }

    validateWallTextContent(repaired, durationSeconds);

    return {
      content: repaired,
      render: await validateWallTextRenderFit(repaired),
    };
  }
}

function splitSingleOverwideWallTextLine(
  content: ReturnType<
    typeof validateGeneratedWallTextIdeas
  >[number]["content"],
  overwideLine: string,
) {
  const currentLineCount = content.segments.reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );
  const words = overwideLine.split(/\s+/u).filter(Boolean);

  if (currentLineCount >= MAX_WALL_TEXT_RENDERED_LINES || words.length < 4) {
    return null;
  }

  const unsafeBoundaryWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);
  const candidateBreaks = Array.from(
    { length: words.length - 3 },
    (_, index) => index + 2,
  ).sort(
    (left, right) =>
      Math.abs(words.length / 2 - left) -
      Math.abs(words.length / 2 - right),
  );
  const breakAt = candidateBreaks.find((index) => {
    const leftLast = words[index - 1]!
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]/gu, "");
    const rightFirst = words[index]!
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]/gu, "");

    return (
      !unsafeBoundaryWords.has(leftLast) &&
      !unsafeBoundaryWords.has(rightFirst)
    );
  });

  if (!breakAt) {
    return null;
  }

  let replaced = false;
  const segments = content.segments.map((segment) => ({
    ...segment,
    lines: segment.lines.flatMap((line) => {
      if (replaced || line !== overwideLine) {
        return [line];
      }

      replaced = true;
      return [
        words.slice(0, breakAt).join(" "),
        words.slice(breakAt).join(" "),
      ];
    }),
  }));

  return replaced ? { ...content, segments } : null;
}
