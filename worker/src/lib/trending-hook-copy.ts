import { createHash } from "node:crypto";

import OpenAI from "openai";

import {
  buildEditOverlayTextLayout,
  estimateEditOverlayLineWidth,
} from "./edit-overlay-render-spec.js";
import {
  buildTrendingHookCampaignPurposeSequence,
  getTrendingHookPurposeInstruction,
  type TrendingHookCampaignPurpose,
} from "./trending-hook-patterns.js";
import {
  getHookTextFormat,
  getHookTextVariant,
  HOOK_TEXT_FORMAT_LIBRARY_VERSION,
  HOOK_TEXT_FORMATS,
  selectHookTextFormats,
  type HookTextFormatDefinition,
  type HookTextFormatId,
  type HookTextPerformanceSignals,
} from "./trending-hook-text-formats.js";

const DEFAULT_MODEL = "gpt-5.6-terra";
const MAX_CANDIDATE_COUNT = 12;
const MAX_HOOK_LINES = 3;
const MAX_HOOK_WORDS = 12;
const MAX_HOOK_WORDS_PER_LINE = 7;
const MAX_HOOK_CHARACTERS = 78;
const MAX_HOOK_EMOJIS = 2;
const MAX_EVIDENCE_BINDINGS = 2;
const MIN_PASSING_SCORE = 80;
const MAX_REPAIR_ROUNDS = 3;

export const TRENDING_HOOK_PROMPT_VERSION =
  "trending-hook-copy-v7";
export const TRENDING_HOOK_SELECTION_VERSION =
  "global-format-rotation-v1";
export const TRENDING_HOOK_OVERLAY_VERSION =
  "hook-overlay-v3";
export const TRENDING_HOOK_VALIDATOR_VERSION =
  "trending-hook-validator-v3";

export const HOOK_AUDIO_MOODS = [
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
] as const;
export const HOOK_AUDIO_TYPES = [
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
] as const;
export const HOOK_AUDIO_ENERGIES = [
  "low",
  "medium",
  "high",
] as const;

export type HookAudioIntent = {
  energy: (typeof HOOK_AUDIO_ENERGIES)[number];
  hookType: (typeof HOOK_AUDIO_TYPES)[number];
  mood: (typeof HOOK_AUDIO_MOODS)[number];
};

const DEFAULT_HOOK_AUDIO_INTENT_BY_FORMAT: Record<
  HookTextFormatId,
  HookAudioIntent
> = {
  GF_001: { energy: "high", hookType: "story", mood: "playful" },
  GF_002: { energy: "medium", hookType: "problem", mood: "serious" },
  GF_003: { energy: "high", hookType: "story", mood: "urgent" },
  GF_004: { energy: "high", hookType: "warning", mood: "urgent" },
  GF_005: { energy: "medium", hookType: "curiosity", mood: "curious" },
  GF_006: { energy: "medium", hookType: "story", mood: "curious" },
  GF_007: { energy: "high", hookType: "story", mood: "playful" },
  GF_008: { energy: "medium", hookType: "problem", mood: "serious" },
  GF_009: { energy: "medium", hookType: "transformation", mood: "uplifting" },
  GF_010: { energy: "medium", hookType: "benefit", mood: "uplifting" },
  GF_011: { energy: "high", hookType: "transformation", mood: "urgent" },
  GF_012: { energy: "high", hookType: "curiosity", mood: "urgent" },
  GF_013: { energy: "high", hookType: "curiosity", mood: "playful" },
  GF_014: { energy: "medium", hookType: "story", mood: "uplifting" },
  GF_015: { energy: "medium", hookType: "curiosity", mood: "curious" },
  GF_016: { energy: "high", hookType: "warning", mood: "urgent" },
  GF_017: { energy: "high", hookType: "warning", mood: "playful" },
  GF_018: { energy: "high", hookType: "transformation", mood: "urgent" },
};

const BANNED_MARKETING_PHRASES = [
  "ready to",
  "unlock",
  "revolutionize your workflow",
  "transform your business",
  "elevate your content",
  "seamlessly streamline",
  "game-changing",
  "game changing",
  "supercharge your growth",
  "in today's digital landscape",
  "in today’s digital landscape",
  "level up",
  "need help",
  "stop scrolling",
] as const;

const AI_LIKE_LANGUAGE_PHRASES = [
  "effortlessly",
  "empower",
  "focus on what really matters",
  "reclaim your time",
  "seamlessly",
  "spend that saved time",
  "streamline",
  "transform the way",
  "your journey",
] as const;

const MULTIPLE_MESSAGE_PATTERN =
  /\b(?:also|and focus|and save|and spend|and then|after that|next|plus|so you can|then|which means|while you)\b/iu;
const DEMO_EXPLANATION_PATTERN =
  /(?:^(?:click|open|select|snap|swipe|take|tap|upload)\b|\b(?:let the app|see how|step by step|then the app|watch (?:it|the app))\b)/iu;
const SECONDARY_BENEFIT_PATTERN =
  /\b(?:and focus|and save|and spend|so you can|which means|while you)\b/iu;

const UNSUPPORTED_CLAIM_TERMS = [
  "always",
  "guaranteed",
  "guarantee",
  "best",
  "fastest",
  "unlimited",
  "free",
  "viral",
  "double",
  "triple",
  "revenue",
  "conversion",
  "views",
  "customers",
  "everyone",
  "many people",
  "majority",
  "most people",
  "nobody",
  "never",
  "often",
  "proven",
  "usually",
] as const;

const UNSUPPORTED_TIME_OR_NUMBER_PATTERN =
  /(?:[$€£¥]\s*\d|\d|%|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|first|second|third|fourth|fifth|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|today|yesterday|tomorrow|daily|weekly|monthly|yearly|midweek|overnight|instantly|immediately)\b)/iu;
const FIRST_PERSON_PATTERN =
  /\b(?:i|i'm|i’m|i've|i’ve|i'd|i’d|me|my|mine|myself|we|we're|we’re|we've|we’ve|our|ours|ourselves)\b/iu;
const FAKE_QUOTE_PATTERN = /["“”]/u;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const BAD_LINE_END_PATTERN =
  /\b(?:a|an|the|to|and|or|of|for|with|in|on|at|from|by)$/iu;
const ALLOWED_ONE_WORD_LINES = new Set([
  "again",
  "exactly",
  "finally",
  "really",
  "seriously",
  "why",
]);
const HOOK_GROUNDING_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "but",
  "by",
  "can",
  "does",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "not",
  "of",
  "on",
  "or",
  "so",
  "than",
  "that",
  "the",
  "then",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "why",
  "will",
  "with",
  "without",
  "you",
  "your",
]);
const HOOK_GROUNDING_RHETORICAL_WORDS = new Set([
  "actually",
  "again",
  "about",
  "after",
  "are",
  "become",
  "cooked",
  "could",
  "exists",
  "feel",
  "finally",
  "found",
  "get",
  "gatekeep",
  "gatekeeps",
  "imagine",
  "kiss",
  "keep",
  "know",
  "love",
  "marry",
  "make",
  "owe",
  "possible",
  "pov",
  "prove",
  "really",
  "seeing",
  "showed",
  "sorry",
  "sound",
  "stay",
  "stop",
  "tell",
  "turn",
  "wdym",
  "whoever",
]);

export type TrendingHookCopyCandidate = {
  candidateIndex: number;
  durationSeconds: number;
  influencerId: string;
  influencerKey: string | null;
  influencerName: string;
  influencerVideoId: string;
  influencerVideoTitle: string;
  reactionType: string | null;
  sourceDurationSeconds: number;
  sourceKind: "catalog" | "user";
  thumbnailUrl: string | null;
  trimEnd: number | null;
  trimStart: number;
  visualGroup: string | null;
};

export type HookOverlayVisualFit = {
  canvasHeight: number;
  canvasWidth: number;
  characterCount: number;
  fits: boolean;
  fontSize: number;
  isTruncated: boolean;
  lineWidths: number[];
  maximumTextHeight: number;
  maximumTextWidth: number;
  overlayVersion: typeof TRENDING_HOOK_OVERLAY_VERSION;
  renderedLineCount: number;
  semanticLineCount: number;
  textHeight: number;
  textWidth: number;
  wordCount: number;
};

export type HookDeterministicValidation = {
  aiLikeLanguagePassed: boolean;
  bannedPhrasePassed: boolean;
  businessGroundingPassed: boolean;
  claimValidationPassed: boolean;
  demoExplanationPassed: boolean;
  duplicateCheckPassed: boolean;
  emojiValidationPassed: boolean;
  evidenceBindingPassed: boolean;
  evidenceBindings: HookEvidenceBinding[];
  firstPersonValidationPassed: boolean;
  intentionalLineBreaksPassed: boolean;
  lineValidationPassed: boolean;
  multipleMessagesPassed: boolean;
  passed: boolean;
  reasons: string[];
  secondaryBenefitPassed: boolean;
  textFitPassed: boolean;
};

export type HookEvidenceBinding = {
  key: string;
  text: string;
};

