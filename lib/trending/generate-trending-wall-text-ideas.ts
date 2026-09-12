import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ParsedChatCompletion } from "openai/resources/chat/completions";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import {
  WALL_TEXT_CONTENT_RETRY_EXHAUSTED,
  WALL_TEXT_MODEL_OUTPUT_EMPTY,
  WALL_TEXT_MODEL_OUTPUT_REFUSAL,
  WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID,
  WallTextModelOutputError,
  WallTextStagedError,
  isWallTextRenderFitFailure,
  type WallTextCandidateRejection,
} from "@/lib/trending/wall-text-generation-failure";
import { getWallTextRepairBudget } from "./wall-text-repair-budget";
import {
  createAuthoritativeWallTextContent,
  deriveWallTextSpatialBudget,
} from "@/lib/trending/wall-layout-engine";
import {
  createWallTextDuplicateSignature,
  findWallTextDuplicate,
  type WallTextDuplicateSignature,
} from "@/lib/trending/wall-text-duplicate-logic";
import { buildWallTextGenerationPrompt } from "@/lib/trending/wall-prompt";
import type { WallTextPrivateCreativeContext } from "@/lib/trending/wall-text-db";
import { createWallTextLayout } from "@/lib/trending/wall-text-feed-logic";
import {
  buildWallTextBusinessContext,
  MAX_CURRENT_GENERATION_WALL_TEXT_WORDS,
  MIN_CURRENT_GENERATION_WALL_TEXT_WORDS,
  normalizeWallTextGenerationCandidates,
  type WallTextGenerationCandidate,
} from "@/lib/trending/wall-text-text-logic";
import {
  getWallTextGenerationWordBudget,
  WALL_TEXT_READING_CUSHION_RATIO,
  WALL_TEXT_READING_WORDS_PER_SECOND,
  WALL_TEXT_TARGET_WORDS,
} from "@/lib/trending/wall-text-copy-policy";
import {
  applyWallTextRenderFit,
  validateWallTextRenderFit,
} from "@/lib/trending/wall-text-render-validation";
import {
  WALL_TEXT_FREEFORM_PATTERN,
  type TrendingWallTextLayout,
} from "@/lib/trending/wall-text-types";

const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_WRITER_REASONING_EFFORT = "medium";
const DEFAULT_WRITER_REPAIR_REASONING_EFFORT = "medium";
const DEFAULT_REVIEW_REASONING_EFFORT = "medium";
// One initial pass plus two targeted replacements. Accepted candidates are
// persisted before a retry, so only the failed item is sent back to the writer.
const MAX_WRITER_RETRIES = 2;

