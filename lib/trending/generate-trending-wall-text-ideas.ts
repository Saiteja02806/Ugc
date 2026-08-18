import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";
import {
  createAuthoritativeWallTextContent,
  deriveWallTextReadabilityBudget,
} from "@/lib/trending/wall-layout-engine";
import {
  createWallTextDuplicateSignature,
  findWallTextDuplicate,
  type WallTextDuplicateSignature,
} from "@/lib/trending/wall-text-duplicate-logic";
import type { WallTextPerformanceSignals } from "@/lib/trending/wall-format-performance-logic";
import {
  chunkWallTextAssignments,
  selectWallTextFormatAssignments,
  type WallTextFormatAssignment,
} from "@/lib/trending/wall-format-selector";
import { buildWallTextGenerationPrompt } from "@/lib/trending/wall-prompt";
import { createWallTextLayout } from "@/lib/trending/wall-text-feed-logic";
import {
  buildWallTextBusinessContext,
  normalizeWallTextGenerationCandidates,
  type WallTextGenerationCandidate,
} from "@/lib/trending/wall-text-text-logic";
import type {
  TrendingWallTextLayout,
  WallTextFormatId,
} from "@/lib/trending/wall-text-types";

const DEFAULT_MODEL = "gpt-5-mini";
const MAX_WRITER_RETRIES = 1;

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
  assignedFormatId?: WallTextFormatId;
  layout?: TrendingWallTextLayout;
  maxWords?: number;
  referenceText?: string;
  targetWords?: number;
};

type PreparedCandidate = {
  assignedFormatId: WallTextFormatId;
  candidateIndex: number;
  durationSeconds: number;
  layout: TrendingWallTextLayout;
  maxWords: number;
  referenceText?: string;
  targetWords: number;
};

type WriterFailure = {
  avoidOpening?: string;
  candidateIndex: number;
  reason: string;
};

export type GeneratedBusinessTrendingWallTextIdea = {
  assignment: WallTextFormatAssignment;
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
  assignments?: readonly WallTextFormatAssignment[];
  business: WebsiteBusinessAnalysis;
  candidates: GenerationInputCandidate[];
  historicalSignatures?: readonly WallTextDuplicateSignature[];
  onChunkAccepted?: (
    ideas: readonly GeneratedBusinessTrendingWallTextIdea[],
  ) => Promise<void> | void;
  performanceSignals?: WallTextPerformanceSignals;
  selectionKey?: string;
}) {
  const normalized = normalizeWallTextGenerationCandidates(params.candidates);
  const inputByIndex = new Map(
    params.candidates.map((candidate) => [candidate.candidateIndex, candidate]),
  );
  const assignments = resolveAssignments({
    assignments: params.assignments,
    business: params.business,
    candidateIndexes: normalized.map((candidate) => candidate.candidateIndex),
    performanceSignals: params.performanceSignals,
    selectionKey: params.selectionKey,
  });
  const assignmentByIndex = new Map(
    assignments.map((assignment) => [assignment.candidateIndex, assignment]),
  );
  const candidates = await Promise.all(
    normalized.map(async (candidate): Promise<PreparedCandidate> => {
      const input = inputByIndex.get(candidate.candidateIndex)!;
      const assignment = assignmentByIndex.get(candidate.candidateIndex);
      if (!assignment) throw new Error("Wall-of-text format assignment is missing.");
      const layout = input.layout ?? createWallTextLayout();
      const savedBudget = getSavedBudget(input);
      const budget = savedBudget ?? await deriveWallTextReadabilityBudget({
          durationSeconds: candidate.durationSeconds,
          formatId: assignment.assignedFormatId,
          layout,
        });
      return {
        assignedFormatId: assignment.assignedFormatId,
        candidateIndex: candidate.candidateIndex,
        durationSeconds: candidate.durationSeconds,
        layout,
        maxWords: budget.maxWords,
        ...(input.referenceText?.trim()
          ? { referenceText: normalizeText(input.referenceText) }
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

  for (const assignmentChunk of chunkWallTextAssignments(assignments)) {
    const chunk = assignmentChunk.map((assignment) =>
      candidateByIndex.get(assignment.candidateIndex)!,
    );
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
              assignmentByIndex,
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
    buildGeneratedIdea({ accepted, assignmentByIndex, candidate }),
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
  assignmentByIndex: ReadonlyMap<number, WallTextFormatAssignment>;
  candidate: PreparedCandidate;
}): GeneratedBusinessTrendingWallTextIdea {
  const result = params.accepted.get(params.candidate.candidateIndex);
  const assignment = params.assignmentByIndex.get(params.candidate.candidateIndex);
  if (!result || !assignment) {
    throw new Error("A Wall-of-text candidate was not completed.");
  }
  return {
    assignment,
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
    candidate.maxWords! >= candidate.targetWords!
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
  const minimumWords = Math.max(8, Math.min(params.candidate.targetWords - 4, params.candidate.maxWords));
  if (wordCount < minimumWords || wordCount > params.candidate.maxWords) {
    throw new CandidateValidationError("word_limit");
  }
  if (!/[.!?]["')]?$/u.test(text)) {
    throw new CandidateValidationError("incomplete_sentence");
  }
  if (PROMOTIONAL_OR_CTA_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new CandidateValidationError("promotional_or_cta");
  }
  if (params.candidate.assignedFormatId === "community_question") {
    const questionCount = [...text].filter((character) => character === "?").length;
    if (questionCount !== 1 || !text.endsWith("?")) {
      throw new CandidateValidationError("community_question_shape");
    }
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
      formatId: params.candidate.assignedFormatId,
      layout: params.candidate.layout,
    });
    return { ...authoritative, duplicateSignature };
  } catch {
    throw new CandidateValidationError("layout_fit");
  }
}

function resolveAssignments(params: {
  assignments?: readonly WallTextFormatAssignment[];
  business: WebsiteBusinessAnalysis;
  candidateIndexes: readonly number[];
  performanceSignals?: WallTextPerformanceSignals;
  selectionKey?: string;
}) {
  if (params.assignments) {
    const requested = new Set(params.candidateIndexes);
    if (
      params.assignments.length !== requested.size ||
      params.assignments.some((assignment) => !requested.has(assignment.candidateIndex))
    ) {
      throw new Error("Wall-of-text assignments do not match the video candidates.");
    }
    return [...params.assignments];
  }
  const selected = selectWallTextFormatAssignments({
    candidateCount: params.candidateIndexes.length,
    performanceSignals: params.performanceSignals,
    selectionKey:
      params.selectionKey ?? params.business.businessName ?? "wall-text",
  });
  return selected.map((assignment, index) => ({
    ...assignment,
    candidateIndex: params.candidateIndexes[index]!,
  }));
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