export type HookReviewScores = {
  businessRelevance: number;
  claimSafety: number;
  humanVoice: number;
  originality: number;
  reactionMatch: number;
  readability: number;
  scrollStop: number;
  total: number;
};

export type TrendingHookCopyResult = TrendingHookCopyCandidate & {
  audioIntent: HookAudioIntent;
  campaignPurpose: TrendingHookCampaignPurpose;
  hookText: string;
  hookTextFormatId: HookTextFormatId;
  hookTextFormatLibraryVersion: typeof HOOK_TEXT_FORMAT_LIBRARY_VERSION;
  hookTextFormatName: string;
  hookTextVariantId: string;
  inputContextHash: string;
  openingLines: string[];
  readabilityReview: {
    claimSafe: true;
    durationSeconds: number;
    estimatedReadingSeconds: number;
    humanVoice: true;
    openingOnly: true;
    readable: true;
    reactionMatch: true;
    reason: string;
    repairApplied: boolean;
    scores: HookReviewScores;
    scrollStopping: true;
    singleIdea: true;
    truthful: true;
  };
  validation: HookDeterministicValidation & { passed: true };
  validatorVersion: typeof TRENDING_HOOK_VALIDATOR_VERSION;
  visualFit: HookOverlayVisualFit & { fits: true };
};

type HookDraftSpec = {
  campaignPurpose: TrendingHookCampaignPurpose;
  candidate: TrendingHookCopyCandidate;
  draftKey: string;
  format: HookTextFormatDefinition;
};

export type HookDraft = {
  audioIntent: HookAudioIntent;
  candidateIndex: number;
  draftKey: string;
  evidenceKeys: string[];
  lines: string[];
  hookTextFormatId: HookTextFormatId;
  hookTextVariantId: string;
};

export type HookReview = {
  candidateIndex: number;
  claimSafe: boolean;
  draftKey: string;
  estimatedReadingSeconds: number;
  humanVoice: boolean;
  openingOnly: boolean;
  readable: boolean;
  reactionMatch: boolean;
  reason: string;
  revisedLines: string[];
  scores: Omit<HookReviewScores, "total">;
  scrollStopping: boolean;
  singleIdea: boolean;
  truthful: boolean;
};

type StructuredResponseClient = Pick<OpenAI, "responses">;

export async function generateValidatedTrendingHookCopies(params: {
  allowPartialCandidates?: boolean;
  businessProfile: unknown;
  candidates: TrendingHookCopyCandidate[];
  client?: StructuredResponseClient;
  model?: string;
  performanceSignals?: HookTextPerformanceSignals;
}) {
  const candidates = normalizeCandidates(params.candidates);
  const businessContext = extractBusinessContext(
    params.businessProfile,
  );
  const evidenceCatalog = buildBusinessEvidenceCatalog(
    businessContext,
  );
  const performanceSignals = normalizePerformanceSignals(
    params.performanceSignals,
  );

  if (evidenceCatalog.length === 0) {
    throw new Error(
      "The Business Profile needs at least one Hook evidence field.",
    );
  }

  const inputContextHash = createInputContextHash({
    businessContext,
    candidates,
    evidenceCatalog,
    performanceSignals,
  });
  const model =
    params.model?.trim() ||
    process.env.OPENAI_TRENDING_HOOK_MODEL?.trim() ||
    DEFAULT_MODEL;
  const client = params.client ?? createOpenAIClient();
  const specs = buildDraftSpecs({
    businessContext,
    candidates,
    performanceSignals,
  });
  let finalDrafts = await writeHookDrafts({
    businessContext,
    client,
    evidenceCatalog,
    model,
    specs,
  });
  let finalReviews = await reviewHookDrafts({
    businessContext,
    client,
    drafts: finalDrafts,
    evidenceCatalog,
    model,
    specs,
  });
  const repairedKeys = new Set<string>();

  for (
    let repairRound = 0;
    repairRound < MAX_REPAIR_ROUNDS;
    repairRound += 1
  ) {
    const validations = validateDraftBatch({
      businessContext,
      drafts: finalDrafts,
      evidenceCatalog,
      specs,
    });
    const failedKeys = getFailedDraftKeys({
      reviews: finalReviews,
      specs,
      validations,
    });

    if (failedKeys.length === 0) {
      break;
    }

    const repairSpecs = specs.filter((spec) =>
      failedKeys.includes(spec.draftKey),
    );
    const repairedDrafts = await repairHookDrafts({
      businessContext,
      client,
      drafts: finalDrafts.filter((draft) =>
        failedKeys.includes(draft.draftKey),
      ),
      evidenceCatalog,
      model,
      finalEvidenceRecovery:
        repairRound === MAX_REPAIR_ROUNDS - 1,
      reviews: finalReviews.filter((review) =>
        failedKeys.includes(review.draftKey),
      ),
      specs: repairSpecs,
      validations: validations.filter((validation) =>
        failedKeys.includes(validation.draftKey),
      ),
    });
    const repairedReviews = await reviewHookDrafts({
      businessContext,
      client,
      drafts: repairedDrafts,
      evidenceCatalog,
      model,
      specs: repairSpecs,
    });

    failedKeys.forEach((draftKey) => repairedKeys.add(draftKey));
    finalDrafts = replaceByDraftKey(finalDrafts, repairedDrafts);
    finalReviews = replaceByDraftKey(
      finalReviews,
      repairedReviews,
    );
  }

  const validations = validateDraftBatch({
    businessContext,
    drafts: finalDrafts,
    evidenceCatalog,
    specs,
  });
  const draftByKey = new Map(
    finalDrafts.map((draft) => [draft.draftKey, draft]),
  );
  const reviewByKey = new Map(
    finalReviews.map((review) => [review.draftKey, review]),
  );
  const validationByKey = new Map(
    validations.map((validation) => [
      validation.draftKey,
      validation.result,
    ]),
  );
  const selected = selectBestDraftPerCandidate({
    allowPartialCandidates: params.allowPartialCandidates === true,
    candidates,
    draftByKey,
    reviewByKey,
    specs,
    validationByKey,
  });

  return selected.map(
    ({
      campaignPurpose,
      candidate,
      draft,
      format,
      review,
      validation,
    }) => {
      const hookText = draft.lines.join("\n");
      const visualFit = measureHookOverlayVisualFit(draft.lines);

      return {
        ...candidate,
        audioIntent: draft.audioIntent,
        campaignPurpose,
        hookTextFormatId: format.id,
        hookTextFormatLibraryVersion:
          HOOK_TEXT_FORMAT_LIBRARY_VERSION,
        hookTextFormatName: format.name,
        hookTextVariantId: draft.hookTextVariantId,
        hookText,
        inputContextHash,
        openingLines: draft.lines,
        readabilityReview: {
          claimSafe: true,
          durationSeconds: candidate.durationSeconds,
          estimatedReadingSeconds:
            review.estimatedReadingSeconds,
          humanVoice: true,
          openingOnly: true,
          readable: true,
          reactionMatch: true,
          reason: review.reason,
          repairApplied: repairedKeys.has(draft.draftKey),
          scores: getHookReviewScores(review),
          scrollStopping: true,
          singleIdea: true,
          truthful: true,
        },
        validation: {
          ...validation,
          passed: true,
        },
        validatorVersion: TRENDING_HOOK_VALIDATOR_VERSION,
        visualFit: {
          ...visualFit,
          fits: true,
        },
      } satisfies TrendingHookCopyResult;
    },
  );
}

export function measureHookOverlayVisualFit(
  value: string | readonly string[],
): HookOverlayVisualFit {
  const semanticLines = normalizeHookLines(value);
  const normalizedText = semanticLines.join(" ");
  const text = semanticLines.join("\n");
  const layout = buildEditOverlayTextLayout(text, "hook", "9:16");
  const renderedLines = layout.lines.filter((line) => line.trim());
  const semanticLineWidths = semanticLines.map((line) =>
    Math.ceil(estimateEditOverlayLineWidth(line, layout.fontSize)),
  );
  const wordCount = semanticLines
    .join(" ")
    .split(/\s+/u)
    .filter(Boolean).length;
  const fits =
    semanticLines.length > 0 &&
    semanticLines.every(Boolean) &&
    semanticLines.length <= MAX_HOOK_LINES &&
    wordCount <= MAX_HOOK_WORDS &&
    Array.from(normalizedText).length <= MAX_HOOK_CHARACTERS &&
    !layout.isTruncated &&
    renderedLines.length === semanticLines.length &&
    renderedLines.every(
      (line, index) => line === semanticLines[index],
    ) &&
    semanticLineWidths.every(
      (lineWidth) => lineWidth <= layout.bounds.contentMaxWidth,
    ) &&
    layout.bounds.containerHeight <=
      layout.bounds.maxContainerHeight &&
    layout.bounds.containerWidth <= layout.bounds.maxContainerWidth;

  return {
    canvasHeight: layout.bounds.canvasHeight,
    canvasWidth: layout.bounds.canvasWidth,
    characterCount: Array.from(normalizedText).length,
    fits,
    fontSize: layout.fontSize,
    isTruncated: layout.isTruncated,
    lineWidths: semanticLineWidths,
    maximumTextHeight: layout.bounds.maxContainerHeight,
    maximumTextWidth: layout.bounds.contentMaxWidth,
    overlayVersion: TRENDING_HOOK_OVERLAY_VERSION,
    renderedLineCount: renderedLines.length,
    semanticLineCount: semanticLines.length,
    textHeight: layout.bounds.textHeight,
    textWidth: layout.bounds.textWidth,
    wordCount,
  };
}