const WallTextIdeaOutputSchema = z
  .object({
    ideas: z
      .array(
        z
          .object({
            candidateIndex: z.number().int().min(0),
            text: z.string().trim().min(8).max(600),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

const WallTextReviewSchema = z
  .object({
    reviews: z
      .array(
        z
          .object({
            approved: z.boolean(),
            candidateIndex: z.number().int().min(0),
            feedback: z.string().trim().min(1).max(300),
            naturalSpokenLanguage: z.boolean(),
            oneCentralThought: z.boolean(),
            readableWithinClip: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

const PROMOTIONAL_OR_CTA_PATTERNS = [
  /\b(?:book a call|download now|get started|join the waitlist|link in bio|shop now|try it|unlock your)\b/iu,
  /\b(?:game[- ]changer|revolutioni[sz]e|seamless(?:ly)?|supercharge)\b/iu,
] as const;

type GenerationInputCandidate = WallTextGenerationCandidate & {
  layout?: TrendingWallTextLayout;
  maxWords?: number;
  referenceText?: string;
  targetWords?: number;
  privateCreativeContext?: WallTextPrivateCreativeContext;
};

type PreparedCandidate = {
  candidateIndex: number;
  durationSeconds: number;
  layout: TrendingWallTextLayout;
  maxWords: number;
  minWords: number;
  referenceText?: string;
  targetWords: number;
  privateCreativeContext?: WallTextPrivateCreativeContext;
};

type WriterFailure = {
  avoidOpening?: string;
  candidateIndex: number;
  reason: string;
  rejectedText?: string;
  detail?: string;
};

export type GeneratedBusinessTrendingWallTextIdea = {
  candidateIndex: number;
  content: Awaited<ReturnType<typeof validateCandidate>>["content"];
  duplicateSignature: WallTextDuplicateSignature;
  layout: Awaited<ReturnType<typeof validateCandidate>>["layout"];
  maxWords: number;
  targetWords: number;
};

let openaiClient: OpenAI | null = null;

export function getTrendingWallTextModelName() {
  return process.env.OPENAI_WALL_TEXT_MODEL?.trim() || DEFAULT_MODEL;
}

export function getTrendingWallTextWriterReasoningEffort(params?: {
  repair?: boolean;
}) {
  const repair = params?.repair === true;
  return getReasoningEffort(
    repair
      ? process.env.OPENAI_WALL_TEXT_WRITER_REPAIR_REASONING_EFFORT
      : process.env.OPENAI_WALL_TEXT_WRITER_REASONING_EFFORT,
    repair
      ? DEFAULT_WRITER_REPAIR_REASONING_EFFORT
      : DEFAULT_WRITER_REASONING_EFFORT,
    repair
      ? "OPENAI_WALL_TEXT_WRITER_REPAIR_REASONING_EFFORT"
      : "OPENAI_WALL_TEXT_WRITER_REASONING_EFFORT",
  );
}

export function getTrendingWallTextReviewModelName() {
  return process.env.OPENAI_WALL_TEXT_REVIEW_MODEL?.trim() ||
    getTrendingWallTextModelName();
}

export function getTrendingWallTextReviewReasoningEffort() {
  return getReasoningEffort(
    process.env.OPENAI_WALL_TEXT_REVIEW_REASONING_EFFORT,
    DEFAULT_REVIEW_REASONING_EFFORT,
    "OPENAI_WALL_TEXT_REVIEW_REASONING_EFFORT",
  );
}

export async function generateBusinessTrendingWallTextIdeas(params: {
  business: WebsiteBusinessAnalysis;
  candidates: GenerationInputCandidate[];
  historicalSignatures?: readonly WallTextDuplicateSignature[];
  onChunkAccepted?: (
    ideas: readonly GeneratedBusinessTrendingWallTextIdea[],
  ) => Promise<void> | void;
}) {
  const normalized = normalizeWallTextGenerationCandidates(params.candidates);
  const inputByIndex = new Map(
    params.candidates.map((candidate) => [candidate.candidateIndex, candidate]),
  );
  const candidates = await Promise.all(
    normalized.map(async (candidate): Promise<PreparedCandidate> => {
      const input = inputByIndex.get(candidate.candidateIndex)!;
      const layout = input.layout ?? createWallTextLayout();
      const savedBudget = getSavedBudget(input, candidate.durationSeconds);
      const budget =
        savedBudget ??
        (await deriveWallTextSpatialBudget({
          durationSeconds: candidate.durationSeconds,
          layout,
        }));
      return {
        candidateIndex: candidate.candidateIndex,
        durationSeconds: candidate.durationSeconds,
        layout,
        maxWords: budget.maxWords,
        minWords: budget.minWords,
        ...(input.referenceText?.trim()
          ? { referenceText: normalizeText(input.referenceText) }
          : {}),
        ...(input.privateCreativeContext
          ? { privateCreativeContext: input.privateCreativeContext }
          : {}),
        targetWords: budget.targetWords,
      };
    }),
  );
  const business = buildWallTextBusinessContext(params.business);
  const accepted = new Map<number, Awaited<ReturnType<typeof validateCandidate>>>();
  const acceptedSignatures = [...(params.historicalSignatures ?? [])];

  for (const chunk of chunkCandidates(candidates)) {
    let pending = chunk;
    let retryFeedback = new Map<number, WriterFailure>();

    for (let attempt = 0; pending.length > 0 && attempt <= MAX_WRITER_RETRIES; attempt += 1) {
      const ideas = await requestWriter({
        business,
        candidates: pending.map((candidate) => ({
          ...candidate,
          ...(retryFeedback.get(candidate.candidateIndex)
            ? { retryFeedback: retryFeedback.get(candidate.candidateIndex) }
            : {}),
        })),
        reasoningEffort: getTrendingWallTextWriterReasoningEffort({
          repair: attempt > 0,
        }),
      });
      const ideasByIndex = groupIdeasByIndex(ideas);
      const failures: WriterFailure[] = [];
      const newlyAccepted: PreparedCandidate[] = [];
      const validated = new Map<
        number,
        Awaited<ReturnType<typeof validateCandidate>>
      >();
      const validatedSignatures: WallTextDuplicateSignature[] = [];

      for (const candidate of pending) {
        const outputs = ideasByIndex.get(candidate.candidateIndex) ?? [];
        if (outputs.length !== 1) {
          failures.push({
            candidateIndex: candidate.candidateIndex,
            reason: outputs.length === 0 ? "missing_candidate" : "duplicate_candidate_mapping",
          });
          continue;
        }
        try {
          const result = await validateCandidate({
            business,
            candidate,
            historicalSignatures: [...acceptedSignatures, ...validatedSignatures],
            text: outputs[0]!.text,
          });
          validated.set(candidate.candidateIndex, result);
          validatedSignatures.push(result.duplicateSignature);
        } catch (error) {
          if (!(error instanceof CandidateValidationError)) throw error;
          const failure = toWriterFailure(candidate.candidateIndex, error);
          if (failure.reason === "layout_fit") {
            failure.rejectedText = outputs[0]!.text;
            failure.detail = error.message;
          }
          failures.push(failure);
        }
      }

      if (validated.size > 0) {
        const reviews = await requestReviewer({
          business,
          candidates: pending.filter((candidate) =>
            validated.has(candidate.candidateIndex),
          ),
          textByCandidateIndex: new Map(
            [...validated.entries()].map(([candidateIndex, result]) => [
              candidateIndex,
              result.content.fullText,
            ]),
          ),
        });

        for (const candidate of pending) {
          const result = validated.get(candidate.candidateIndex);
          if (!result) continue;
          const review = reviews.get(candidate.candidateIndex);
          if (!review) {
            throw new WallTextModelOutputError({
              code: WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID,
              message: `Wall-of-text Reviewer omitted candidate ${candidate.candidateIndex}.`,
            });
          }
          if (
            !review.approved ||
            !review.readableWithinClip ||
            !review.oneCentralThought ||
            !review.naturalSpokenLanguage
          ) {
            failures.push({
              candidateIndex: candidate.candidateIndex,
              detail: review.feedback,
              reason: "reviewer_rejected",
              rejectedText: result.content.fullText,
            });
            continue;
          }
          accepted.set(candidate.candidateIndex, result);
          acceptedSignatures.push(result.duplicateSignature);
          newlyAccepted.push(candidate);
        }
      }

      if (params.onChunkAccepted && newlyAccepted.length > 0) {
        await params.onChunkAccepted(
          newlyAccepted.map((candidate) =>
            buildGeneratedIdea({
              accepted,
              candidate,
            }),
          ),
        );
      }

      if (failures.length === 0) {
        pending = [];
        break;
      }
      if (attempt === MAX_WRITER_RETRIES) {
        throw new WallTextCandidateRepairExhaustedError(
          `Wall-of-text Writer could not repair candidates: ${failures
            .map((failure) => `${failure.candidateIndex}:${failure.reason}`)
            .join(", ")}.`,
          failures.map(({ candidateIndex, detail, reason }) => ({
            candidateIndex,
            ...(detail ? { detail } : {}),
            reason,
          })),
        );
      }
      retryFeedback = new Map(
        failures.map((failure) => [failure.candidateIndex, failure]),
      );
      pending = failures.map((failure) => {
        const candidate = pending.find((entry) => entry.candidateIndex === failure.candidateIndex)!;
        return failure.reason === "layout_fit"
          ? { ...candidate, ...getWallTextRepairBudget(candidate) }
          : candidate;
      });
    }

  }

  return candidates.map((candidate) =>
    buildGeneratedIdea({ accepted, candidate }),
  );
}

export class WallTextCandidateRepairExhaustedError extends Error {
  readonly code = WALL_TEXT_CONTENT_RETRY_EXHAUSTED;
  readonly candidateRejections: WallTextCandidateRejection[];

  constructor(
    message: string,
    candidateRejections: readonly WallTextCandidateRejection[] = [],
  ) {
    super(message);
    this.name = "WallTextCandidateRepairExhaustedError";
    this.candidateRejections = candidateRejections.map((rejection) => ({
      ...rejection,
    }));
  }
}

function buildGeneratedIdea(params: {
  accepted: ReadonlyMap<number, Awaited<ReturnType<typeof validateCandidate>>>;
  candidate: PreparedCandidate;
}): GeneratedBusinessTrendingWallTextIdea {
  const result = params.accepted.get(params.candidate.candidateIndex);
  if (!result) {
    throw new Error("A Wall-of-text candidate was not completed.");
  }
  return {
    candidateIndex: params.candidate.candidateIndex,
    content: result.content,
    duplicateSignature: result.duplicateSignature,
    layout: result.layout,
    maxWords: params.candidate.maxWords,
    targetWords: params.candidate.targetWords,
  };
}

function getSavedBudget(
  candidate: GenerationInputCandidate,
  durationSeconds: number,
) {
  if (
    Number.isInteger(candidate.targetWords) &&
    Number.isInteger(candidate.maxWords) &&
    candidate.targetWords! > 0 &&
    candidate.maxWords! >= candidate.targetWords! &&
    candidate.maxWords! >= MIN_CURRENT_GENERATION_WALL_TEXT_WORDS
  ) {
    const spatialMaximum = Math.min(
      candidate.maxWords!,
      MAX_CURRENT_GENERATION_WALL_TEXT_WORDS,
    );
    const wordBudget = getWallTextGenerationWordBudget({
      durationSeconds,
      spatialMaximum,
    });
    return {
      maxWords: wordBudget.maximum,
      minWords: wordBudget.minimum,
      // Existing retry-pending assignments may still contain 18/50. Preserve
      // those rows, but generate their retry with the readable current budget.
      targetWords: Math.min(WALL_TEXT_TARGET_WORDS, wordBudget.target),
    };
  }
  return null;
}

async function requestWriter(params: {
  business: ReturnType<typeof buildWallTextBusinessContext>;
  candidates: Array<PreparedCandidate & { retryFeedback?: WriterFailure }>;
  reasoningEffort: ReturnType<typeof getTrendingWallTextWriterReasoningEffort>;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey, maxRetries: 0, timeout: 60_000 });
  let completion: ParsedChatCompletion<z.infer<typeof WallTextIdeaOutputSchema>>;
  try {
    completion = await openaiClient.chat.completions.parse({
      model: getTrendingWallTextModelName(),
      reasoning_effort: params.reasoningEffort,
      messages: [
        {
          role: "system",
          content:
            "You write grounded Wall-of-Text social copy. Return one complete plain text message per assigned candidate. A separate Reviewer will judge the result.",
        },
        {
          role: "user",
          content: buildWallTextGenerationPrompt({
            business: params.business,
            candidates: params.candidates,
          }),
        },
      ],
      response_format: zodResponseFormat(
        WallTextIdeaOutputSchema,
        "trending_wall_text_ideas_v8",
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new WallTextModelOutputError({
        code: WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID,
        message: "The Wall-of-text Writer returned an invalid structured response.",
      });
    }
    throw new WallTextStagedError("writer", error);
  }
  const choice = completion.choices[0];
  if (choice?.message.refusal?.trim()) {
    throw new WallTextModelOutputError({
      code: WALL_TEXT_MODEL_OUTPUT_REFUSAL,
      finishReason: choice.finish_reason ?? null,
      message: "The Wall-of-text Writer refused the requested content.",
    });
  }
  const parsed = choice?.message.parsed;
  if (!parsed) {
    throw new WallTextModelOutputError({
      code: WALL_TEXT_MODEL_OUTPUT_EMPTY,
      finishReason: choice?.finish_reason ?? null,
      message: "The Wall-of-text Writer returned no structured ideas.",
    });
  }
  return parsed.ideas;
}

async function requestReviewer(params: {
  business: ReturnType<typeof buildWallTextBusinessContext>;
  candidates: PreparedCandidate[];
  textByCandidateIndex: ReadonlyMap<number, string>;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey, maxRetries: 0, timeout: 60_000 });
  let completion: ParsedChatCompletion<z.infer<typeof WallTextReviewSchema>>;
  try {
    completion = await openaiClient.chat.completions.parse({
      model: getTrendingWallTextReviewModelName(),
      reasoning_effort: getTrendingWallTextReviewReasoningEffort(),
      messages: [
        {
          role: "system",
          content: [
            "You independently review Wall-of-Text social overlays. Do not rewrite them.",
            "Approve only when a viewer can understand the complete copy on first read during one native play.",
            "The copy needs one concrete daily action, one central thought, natural spoken language, and only supported business claims.",
            "Reject semicolon-linked marketing mini-stories, feature stacking, forced emotional conclusions, and product mentions that are not needed for the thought.",
            "Keep every boolean consistent with approved and feedback.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            business: params.business,
            candidates: params.candidates.map((candidate) => ({
              candidateIndex: candidate.candidateIndex,
              durationSeconds: candidate.durationSeconds,
              ...(candidate.privateCreativeContext
                ? {
                    plan: {
                      contentIdea: candidate.privateCreativeContext.contentIdea,
                      humanMoment:
                        candidate.privateCreativeContext.planningBrief.humanMoment,
                      supportedAngle:
                        candidate.privateCreativeContext.planningBrief.supportedAngle,
                    },
                  }
                : {}),
              text: params.textByCandidateIndex.get(candidate.candidateIndex),
            })),
            readingRule:
              "Use 3.2 words per second and require roughly fifteen percent of the clip as reading cushion.",
          }),
        },
      ],
      response_format: zodResponseFormat(
        WallTextReviewSchema,
        "trending_wall_text_review_v8",
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new WallTextModelOutputError({
        code: WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID,
        message: "The Wall-of-text Reviewer returned an invalid structured response.",
      });
    }
    throw new WallTextStagedError("reviewer", error);
  }
  const choice = completion.choices[0];
  if (choice?.message.refusal?.trim()) {
    throw new WallTextModelOutputError({
      code: WALL_TEXT_MODEL_OUTPUT_REFUSAL,
      finishReason: choice.finish_reason ?? null,
      message: "The Wall-of-text Reviewer refused the requested review.",
    });
  }
  const parsed = choice?.message.parsed;
  if (!parsed) {
    throw new WallTextModelOutputError({
      code: WALL_TEXT_MODEL_OUTPUT_EMPTY,
      finishReason: choice?.finish_reason ?? null,
      message: "The Wall-of-text Reviewer returned no structured review.",
    });
  }

  const expectedCandidateIndexes = new Set(
    params.candidates.map((candidate) => candidate.candidateIndex),
  );
  const reviews = new Map<
    number,
    z.infer<typeof WallTextReviewSchema>["reviews"][number]
  >();
  for (const review of parsed.reviews) {
    if (!expectedCandidateIndexes.has(review.candidateIndex) || reviews.has(review.candidateIndex)) {
      throw new WallTextModelOutputError({
        code: WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID,
        message: "The Wall-of-text Reviewer returned an invalid review mapping.",
      });
    }
    reviews.set(review.candidateIndex, review);
  }
  if (reviews.size !== params.candidates.length) {
    throw new WallTextModelOutputError({
      code: WALL_TEXT_MODEL_OUTPUT_SCHEMA_INVALID,
      message: "The Wall-of-text Reviewer did not review every candidate.",
    });
  }
  return reviews;
}

async function validateCandidate(params: {
  business: ReturnType<typeof buildWallTextBusinessContext>;
  candidate: PreparedCandidate;
  historicalSignatures: readonly WallTextDuplicateSignature[];
  text: string;
}) {
  const text = normalizeText(params.text);
  const wordCount = countWords(text);
  if (
    wordCount < params.candidate.minWords ||
    wordCount > params.candidate.maxWords
  ) {
    throw new CandidateValidationError("word_limit");
  }
  if (!/[.!?]["')]?$/u.test(text)) {
    throw new CandidateValidationError("incomplete_sentence");
  }
  const sentenceCount = text.match(/[.!?](?=\s|$)/gu)?.length ?? 0;
  if (sentenceCount < 1 || sentenceCount > 2) {
    throw new CandidateValidationError("sentence_structure");
  }
  if (text.includes(";")) {
    throw new CandidateValidationError("semicolon_story");
  }
  const estimatedReadingSeconds =
    wordCount / WALL_TEXT_READING_WORDS_PER_SECOND +
    Math.max(0, sentenceCount - 1) * 0.25;
  if (
    estimatedReadingSeconds >
    params.candidate.durationSeconds * WALL_TEXT_READING_CUSHION_RATIO
  ) {
    throw new CandidateValidationError("reading_time");
  }
  if (PROMOTIONAL_OR_CTA_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new CandidateValidationError("promotional_or_cta");
  }
  const normalizedComparison = normalizeComparison(text);
  for (const avoidedClaim of params.business.claimsToAvoid) {
    const normalizedClaim = normalizeComparison(avoidedClaim);
    if (normalizedClaim.length >= 5 && normalizedComparison.includes(normalizedClaim)) {
      throw new CandidateValidationError("forbidden_claim");
    }
  }

  const duplicateSignature = createWallTextDuplicateSignature(text);
  const duplicate = findWallTextDuplicate({
    candidate: duplicateSignature,
    history: params.historicalSignatures,
  });
  if (duplicate) {
    const matched = params.historicalSignatures.find(
      (entry) => entry.contentHash === duplicate.matchedContentHash,
    );
    throw new CandidateValidationError(
      duplicate.reason,
      matched?.opening || duplicateSignature.opening,
    );
  }

  try {
    const authoritative = await createAuthoritativeWallTextContent({
      content: { kind: "text", text },
      formatId: WALL_TEXT_FREEFORM_PATTERN,
      layout: params.candidate.layout,
    });
    const render = await validateWallTextRenderFit(authoritative.content);
    return {
      ...authoritative,
      content: applyWallTextRenderFit(authoritative.content, render),
      duplicateSignature,
    };
  } catch (error) {
    if (!isWallTextRenderFitFailure(error)) throw error;
    throw new CandidateValidationError("layout_fit", undefined, error instanceof Error ? error.message : undefined);
  }
}

function groupIdeasByIndex(
  ideas: Array<z.infer<typeof WallTextIdeaOutputSchema>["ideas"][number]>,
) {
  const grouped = new Map<number, typeof ideas>();
  for (const idea of ideas) {
    const current = grouped.get(idea.candidateIndex) ?? [];
    current.push(idea);
    grouped.set(idea.candidateIndex, current);
  }
  return grouped;
}

function chunkCandidates(candidates: readonly PreparedCandidate[]) {
  const chunks: PreparedCandidate[][] = [];
  for (let start = 0; start < candidates.length; start += 10) {
    chunks.push(candidates.slice(start, start + 10));
  }
  return chunks;
}

class CandidateValidationError extends Error {
  constructor(
    readonly reason: string,
    readonly avoidOpening?: string,
    detail?: string,
  ) {
    super(detail ?? reason);
  }
}

function toWriterFailure(candidateIndex: number, error: unknown): WriterFailure {
  return error instanceof CandidateValidationError
    ? {
        ...(error.avoidOpening ? { avoidOpening: error.avoidOpening } : {}),
        candidateIndex,
        ...(error.message && error.message !== error.reason
          ? { detail: error.message }
          : {}),
        reason: error.reason,
      }
    : { candidateIndex, reason: "validation_failed" };
}

function normalizeText(value: string) {
  return value.replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function normalizeComparison(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function countWords(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function getReasoningEffort(
  value: string | undefined,
  fallback: "low" | "medium",
  variableName: string,
) {
  const normalized = value?.trim().toLocaleLowerCase("en-US") || fallback;
  if (normalized === "none" || normalized === "low" || normalized === "medium") {
    return normalized;
  }
  throw new Error(`${variableName} must be none, low, or medium.`);
}
