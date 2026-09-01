import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
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
  MAX_CURRENT_WALL_TEXT_WORDS,
  MIN_SHORT_WALL_TEXT_WORDS,
  normalizeWallTextGenerationCandidates,
  type WallTextGenerationCandidate,
} from "@/lib/trending/wall-text-text-logic";
import {
  applyWallTextRenderFit,
  validateWallTextRenderFit,
} from "@/lib/trending/wall-text-render-validation";
import {
  WALL_TEXT_FREEFORM_PATTERN,
  type TrendingWallTextLayout,
} from "@/lib/trending/wall-text-types";

const DEFAULT_MODEL = "gpt-5-mini";
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
  referenceText?: string;
  targetWords: number;
  privateCreativeContext?: WallTextPrivateCreativeContext;
};

type WriterFailure = {
  avoidOpening?: string;
  candidateIndex: number;
  reason: string;
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
      const savedBudget = getSavedBudget(input);
      const budget =
        savedBudget ??
        (await deriveWallTextSpatialBudget({
          layout,
        }));
      return {
        candidateIndex: candidate.candidateIndex,
        durationSeconds: candidate.durationSeconds,
        layout,
        maxWords: budget.maxWords,
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
  const candidateByIndex = new Map(
    candidates.map((candidate) => [candidate.candidateIndex, candidate]),
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
      });
      const ideasByIndex = groupIdeasByIndex(ideas);
      const failures: WriterFailure[] = [];
      const newlyAccepted: PreparedCandidate[] = [];

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
            historicalSignatures: acceptedSignatures,
            text: outputs[0]!.text,
          });
          accepted.set(candidate.candidateIndex, result);
          acceptedSignatures.push(result.duplicateSignature);
          newlyAccepted.push(candidate);
        } catch (error) {
          const failure = toWriterFailure(candidate.candidateIndex, error);
          failures.push(failure);
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
        );
      }
      retryFeedback = new Map(
        failures.map((failure) => [failure.candidateIndex, failure]),
      );
      pending = failures.map((failure) => candidateByIndex.get(failure.candidateIndex)!);
    }

  }

  return candidates.map((candidate) =>
    buildGeneratedIdea({ accepted, candidate }),
  );
}

export class WallTextCandidateRepairExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WallTextCandidateRepairExhaustedError";
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

function getSavedBudget(candidate: GenerationInputCandidate) {
  if (
    Number.isInteger(candidate.targetWords) &&
    Number.isInteger(candidate.maxWords) &&
    candidate.targetWords! > 0 &&
    candidate.maxWords! >= candidate.targetWords! &&
    candidate.maxWords! <= MAX_CURRENT_WALL_TEXT_WORDS
  ) {
    return {
      maxWords: candidate.maxWords!,
      targetWords: candidate.targetWords!,
    };
  }
  return null;
}

async function requestWriter(params: {
  business: ReturnType<typeof buildWallTextBusinessContext>;
  candidates: Array<PreparedCandidate & { retryFeedback?: WriterFailure }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });
  const completion = await openaiClient.chat.completions.parse({
    model: getTrendingWallTextModelName(),
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content:
          "You write grounded Wall-of-Text social copy. Return one complete plain text message per assigned candidate and silently review it in the same response.",
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
      "trending_wall_text_ideas_v7",
    ),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("OpenAI returned no structured Wall-of-text ideas.");
  return parsed.ideas;
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
    wordCount < MIN_SHORT_WALL_TEXT_WORDS ||
    wordCount > params.candidate.maxWords
  ) {
    throw new CandidateValidationError("word_limit");
  }
  if (!/[.!?]["')]?$/u.test(text)) {
    throw new CandidateValidationError("incomplete_sentence");
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
  } catch {
    throw new CandidateValidationError("layout_fit");
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
  ) {
    super(reason);
  }
}

function toWriterFailure(candidateIndex: number, error: unknown): WriterFailure {
  return error instanceof CandidateValidationError
    ? {
        ...(error.avoidOpening ? { avoidOpening: error.avoidOpening } : {}),
        candidateIndex,
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