export function validateHookDraft(params: {
  businessContext: ReturnType<typeof extractBusinessContext>;
  candidate: TrendingHookCopyCandidate;
  draft: HookDraft;
  duplicate: boolean;
  evidenceCatalog?: HookEvidenceBinding[];
}): HookDeterministicValidation {
  const lines = normalizeHookLines(params.draft.lines);
  const text = lines.join(" ");
  const normalizedText = normalizeForComparison(text);
  const claimsToAvoid = params.businessContext.claimsToAvoid;
  const evidenceCatalog =
    params.evidenceCatalog ??
    buildBusinessEvidenceCatalog(params.businessContext);
  const evidenceByKey = new Map(
    evidenceCatalog.map((evidence) => [evidence.key, evidence]),
  );
  const evidenceBindings = [
    ...new Set(params.draft.evidenceKeys),
  ].flatMap((key) => {
    const evidence = evidenceByKey.get(key);
    return evidence ? [evidence] : [];
  });
  const evidenceBindingPassed =
    params.draft.evidenceKeys.length >= 1 &&
    params.draft.evidenceKeys.length <= MAX_EVIDENCE_BINDINGS &&
    new Set(params.draft.evidenceKeys).size ===
      params.draft.evidenceKeys.length &&
    evidenceBindings.length === params.draft.evidenceKeys.length;
  const bannedPhrasePassed = !BANNED_MARKETING_PHRASES.some(
    (phrase) => normalizedText.includes(normalizeForComparison(phrase)),
  );
  const aiLikeLanguagePassed = !AI_LIKE_LANGUAGE_PHRASES.some(
    (phrase) => normalizedText.includes(normalizeForComparison(phrase)),
  );
  const multipleMessagesPassed =
    !MULTIPLE_MESSAGE_PATTERN.test(text);
  const demoExplanationPassed =
    !DEMO_EXPLANATION_PATTERN.test(text);
  const secondaryBenefitPassed =
    !SECONDARY_BENEFIT_PATTERN.test(text);
  const forbiddenClaimPassed = !claimsToAvoid.some(
    (claim) =>
      claim.length > 2 &&
      normalizedText.includes(normalizeForComparison(claim)),
  );
  const timeOrNumberPassed =
    !UNSUPPORTED_TIME_OR_NUMBER_PATTERN.test(text) ||
    evidenceBindings.some((evidence) =>
      containsOnlySuppliedTimeOrNumberClaims(text, evidence.text),
    );
  const unsupportedClaimTermPassed = UNSUPPORTED_CLAIM_TERMS.every(
    (term) =>
      !new RegExp(`\\b${escapeRegExp(term)}\\b`, "iu").test(text) ||
      evidenceBindings.some((evidence) =>
        normalizeForComparison(evidence.text).includes(
          normalizeForComparison(term),
        ),
      ),
  );
  const fakeQuotePassed = !FAKE_QUOTE_PATTERN.test(text);
  const claimValidationPassed =
    forbiddenClaimPassed &&
    timeOrNumberPassed &&
    unsupportedClaimTermPassed &&
    fakeQuotePassed;
  const assignedFormat = getHookTextFormat(
    params.draft.hookTextFormatId,
  );
  const firstPersonValidationPassed =
    !FIRST_PERSON_PATTERN.test(text) ||
    assignedFormat?.rhetoricalFirstPersonAllowed === true;
  const emojiCount = Array.from(text.matchAll(EMOJI_PATTERN)).length;
  const emojiValidationPassed = emojiCount <= MAX_HOOK_EMOJIS;
  const businessGroundingPassed =
    evidenceBindingPassed &&
    hasSufficientBusinessGrounding(text, evidenceBindings);
  const lineValidationPassed =
    validateSemanticLines(lines) &&
    !hasDanglingContrastFragment(lines);
  const visualFit = measureHookOverlayVisualFit(lines);
  const intentionalLineBreaksPassed =
    !visualFit.isTruncated &&
    visualFit.renderedLineCount === visualFit.semanticLineCount &&
    visualFit.lineWidths.every(
      (width) => width <= visualFit.maximumTextWidth,
    );
  const textFitPassed = visualFit.fits;
  const duplicateCheckPassed = !params.duplicate;
  const wordCount = text.split(/\s+/u).filter(Boolean).length;
  const reasons = [
    ...(!evidenceBindingPassed
      ? ["missing_or_invalid_evidence_binding"]
      : []),
    ...(!bannedPhrasePassed ? ["banned_marketing_phrase"] : []),
    ...(!aiLikeLanguagePassed ? ["ai_like_language"] : []),
    ...(!businessGroundingPassed ? ["weak_business_grounding"] : []),
    ...(!multipleMessagesPassed ? ["multiple_messages"] : []),
    ...(!demoExplanationPassed
      ? ["hook_contains_demo_explanation"]
      : []),
    ...(!secondaryBenefitPassed
      ? ["unverified_secondary_benefit"]
      : []),
    ...(!forbiddenClaimPassed ? ["profile_forbidden_claim"] : []),
    ...(!timeOrNumberPassed
      ? ["unsupported_time_or_number"]
      : []),
    ...(!unsupportedClaimTermPassed
      ? ["unsupported_high_risk_claim"]
      : []),
    ...(!fakeQuotePassed ? ["unverified_quotation"] : []),
    ...(!firstPersonValidationPassed
      ? ["unverified_first_person"]
      : []),
    ...(!emojiValidationPassed ? ["too_many_emojis"] : []),
    ...(wordCount > MAX_HOOK_WORDS ||
    Array.from(text).length > MAX_HOOK_CHARACTERS
      ? ["hook_too_long"]
      : []),
    ...(lines.length > MAX_HOOK_LINES ? ["too_many_lines"] : []),
    ...(!lineValidationPassed ? ["invalid_semantic_lines"] : []),
    ...(!intentionalLineBreaksPassed
      ? ["automatic_line_wrapping"]
      : []),
    ...(!textFitPassed ? ["overlay_does_not_fit"] : []),
    ...(!duplicateCheckPassed ? ["near_duplicate"] : []),
  ];

  return {
    aiLikeLanguagePassed,
    bannedPhrasePassed,
    businessGroundingPassed,
    claimValidationPassed,
    demoExplanationPassed,
    duplicateCheckPassed,
    emojiValidationPassed,
    evidenceBindingPassed,
    evidenceBindings,
    firstPersonValidationPassed,
    intentionalLineBreaksPassed,
    lineValidationPassed,
    multipleMessagesPassed,
    passed: reasons.length === 0,
    reasons,
    secondaryBenefitPassed,
    textFitPassed,
  };
}

export function isPassingHookReview(params: {
  candidate: TrendingHookCopyCandidate;
  review: HookReview;
  validation: HookDeterministicValidation;
}) {
  const scores = getHookReviewScores(params.review);

  return (
    params.validation.passed &&
    params.review.readable &&
    params.review.reactionMatch &&
    params.review.scrollStopping &&
    params.review.singleIdea &&
    params.review.openingOnly &&
    params.review.humanVoice &&
    params.review.truthful &&
    params.review.claimSafe &&
    params.review.estimatedReadingSeconds > 0 &&
    params.review.estimatedReadingSeconds <=
      params.candidate.durationSeconds &&
    scores.total >= MIN_PASSING_SCORE
  );
}

function buildDraftSpecs(params: {
  businessContext: ReturnType<typeof extractBusinessContext>;
  candidates: TrendingHookCopyCandidate[];
  performanceSignals: HookTextPerformanceSignals;
}) {
  const purposes = buildTrendingHookCampaignPurposeSequence({
    count: params.candidates.length,
    performanceSignals: params.performanceSignals,
    requestedPurposes: params.businessContext.campaignPurposes,
  });

  const selectedInBatch = new Set<HookTextFormatId>();

  return params.candidates.flatMap((candidate, index) => {
    const campaignPurpose = purposes[index]!;
    const formats = selectHookTextFormats({
      campaignPurpose,
      candidateIndex: candidate.candidateIndex,
      count: 1,
      eligibility: {
        businessContext: params.businessContext,
        evidence: buildBusinessEvidenceCatalog(params.businessContext),
      },
      excludedFormatIds: selectedInBatch,
      performanceSignals: params.performanceSignals,
      reactionType: candidate.reactionType,
    });

    formats.forEach((format) => selectedInBatch.add(format.id));

    return formats.map(
      (format): HookDraftSpec => ({
        campaignPurpose,
        candidate,
        draftKey: `${candidate.candidateIndex}:${format.id}`,
        format,
      }),
    );
  });
}

async function writeHookDrafts(params: {
  allowMappingRetry?: boolean;
  businessContext: ReturnType<typeof extractBusinessContext>;
  client: StructuredResponseClient;
  evidenceCatalog: HookEvidenceBinding[];
  model: string;
  specs: HookDraftSpec[];
}) {
  const result = await requestStructuredJson({
    client: params.client,
    input: {
      businessContext: params.businessContext,
      evidenceCatalog: params.evidenceCatalog,
      policies: getGenerationPolicies(),
      requests: params.specs.map(toPromptSpec),
    },
    instructions: [
      "You write opening text for short influencer-reaction Hook videos in a social feed.",
      "The video contains only the reaction clip and this text. No product demo, demo caption, CTA, headline/body structure, or closing line belongs here.",
      "Write only the opening reaction: one assigned Global Hook text format, one idea, and one honest information gap that makes the viewer want to see proof later.",
      "Do not explain a process, sequence, product demo, mechanism-and-benefit chain, or secondary benefit. Stop immediately after the opening idea.",
      "Write the supplied Hook text format as a natural human thought grounded only in evidenceCatalog. Keep the assigned hookTextFormatId and choose exactly one supplied surface variant from that same format.",
      "Follow the assigned campaignPurposeInstruction. Treat the business category as context only; it is never a preset industry pack and cannot add a fact.",
      "Return one or two evidenceKeys that directly support every meaningful claim.",
      "The words must stop the right audience through recognition, tension, curiosity, or a useful contradiction—not generic advertising.",
      "Match reactionType emotionally.",
      "For each Hook, also classify its audioIntent using only the supplied controlled mood, hookType, and energy values. Describe the sound the words need; never return an audio filename, asset ID, URL, storage key, or library choice.",
      "Return exactly one, two, or three intentional semantic lines, never a paragraph. Across all lines use at most twelve words, with at most seven words on any line.",
      "If you use multiple lines, they must be visual parts of the same single sentence or thought. Never put a separate message, question, or claim on each line.",
      "Use complete, natural grammar. Do not write a clipped contrast such as 'Not X' followed by an unrelated fragment; complete the contrast clearly in the same thought.",
      "Use semantic lines: each array item is one intentional line. Prefer one or two lines, but use three short lines when that makes the thought easier to read. Do not compress it merely because the clip is short.",
      "Never invent numbers, time periods, results, testimonials, personal experience, prices, comparisons, superlatives, urgency, or guarantees. A number or time phrase is allowed only when it appears verbatim in the selected evidenceCatalog entry and the assigned format requires it.",
      "Never invent population claims such as most people, many people, everyone, or nobody.",
      "Do not invent a setting, physical object, metaphor, product mechanism, or feature that is absent from businessContext. Mystery must come from a true business idea, not fictional details.",
      "Do not use quotations or banned phrases. First person and casual language are allowed only when the assigned format explicitly marks rhetoricalFirstPersonAllowed; emotional wording such as 'I could literally kiss whoever showed me this' is rhetorical and must not introduce personal history. You may use zero to two emotionally relevant emojis, usually at the end of the final line. Emojis may reinforce the reaction but must never act as evidence for a claim. Do not mention an influencer, clip, avatar, or future demo.",
      "There is no words-per-second formula. A reviewer will judge whether a normal viewer can comfortably read and understand the complete thought during the exact duration.",
      "Return exactly one result for every draftKey, preserving draftKey, candidateIndex, and hookTextFormatId. Never switch to a different format.",
    ].join(" "),
    model: params.model,
    responseFormatName: "trending_hook_v7_drafts",
    schema: buildHookDraftBatchSchema(
      params.evidenceCatalog,
      params.specs,
    ),
  });

  try {
    return parseHookDrafts(
      result,
      params.specs,
      params.evidenceCatalog,
    );
  } catch (error) {
    if (
      !isExactHookMappingError(error, "writer") ||
      params.allowMappingRetry === false
    ) {
      throw error;
    }

    if (params.specs.length === 1) {
      return writeHookDrafts({
        ...params,
        allowMappingRetry: false,
      });
    }

    const drafts: HookDraft[] = [];
    for (const spec of params.specs) {
      drafts.push(
        ...(await writeHookDrafts({
          ...params,
          specs: [spec],
        })),
      );
    }
    return drafts;
  }
}

async function reviewHookDrafts(params: {
  allowMappingRetry?: boolean;
  businessContext: ReturnType<typeof extractBusinessContext>;
  client: StructuredResponseClient;
  drafts: HookDraft[];
  evidenceCatalog: HookEvidenceBinding[];
  model: string;
  specs: HookDraftSpec[];
}) {
  const result = await requestStructuredJson({
    client: params.client,
    input: {
      businessContext: params.businessContext,
      evidenceCatalog: params.evidenceCatalog,
      policies: getGenerationPolicies(),
      requests: params.specs.map((spec) => ({
        ...toPromptSpec(spec),
        proposedLines:
          params.drafts.find(
            (draft) => draft.draftKey === spec.draftKey,
          )?.lines ?? [],
        proposedEvidenceKeys:
          params.drafts.find(
            (draft) => draft.draftKey === spec.draftKey,
          )?.evidenceKeys ?? [],
      })),
    },
    instructions: [
      "You are the independent Hook-overlay reviewer. Judge each result as a normal mobile-feed viewer seeing the text for one pass of the exact clip duration.",
      "Do not use a fixed word-per-second formula. Decide whether the viewer can notice, read, and understand the complete thought comfortably without replaying.",
      "Do not penalize a Hook for being shorter than the clip. A sharp one- to three-line thought with a brief moment to react is desirable, especially at 2–3 seconds.",
      "Score businessRelevance 0–20, reactionMatch 0–20, humanVoice 0–15, scrollStop 0–15, readability 0–15, claimSafety 0–10, and originality 0–5.",
      "truthful and claimSafe require that every factual statement is grounded in businessContext and the selected evidenceCatalog entries. Numbers, time periods, results, testimonials, personal history, comparisons, prices, superlatives, and guarantees fail unless the exact fact is supplied in selected evidence.",
      "The copy must serve its assigned campaign purpose and industry focus without treating those directions as evidence or adding an industry assumption.",
      "A candidate is not truthful when it invents a setting, object, metaphor, mechanism, or feature that businessContext never supplies.",
      "Every meaningful statement must be supported by proposedEvidenceKeys and the matching evidenceCatalog entries; an unrelated evidence key fails truthful and claimSafe.",
      "Set singleIdea true only when the copy expresses exactly one problem, capability, question, or reversal.",
      "Multiple semantic display lines do not automatically mean multiple ideas. Judge the combined overlay as one thought; fail singleIdea only when it contains a second message, explanation, answer, benefit, or claim.",
      "Set humanVoice and readable false for clipped or awkward grammar, including a dangling 'Not X' contrast that does not complete naturally across the lines.",
      "Set openingOnly true only when it stops before any process explanation, product-demo instruction, outcome chain, CTA, or secondary benefit.",
      "Set humanVoice true only when it sounds like an immediate natural reaction, not polished website copy or AI-written prose.",
      "Generic marketing language fails human voice and scroll-stop. The emotional direction must fit reactionType.",
      "If any requirement fails, provide revisedLines that fix it without adding facts. Otherwise return an empty revisedLines array.",
      "A candidate is selectable only at a total score of 80 or more. If your scores total below 80, it is not scroll-stopping enough: set scrollStopping false and provide stronger revisedLines.",
      "Calibrate the scale so 80 means publishable and 90 means excellent; 80 does not mean perfect.",
      "Keep boolean and score judgments consistent. If claimSafe is true, claimSafety should reflect that the wording is safe; if claim safety is genuinely doubtful, set claimSafe false.",
      "Preserve draftKey and candidateIndex and review every request.",
    ].join(" "),
    model: params.model,
    responseFormatName: "trending_hook_v7_reviews",
    schema: buildHookReviewBatchSchema(params.specs),
  });

  try {
    return parseHookReviews(result, params.specs);
  } catch (error) {
    if (
      !isExactHookMappingError(error, "reviewer") ||
      params.allowMappingRetry === false
    ) {
      throw error;
    }

    if (params.specs.length === 1) {
      return reviewHookDrafts({
        ...params,
        allowMappingRetry: false,
      });
    }

    const reviews: HookReview[] = [];
    for (const spec of params.specs) {
      reviews.push(
        ...(await reviewHookDrafts({
          ...params,
          specs: [spec],
        })),
      );
    }
    return reviews;
  }
}

async function repairHookDrafts(params: {
  allowMappingRetry?: boolean;
  businessContext: ReturnType<typeof extractBusinessContext>;
  client: StructuredResponseClient;
  drafts: HookDraft[];
  evidenceCatalog: HookEvidenceBinding[];
  finalEvidenceRecovery: boolean;
  model: string;
  reviews: HookReview[];
  specs: HookDraftSpec[];
  validations: Array<{
    draftKey: string;
    result: HookDeterministicValidation;
  }>;
}) {
  const result = await requestStructuredJson({
    client: params.client,
    input: {
      businessContext: params.businessContext,
      evidenceCatalog: params.evidenceCatalog,
      repairMode: params.finalEvidenceRecovery
        ? "final_evidence_recovery"
        : "standard",
      policies: getGenerationPolicies(),
      requests: params.specs.map((spec) => ({
        ...toPromptSpec(spec),
        previousLines:
          params.drafts.find(
            (draft) => draft.draftKey === spec.draftKey,
          )?.lines ?? [],
        previousEvidenceKeys:
          params.drafts.find(
            (draft) => draft.draftKey === spec.draftKey,
          )?.evidenceKeys ?? [],
        reviewer:
          params.reviews.find(
            (review) => review.draftKey === spec.draftKey,
          ) ?? null,
        deterministicValidation:
          params.validations.find(
            (validation) =>
              validation.draftKey === spec.draftKey,
          )?.result ?? null,
        visualFit: measureHookOverlayVisualFit(
          params.drafts.find(
            (draft) => draft.draftKey === spec.draftKey,
          )?.lines ?? [],
        ),
      })),
    },
    instructions: [
      "Repair only the supplied Hook overlays. Keep the assigned Global Hook text format, surface variant family, and strongest true Business Profile idea.",
      "Keep the assigned campaign purpose and industry focus, but never turn industry guidance into an unsupported fact.",
      "Return only an opening reaction: one assigned format, one idea, one to three intentional lines, and at most twelve words total.",
      "If the reviewer marked singleIdea false, reduce the copy to one short question or statement. Multiple visual lines may split that one thought, but must not carry separate messages.",
      "Do not explain the process, demo steps, mechanism-and-benefit chain, or a secondary benefit. Preserve curiosity and stop after the opening.",
      "Return one or two valid evidenceKeys that directly support the repaired wording.",
      "Reclassify audioIntent for the repaired words using only the controlled values. Never return an audio filename, asset ID, URL, storage key, or library choice.",
      "Apply semantic line breaks and make the full thought comfortable in one pass of the exact duration without using a word-per-second formula.",
      "Fix every deterministicValidation reason. Each semantic line must stay on one rendered line, contain at most seven words, and not end with an article, conjunction, or preposition.",
      "For invalid_semantic_lines, restore complete natural grammar as well as clean line breaks. Never leave a dangling 'Not X' contrast or two fragments that do not form one clear thought.",
      "Use visualFit.lineWidths and visualFit.maximumTextWidth: when a line is too wide, shorten that line decisively. Do not hide the overflow by adding another dense line.",
      "For unsupported_time_or_number, remove every digit, number word, currency, percentage, date, and time-unit word unless it occurs verbatim in the selected evidence and the assigned format requires that evidence. Do not paraphrase it as another numeric or time claim.",
      "For weak_business_grounding, remove invented settings, objects, metaphors, mechanisms, and features. Rebuild the Hook from the supplied audience problem, product summary, value props, or differentiators.",
      ...(params.finalEvidenceRecovery
        ? [
            "This is the final evidence-recovery pass. Use exactly one evidenceKey and keep every meaningful noun, action, problem, and capability close to that evidence text. Do not infer a new setting, behavior, result, comparison, or benefit.",
            "Prefer one short, natural question or statement over cleverness. It must still fit the assigned format and earn the publishable score without weakening any safety rule.",
          ]
        : []),
      "Aim for a genuinely strong result that can earn at least 80/100, not merely a shorter version.",
      "Remove unsupported facts, personal history, numbers, time claims, quotations, and generic marketing language. Preserve permitted rhetorical first-person emotion only when the assigned format allows it. Keep at most two emotionally relevant emojis; remove any emoji that substitutes for evidence or does not match the reaction.",
      "Do not add a demo, CTA, headline/body structure, or any new fact.",
      "Return exactly one repaired result for every draftKey.",
    ].join(" "),
    model: params.model,
    responseFormatName: "trending_hook_v7_repairs",
    schema: buildHookDraftBatchSchema(
      params.evidenceCatalog,
      params.specs,
    ),
  });

  try {
    return parseHookDrafts(
      result,
      params.specs,
      params.evidenceCatalog,
    );
  } catch (error) {
    if (
      !isExactHookMappingError(error, "writer") ||
      params.allowMappingRetry === false
    ) {
      throw error;
    }

    if (params.specs.length === 1) {
      return repairHookDrafts({
        ...params,
        allowMappingRetry: false,
      });
    }

    const drafts: HookDraft[] = [];
    for (const spec of params.specs) {
      drafts.push(
        ...(await repairHookDrafts({
          ...params,
          specs: [spec],
        })),
      );
    }
    return drafts;
  }
}

async function requestStructuredJson(params: {
  client: StructuredResponseClient;
  input: unknown;
  instructions: string;
  model: string;
  responseFormatName: string;
  schema: Record<string, unknown>;
}) {
  const response = await params.client.responses.create({
    input: JSON.stringify(params.input),
    instructions: params.instructions,
    model: params.model,
    reasoning: { effort: "low" },
    store: false,
    text: {
      format: {
        name: params.responseFormatName,
        schema: params.schema,
        strict: true,
        type: "json_schema",
      },
      verbosity: "low",
    },
  });

  if (!response.output_text?.trim()) {
    throw new Error("The Hook copy model returned no structured output.");
  }

  try {
    return JSON.parse(response.output_text) as unknown;
  } catch {
    throw new Error("The Hook copy model returned invalid JSON.");
  }
}

function getFailedDraftKeys(params: {
  reviews: HookReview[];
  specs: HookDraftSpec[];
  validations: Array<{
    draftKey: string;
    result: HookDeterministicValidation;
  }>;
}) {
  const validationByKey = new Map(
    params.validations.map((item) => [
      item.draftKey,
      item.result,
    ]),
  );
  const reviewByKey = new Map(
    params.reviews.map((review) => [review.draftKey, review]),
  );

  return params.specs.flatMap((spec) => {
    const review = reviewByKey.get(spec.draftKey);
    const validation = validationByKey.get(spec.draftKey);

    return !review ||
      !validation ||
      !isPassingHookReview({
        candidate: spec.candidate,
        review,
        validation,
      })
      ? [spec.draftKey]
      : [];
  });
}

function validateDraftBatch(params: {
  businessContext: ReturnType<typeof extractBusinessContext>;
  drafts: HookDraft[];
  evidenceCatalog: HookEvidenceBinding[];
  specs: HookDraftSpec[];
}) {
  const duplicateKeys = findNearDuplicateDraftKeys(params.drafts);
  const draftByKey = new Map(
    params.drafts.map((draft) => [draft.draftKey, draft]),
  );

  return params.specs.map((spec) => {
    const draft = draftByKey.get(spec.draftKey);

    if (!draft) {
      throw new Error(
        `Hook draft ${spec.draftKey} is missing during validation.`,
      );
    }

    return {
      draftKey: spec.draftKey,
      result: validateHookDraft({
        businessContext: params.businessContext,
        candidate: spec.candidate,
        draft,
        duplicate: duplicateKeys.has(spec.draftKey),
        evidenceCatalog: params.evidenceCatalog,
      }),
    };
  });
}

function selectBestDraftPerCandidate(params: {
  allowPartialCandidates: boolean;
  candidates: TrendingHookCopyCandidate[];
  draftByKey: Map<string, HookDraft>;
  reviewByKey: Map<string, HookReview>;
  specs: HookDraftSpec[];
  validationByKey: Map<string, HookDeterministicValidation>;
}) {
  const failures: string[] = [];
  const selected = params.candidates.flatMap((candidate) => {
    const eligible = params.specs
      .filter(
        (spec) =>
          spec.candidate.candidateIndex === candidate.candidateIndex,
      )
      .flatMap((spec) => {
        const draft = params.draftByKey.get(spec.draftKey);
        const review = params.reviewByKey.get(spec.draftKey);
        const validation = params.validationByKey.get(spec.draftKey);

        return draft &&
          review &&
          validation &&
          isPassingHookReview({ candidate, review, validation })
          ? [
              {
                campaignPurpose: spec.campaignPurpose,
                candidate,
                draft,
                format: spec.format,
                review,
                validation,
              },
            ]
          : [];
      })
      .sort(
        (first, second) =>
          getHookReviewScores(second.review).total -
            getHookReviewScores(first.review).total ||
          first.format.id.localeCompare(second.format.id),
      );
    const chosen = eligible[0];

    if (!chosen) {
      const diagnostics = params.specs
        .filter(
          (spec) =>
            spec.candidate.candidateIndex ===
            candidate.candidateIndex,
        )
        .map((spec) => {
          const review = params.reviewByKey.get(spec.draftKey);
          const validation = params.validationByKey.get(
            spec.draftKey,
          );

          return {
            draftKey: spec.draftKey,
            reasons: validation?.reasons ?? ["missing_validation"],
            score: review
              ? getHookReviewScores(review).total
              : null,
            reviewPassed: review
              ? {
                  claimSafe: review.claimSafe,
                  humanVoice: review.humanVoice,
                  openingOnly: review.openingOnly,
                  readable: review.readable,
                  reactionMatch: review.reactionMatch,
                  scrollStopping: review.scrollStopping,
                  singleIdea: review.singleIdea,
                  truthful: review.truthful,
                }
              : null,
          };
        });

      const message =
        `No validated Hook copy remained for candidate index ${candidate.candidateIndex}: ${JSON.stringify(diagnostics)}.`;

      if (params.allowPartialCandidates) {
        failures.push(message);
        return [];
      }

      throw new Error(message);
    }

    return [chosen];
  });

  if (selected.length === 0) {
    throw new Error(
      failures[0] ?? "No validated Hook copy remained for any candidate.",
    );
  }

  return selected;
}

function parseHookDrafts(
  value: unknown,
  specs: HookDraftSpec[],
  evidenceCatalog: HookEvidenceBinding[],
) {
  const record = getRecord(value);
  const hooks = record?.hooks;

  if (!Array.isArray(hooks)) {
    throw new Error("The Hook writer returned an invalid batch.");
  }

  const drafts = hooks.map((item): HookDraft => {
    const hook = getRecord(item);
    const draftKey =
      typeof hook?.draftKey === "string" ? hook.draftKey.trim() : "";
    const candidateIndex = getInteger(hook?.candidateIndex);
    const hookTextFormatId =
      typeof hook?.hookTextFormatId === "string" &&
      getHookTextFormat(hook.hookTextFormatId)
        ? (hook.hookTextFormatId as HookTextFormatId)
        : null;
    const format = hookTextFormatId
      ? getHookTextFormat(hookTextFormatId)
      : null;
    const hookTextVariantId =
      format && typeof hook?.hookTextVariantId === "string" &&
      getHookTextVariant(format, hook.hookTextVariantId)
        ? hook.hookTextVariantId
        : null;
    const audioIntent = hookTextFormatId
      ? parseHookAudioIntent(hook?.audioIntent) ??
        DEFAULT_HOOK_AUDIO_INTENT_BY_FORMAT[hookTextFormatId]
      : null;
    const evidenceKeys = Array.isArray(hook?.evidenceKeys)
      ? hook.evidenceKeys
          .filter(
            (key): key is string => typeof key === "string",
          )
          .map((key) => key.trim())
          .filter(Boolean)
      : [];
    const lines = Array.isArray(hook?.lines)
      ? normalizeHookLines(
          hook.lines.filter(
            (line): line is string => typeof line === "string",
          ),
        )
      : [];

    if (
      !draftKey ||
      candidateIndex === null ||
      !hookTextFormatId ||
      !hookTextVariantId ||
      !audioIntent ||
      evidenceKeys.length < 1 ||
      evidenceKeys.length > MAX_EVIDENCE_BINDINGS ||
      new Set(evidenceKeys).size !== evidenceKeys.length ||
      evidenceKeys.some(
        (key) =>
          !evidenceCatalog.some(
            (evidence) => evidence.key === key,
          ),
      ) ||
      lines.length === 0
    ) {
      throw new Error("The Hook writer returned invalid text.");
    }

    return {
      audioIntent,
      candidateIndex,
      draftKey,
      evidenceKeys,
      hookTextFormatId,
      hookTextVariantId,
      lines,
    };
  });

  assertExactDraftMapping(drafts, specs, "writer");
  return drafts;
}

function parseHookReviews(value: unknown, specs: HookDraftSpec[]) {
  const record = getRecord(value);
  const reviews = record?.reviews;

  if (!Array.isArray(reviews)) {
    throw new Error("The Hook reviewer returned an invalid batch.");
  }

  const parsed = reviews.map((item): HookReview => {
    const review = getRecord(item);
    const scores = getRecord(review?.scores);
    const candidateIndex = getInteger(review?.candidateIndex);
    const draftKey =
      typeof review?.draftKey === "string"
        ? review.draftKey.trim()
        : "";
    const estimatedReadingSeconds = getPositiveNumber(
      review?.estimatedReadingSeconds,
    );

    if (
      !draftKey ||
      candidateIndex === null ||
      estimatedReadingSeconds === null ||
      typeof review?.humanVoice !== "boolean" ||
      typeof review.openingOnly !== "boolean" ||
      typeof review?.readable !== "boolean" ||
      typeof review.reactionMatch !== "boolean" ||
      typeof review.scrollStopping !== "boolean" ||
      typeof review.singleIdea !== "boolean" ||
      typeof review.truthful !== "boolean" ||
      typeof review.claimSafe !== "boolean" ||
      typeof review.reason !== "string" ||
      !scores
    ) {
      throw new Error("The Hook reviewer returned invalid results.");
    }

    return {
      candidateIndex,
      claimSafe: review.claimSafe,
      draftKey,
      estimatedReadingSeconds,
      humanVoice: review.humanVoice,
      openingOnly: review.openingOnly,
      readable: review.readable,
      reactionMatch: review.reactionMatch,
      reason: review.reason.trim().slice(0, 500),
      revisedLines: Array.isArray(review.revisedLines)
        ? normalizeHookLines(
            review.revisedLines.filter(
              (line): line is string => typeof line === "string",
            ),
          )
        : [],
      scores: {
        businessRelevance: getBoundedScore(
          scores.businessRelevance,
          20,
        ),
        claimSafety: getBoundedScore(scores.claimSafety, 10),
        humanVoice: getBoundedScore(scores.humanVoice, 15),
        originality: getBoundedScore(scores.originality, 5),
        reactionMatch: getBoundedScore(scores.reactionMatch, 20),
        readability: getBoundedScore(scores.readability, 15),
        scrollStop: getBoundedScore(scores.scrollStop, 15),
      },
      scrollStopping: review.scrollStopping,
      singleIdea: review.singleIdea,
      truthful: review.truthful,
    };
  });

  assertExactDraftMapping(parsed, specs, "reviewer");
  return parsed;
}

function assertExactDraftMapping(
  values: Array<{
    candidateIndex: number;
    draftKey: string;
    hookTextFormatId?: HookTextFormatId;
  }>,
  specs: HookDraftSpec[],
  source: string,
) {
  const specByKey = new Map(specs.map((spec) => [spec.draftKey, spec]));

  if (
    values.length !== specs.length ||
    new Set(values.map((value) => value.draftKey)).size !==
      values.length ||
    values.some((value) => {
      const spec = specByKey.get(value.draftKey);
      return (
        !spec ||
        value.candidateIndex !== spec.candidate.candidateIndex ||
        (value.hookTextFormatId !== undefined &&
          value.hookTextFormatId !== spec.format.id)
      );
    })
  ) {
    throw new Error(
      `The Hook ${source} did not return one result for every requested format.`,
    );
  }
}

function isExactHookMappingError(error: unknown, source: string) {
  return (
    error instanceof Error &&
    error.message ===
      `The Hook ${source} did not return one result for every requested format.`
  );
}

function extractHookWords(text: string) {
  return (
    text.match(
      /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu,
    ) ?? []
  );
}

function validateSemanticLines(lines: string[]) {
  const words = lines.join(" ").split(/\s+/u).filter(Boolean);
  const uppercaseTokens = words.filter(
    (word) =>
      word.length > 1 &&
      /\p{L}/u.test(word) &&
      word === word.toUpperCase(),
  );

  return (
    lines.length >= 1 &&
    lines.length <= MAX_HOOK_LINES &&
    words.length >= 2 &&
    words.length <= MAX_HOOK_WORDS &&
    Array.from(lines.join(" ")).length <= MAX_HOOK_CHARACTERS &&
    uppercaseTokens.length <= 1 &&
    lines.every((line) => {
      const lineTokens = line.split(/\s+/u).filter(Boolean);
      const lexicalWords = extractHookWords(line);
      const finalWord = lexicalWords.at(-1) ?? "";
      return (
        lineTokens.length >= 1 &&
        lineTokens.length <= MAX_HOOK_WORDS_PER_LINE &&
        !BAD_LINE_END_PATTERN.test(finalWord) &&
        (lexicalWords.length > 1 ||
          ALLOWED_ONE_WORD_LINES.has(
            finalWord.toLowerCase(),
          ))
      );
    })
  );
}

function hasDanglingContrastFragment(lines: string[]) {
  if (lines.length !== 2) {
    return false;
  }

  const firstLine = lines[0]?.trim() ?? "";
  const secondLine = lines[1]?.trim() ?? "";

  return (
    /^not\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,2}[.!?]?$/iu.test(
      firstLine,
    ) &&
    !/^(?:[-\u2014:]|a\b|an\b|but\b|instead\b|it(?:')s\b|rather\b|the\b)/iu.test(
      secondLine,
    )
  );
}

function findNearDuplicateDraftKeys(drafts: HookDraft[]) {
  const duplicateKeys = new Set<string>();
  const draftsByCandidate = new Map<number, HookDraft[]>();

  for (const draft of drafts) {
    const siblings =
      draftsByCandidate.get(draft.candidateIndex) ?? [];
    siblings.push(draft);
    draftsByCandidate.set(draft.candidateIndex, siblings);
  }

  for (const siblings of draftsByCandidate.values()) {
    for (let index = 0; index < siblings.length; index += 1) {
      for (
        let comparisonIndex = 0;
        comparisonIndex < index;
        comparisonIndex += 1
      ) {
        if (
          tokenSimilarity(
            siblings[index]!.lines.join(" "),
            siblings[comparisonIndex]!.lines.join(" "),
          ) >= 0.82
        ) {
          duplicateKeys.add(siblings[index]!.draftKey);
        }
      }
    }
  }

  return duplicateKeys;
}

function tokenSimilarity(first: string, second: string) {
  const firstTokens = new Set(
    normalizeForComparison(first).split(" ").filter(Boolean),
  );
  const secondTokens = new Set(
    normalizeForComparison(second).split(" ").filter(Boolean),
  );
  const union = new Set([...firstTokens, ...secondTokens]);

  if (union.size === 0) {
    return 1;
  }

  const intersection = [...firstTokens].filter((token) =>
    secondTokens.has(token),
  ).length;
  return intersection / union.size;
}

function hasSufficientBusinessGrounding(
  text: string,
  evidenceBindings: HookEvidenceBinding[],
) {
  const businessTokens = new Set(
    evidenceBindings
      .map((evidence) => evidence.text)
      .flatMap(tokenizeGroundingText),
  );
  const contentTokens = [
    ...new Set(
      tokenizeGroundingText(text).filter(
        (token) => !HOOK_GROUNDING_STOPWORDS.has(token),
      ),
    ),
  ];

  if (contentTokens.length === 0) {
    return false;
  }

  const groundedCount = contentTokens.filter(
    (token) =>
      businessTokens.has(token) ||
      HOOK_GROUNDING_RHETORICAL_WORDS.has(token),
  ).length;

  return (
    groundedCount >= Math.min(2, contentTokens.length) &&
    groundedCount / contentTokens.length >= 0.55
  );
}

function tokenizeGroundingText(value: string) {
  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !HOOK_GROUNDING_STOPWORDS.has(token))
    .map(stemGroundingToken);
}

function containsOnlySuppliedTimeOrNumberClaims(
  hookText: string,
  evidenceText: string,
) {
  const hookClaims = extractTimeOrNumberClaims(hookText);
  const evidenceClaims = new Set(extractTimeOrNumberClaims(evidenceText));

  return (
    hookClaims.length > 0 &&
    hookClaims.every((claim) => evidenceClaims.has(claim))
  );
}

function extractTimeOrNumberClaims(value: string) {
  return [
    ...new Set(
      (
        value.match(
          /(?:[$€£¥]\s*\d[\d,.]*|\d[\d,.]*\s*%?|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|first|second|third|fourth|fifth|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|today|yesterday|tomorrow|daily|weekly|monthly|yearly|midweek|overnight|instantly|immediately)\b)/giu,
        ) ?? []
      ).map(normalizeForComparison),
    ),
  ];
}

function stemGroundingToken(value: string) {
  if (value.length > 5 && value.endsWith("ing")) {
    return value.slice(0, -3).replace(/(.)\1$/u, "$1");
  }

  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.length > 4 && value.endsWith("ed")) {
    return value.slice(0, -2).replace(/(.)\1$/u, "$1");
  }

  if (
    value.length > 4 &&
    value.endsWith("s") &&
    !value.endsWith("ss")
  ) {
    return value.slice(0, -1);
  }

  return value;
}

function getHookReviewScores(review: HookReview): HookReviewScores {
  const scores = review.scores;
  return {
    ...scores,
    total:
      scores.businessRelevance +
      scores.claimSafety +
      scores.humanVoice +
      scores.originality +
      scores.reactionMatch +
      scores.readability +
      scores.scrollStop,
  };
}

function getBoundedScore(value: unknown, maximum: number) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    throw new Error(
      `The Hook reviewer returned a score outside 0–${maximum}.`,
    );
  }

  return value;
}

function extractBusinessContext(value: unknown) {
  const profile = getRecord(value) ?? {};
  const textField = (field: string) =>
    typeof profile[field] === "string"
      ? profile[field].trim().slice(0, 2_000)
      : "";
  const textList = (field: string) =>
    Array.isArray(profile[field])
      ? profile[field]
          .filter(
            (item): item is string => typeof item === "string",
          )
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 25)
      : [];
  const categories = textList("categories");
  const targetAudience = textList("targetAudience");
  const differentiators = textList("differentiators");
  const campaignPurposes = textList("campaignPurposes").filter(
    (purpose): purpose is TrendingHookCampaignPurpose =>
      [
        "product_discovery",
        "education",
        "conversion",
        "retargeting",
        "app_install",
      ].includes(purpose),
  );

  return {
    brandTone: textField("brandTone"),
    businessModel: textField("businessModel"),
    businessName: textField("businessName"),
    campaignPurposes,
    categories:
      categories.length > 0
        ? categories
        : [textField("category")].filter(Boolean),
    category: categories[0] || textField("category"),
    claimsToAvoid: textList("claimsToAvoid"),
    desiredOutcome:
      textField("desiredOutcome") || textField("mainPromise"),
    differentiator:
      textField("differentiator") || differentiators[0] || "",
    differentiators,
    mainProblem: textField("mainProblem"),
    mainPromise: textField("mainPromise"),
    painPoints: textList("painPoints"),
    primaryAudience:
      textField("primaryAudience") || targetAudience[0] || "",
    productSummary: textField("productSummary"),
    targetAudience,
    valueProps: textList("valueProps"),
  };
}

function buildBusinessEvidenceCatalog(
  businessContext: ReturnType<typeof extractBusinessContext>,
) {
  const evidence: HookEvidenceBinding[] = [];
  const addText = (key: string, text: string) => {
    if (text.trim()) {
      evidence.push({ key, text: text.trim() });
    }
  };
  const addList = (key: string, values: string[]) => {
    values.forEach((text, index) =>
      addText(`${key}.${index}`, text),
    );
  };

  addText("businessModel", businessContext.businessModel);
  addList("categories", businessContext.categories);
  addText("primaryAudience", businessContext.primaryAudience);
  addText("mainProblem", businessContext.mainProblem);
  addText("desiredOutcome", businessContext.desiredOutcome);
  addText("differentiator", businessContext.differentiator);
  addText("productSummary", businessContext.productSummary);
  addText("category", businessContext.category);
  addText("mainPromise", businessContext.mainPromise);
  addList("painPoints", businessContext.painPoints);
  addList("valueProps", businessContext.valueProps);
  addList("differentiators", businessContext.differentiators);
  addList("targetAudience", businessContext.targetAudience);

  return evidence;
}

function getGenerationPolicies() {
  return {
    emojiPolicy: {
      allowed: true,
      maximum: MAX_HOOK_EMOJIS,
      preferredPlacement: "end_of_final_line",
    },
    firstPersonPolicy:
      "Rhetorical first-person emotion is allowed only for the assigned format. Personal history and testimonials still require supplied evidence.",
    humorAllowed: true,
    numericClaimsPolicy:
      "Only exact numbers or durations present in selected evidence may be used, and only in a format that requires them.",
  } as const;
}

function normalizePerformanceSignals(
  value: HookTextPerformanceSignals | undefined,
): HookTextPerformanceSignals {
  const formatSignals = (value?.formatSignals ?? [])
    .filter((signal) => Boolean(getHookTextFormat(signal.formatId)))
    .map((signal) => ({
      formatId: signal.formatId,
      lastGeneratedAt:
        typeof signal.lastGeneratedAt === "string"
          ? signal.lastGeneratedAt
          : null,
      publishedResultCount: Math.max(
        0,
        Math.trunc(signal.publishedResultCount),
      ),
      selectionWeight: Math.min(
        1.3,
        Math.max(0.8, signal.selectionWeight),
      ),
      temporaryBoost: Math.min(
        0.12,
        Math.max(0, signal.temporaryBoost),
      ),
      timesGenerated: Math.max(0, Math.trunc(signal.timesGenerated)),
    }))
    .slice(0, 18);
  const preferredPurposes = [
    ...new Set(value?.preferredPurposes ?? []),
  ]
    .filter((purpose) =>
      [
        "product_discovery",
        "education",
        "conversion",
        "retargeting",
        "app_install",
      ].includes(purpose),
    )
    .slice(0, 3);

  return { formatSignals, preferredPurposes };
}

function toPromptSpec(spec: HookDraftSpec) {
  return {
    campaignPurpose: spec.campaignPurpose,
    campaignPurposeInstruction: getTrendingHookPurposeInstruction(
      spec.campaignPurpose,
    ),
    candidateIndex: spec.candidate.candidateIndex,
    draftKey: spec.draftKey,
    durationSeconds: spec.candidate.durationSeconds,
    maximumCharacters: MAX_HOOK_CHARACTERS,
    maximumLines: MAX_HOOK_LINES,
    maximumWords: MAX_HOOK_WORDS,
    maximumWordsPerLine: MAX_HOOK_WORDS_PER_LINE,
    hookTextFormat: {
      allowedTones: spec.format.allowedTones,
      canonicalTemplate: spec.format.canonicalTemplate,
      id: spec.format.id,
      instruction: spec.format.instruction,
      name: spec.format.name,
      requiredEvidence: spec.format.requiredEvidence,
      rhetoricalFirstPersonAllowed:
        spec.format.rhetoricalFirstPersonAllowed,
      surfaceVariants: spec.format.variants,
    },
    reactionType: spec.candidate.reactionType || "unspecified",
    visualGroup: spec.candidate.visualGroup || "unspecified",
  };
}

function createInputContextHash(value: unknown) {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableStringify(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeCandidates(
  candidates: TrendingHookCopyCandidate[],
) {
  if (
    candidates.length === 0 ||
    candidates.length > MAX_CANDIDATE_COUNT
  ) {
    throw new Error("Choose between one and twelve Hook candidates.");
  }

  const normalized = candidates.map((candidate) => ({
    ...candidate,
    candidateIndex: Math.trunc(candidate.candidateIndex),
    durationSeconds: normalizePositiveNumber(
      candidate.durationSeconds,
      "durationSeconds",
    ),
    influencerId: requireText(
      candidate.influencerId,
      "influencerId",
    ),
    influencerKey: optionalText(candidate.influencerKey),
    influencerName: requireText(
      candidate.influencerName,
      "influencerName",
    ),
    influencerVideoId: requireText(
      candidate.influencerVideoId,
      "influencerVideoId",
    ),
    influencerVideoTitle: requireText(
      candidate.influencerVideoTitle,
      "influencerVideoTitle",
    ),
    reactionType: optionalText(candidate.reactionType),
    sourceDurationSeconds: normalizePositiveNumber(
      candidate.sourceDurationSeconds,
      "sourceDurationSeconds",
    ),
    thumbnailUrl: optionalText(candidate.thumbnailUrl),
    trimEnd:
      candidate.trimEnd === null
        ? null
        : normalizePositiveNumber(candidate.trimEnd, "trimEnd"),
    trimStart: normalizeNonNegativeNumber(
      candidate.trimStart,
      "trimStart",
    ),
    visualGroup: optionalText(candidate.visualGroup),
  }));

  if (
    normalized.some(
      (candidate) =>
        candidate.candidateIndex < 0 ||
        candidate.durationSeconds >
          candidate.sourceDurationSeconds ||
        (candidate.trimEnd !== null &&
          candidate.trimEnd <= candidate.trimStart),
    ) ||
    new Set(
      normalized.map((candidate) => candidate.candidateIndex),
    ).size !== normalized.length
  ) {
    throw new Error("Hook candidate metadata is invalid.");
  }

  return normalized;
}

function replaceByDraftKey<T extends { draftKey: string }>(
  original: T[],
  replacements: T[],
) {
  const replacementsByKey = new Map(
    replacements.map((replacement) => [
      replacement.draftKey,
      replacement,
    ]),
  );

  return original.map(
    (item) => replacementsByKey.get(item.draftKey) ?? item,
  );
}

function normalizeHookLines(value: string | readonly string[]) {
  const rawLines = Array.isArray(value)
    ? value
    : String(value).replace(/\r\n?/gu, "\n").split("\n");

  return rawLines
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

function normalizeForComparison(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePositiveNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Hook candidates require a valid ${field}.`);
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeNonNegativeNumber(
  value: number,
  field: string,
) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Hook candidates require a valid ${field}.`);
  }

  return Math.round(value * 1000) / 1000;
}

function requireText(value: string, field: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Hook candidates require ${field}.`);
  }

  return normalized;
}

function optionalText(value: string | null) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : null;
}

function parseHookAudioIntent(value: unknown): HookAudioIntent | null {
  const intent = getRecord(value);

  if (!intent) {
    return null;
  }

  const keys = Object.keys(intent).sort();

  if (
    keys.length !== 3 ||
    keys[0] !== "energy" ||
    keys[1] !== "hookType" ||
    keys[2] !== "mood" ||
    typeof intent.mood !== "string" ||
    typeof intent.hookType !== "string" ||
    typeof intent.energy !== "string" ||
    !(HOOK_AUDIO_MOODS as readonly string[]).includes(intent.mood) ||
    !(HOOK_AUDIO_TYPES as readonly string[]).includes(intent.hookType) ||
    !(HOOK_AUDIO_ENERGIES as readonly string[]).includes(intent.energy)
  ) {
    return null;
  }

  return {
    energy: intent.energy as HookAudioIntent["energy"],
    hookType: intent.hookType as HookAudioIntent["hookType"],
    mood: intent.mood as HookAudioIntent["mood"],
  };
}

function getPositiveNumber(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? Math.round(value * 1000) / 1000
    : null;
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for Hook copy generation.",
    );
  }

  return new OpenAI({
    apiKey,
    maxRetries: 2,
    timeout: 60_000,
  });
}

const hookTextFormatIds = HOOK_TEXT_FORMATS.map(
  (format) => format.id,
);
const hookTextVariantIds = HOOK_TEXT_FORMATS.flatMap((format) =>
  format.variants.map((variant) => variant.id),
);

function buildHookDraftBatchSchema(
  evidenceCatalog: HookEvidenceBinding[],
  specs: HookDraftSpec[],
) {
  return {
    additionalProperties: false,
    properties: {
      hooks: {
        items: {
          additionalProperties: false,
          properties: {
            audioIntent: {
              additionalProperties: false,
              properties: {
                energy: {
                  enum: HOOK_AUDIO_ENERGIES,
                  type: "string",
                },
                hookType: {
                  enum: HOOK_AUDIO_TYPES,
                  type: "string",
                },
                mood: { enum: HOOK_AUDIO_MOODS, type: "string" },
              },
              required: ["mood", "hookType", "energy"],
              type: "object",
            },
            candidateIndex: { minimum: 0, type: "integer" },
            draftKey: {
              enum: specs.map((spec) => spec.draftKey),
              maxLength: 140,
              minLength: 3,
              type: "string",
            },
            evidenceKeys: {
              items: {
                enum: evidenceCatalog.map(
                  (evidence) => evidence.key,
                ),
                type: "string",
              },
              maxItems: MAX_EVIDENCE_BINDINGS,
              minItems: 1,
              type: "array",
            },
            lines: {
              items: {
                maxLength: MAX_HOOK_CHARACTERS,
                minLength: 1,
                type: "string",
              },
              maxItems: MAX_HOOK_LINES,
              minItems: 1,
              type: "array",
            },
            hookTextFormatId: {
              enum: hookTextFormatIds,
              type: "string",
            },
            hookTextVariantId: {
              enum: hookTextVariantIds,
              type: "string",
            },
          },
          required: [
            "audioIntent",
            "candidateIndex",
            "draftKey",
            "evidenceKeys",
            "lines",
            "hookTextFormatId",
            "hookTextVariantId",
          ],
          type: "object",
        },
        maxItems: specs.length,
        minItems: specs.length,
        type: "array",
      },
    },
    required: ["hooks"],
    type: "object",
  } as const;
}

function buildHookReviewBatchSchema(specs: HookDraftSpec[]) {
  return {
  additionalProperties: false,
  properties: {
    reviews: {
      items: {
        additionalProperties: false,
        properties: {
          candidateIndex: { minimum: 0, type: "integer" },
          claimSafe: { type: "boolean" },
          draftKey: {
            enum: specs.map((spec) => spec.draftKey),
            maxLength: 140,
            minLength: 3,
            type: "string",
          },
          estimatedReadingSeconds: {
            exclusiveMinimum: 0,
            type: "number",
          },
          humanVoice: { type: "boolean" },
          openingOnly: { type: "boolean" },
          readable: { type: "boolean" },
          reactionMatch: { type: "boolean" },
          reason: {
            maxLength: 500,
            minLength: 1,
            type: "string",
          },
          revisedLines: {
            items: {
              maxLength: 100,
              minLength: 1,
              type: "string",
            },
            maxItems: MAX_HOOK_LINES,
            type: "array",
          },
          scores: {
            additionalProperties: false,
            properties: {
              businessRelevance: {
                maximum: 20,
                minimum: 0,
                type: "integer",
              },
              claimSafety: {
                maximum: 10,
                minimum: 0,
                type: "integer",
              },
              humanVoice: {
                maximum: 15,
                minimum: 0,
                type: "integer",
              },
              originality: {
                maximum: 5,
                minimum: 0,
                type: "integer",
              },
              reactionMatch: {
                maximum: 20,
                minimum: 0,
                type: "integer",
              },
              readability: {
                maximum: 15,
                minimum: 0,
                type: "integer",
              },
              scrollStop: {
                maximum: 15,
                minimum: 0,
                type: "integer",
              },
            },
            required: [
              "businessRelevance",
              "claimSafety",
              "humanVoice",
              "originality",
              "reactionMatch",
              "readability",
              "scrollStop",
            ],
            type: "object",
          },
          scrollStopping: { type: "boolean" },
          singleIdea: { type: "boolean" },
          truthful: { type: "boolean" },
        },
        required: [
          "candidateIndex",
          "claimSafe",
          "draftKey",
          "estimatedReadingSeconds",
          "humanVoice",
          "openingOnly",
          "readable",
          "reactionMatch",
          "reason",
          "revisedLines",
          "scores",
          "scrollStopping",
          "singleIdea",
          "truthful",
        ],
        type: "object",
      },
      maxItems: specs.length,
      minItems: specs.length,
      type: "array",
    },
  },
  required: ["reviews"],
  type: "object",
  } as const;
}
