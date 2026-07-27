const MAX_HOOK_IDEA_COUNT = 12;

export type TrendingHookTextCandidate = {
  candidateIndex: number;
  durationSeconds: number;
};

export type GeneratedTrendingHookText = {
  candidateIndex: number;
  text: string;
};

export function getTrendingHookMaximumWords(durationSeconds: number) {
  return Math.min(
    18,
    Math.max(6, Math.round(normalizeDuration(durationSeconds) * 2.75)),
  );
}

export function validateGeneratedTrendingHookTexts(params: {
  candidates: TrendingHookTextCandidate[];
  generated: GeneratedTrendingHookText[];
}) {
  const candidates = normalizeTrendingHookCandidates(params.candidates);
  const candidateByIndex = new Map(
    candidates.map((candidate) => [candidate.candidateIndex, candidate]),
  );
  const generatedByIndex = new Map<number, string>();

  for (const hook of params.generated) {
    const candidate = candidateByIndex.get(hook.candidateIndex);
    const text = hook.text.trim();

    if (!candidate || generatedByIndex.has(hook.candidateIndex)) {
      throw new Error("The AI returned an invalid Hook candidate mapping.");
    }

    if (
      text.split(/\s+/u).filter(Boolean).length >
      getTrendingHookMaximumWords(candidate.durationSeconds)
    ) {
      throw new Error("The AI returned Hook text that is too long to read.");
    }

    generatedByIndex.set(hook.candidateIndex, text);
  }

  if (generatedByIndex.size !== candidates.length) {
    throw new Error("The AI did not return one Hook for every candidate.");
  }

  return candidates.map((candidate) => ({
    candidateIndex: candidate.candidateIndex,
    text: generatedByIndex.get(candidate.candidateIndex)!,
  }));
}

export function normalizeTrendingHookCandidates(
  candidates: TrendingHookTextCandidate[],
) {
  if (
    candidates.length === 0 ||
    candidates.length > MAX_HOOK_IDEA_COUNT
  ) {
    throw new Error("Choose between one and twelve Hook candidates.");
  }

  const normalized = candidates.map((candidate) => ({
    candidateIndex: Math.trunc(candidate.candidateIndex),
    durationSeconds: normalizeDuration(candidate.durationSeconds),
  }));

  if (
    normalized.some(
      (candidate) =>
        candidate.candidateIndex < 0 ||
        !Number.isInteger(candidate.candidateIndex),
    ) ||
    new Set(normalized.map((candidate) => candidate.candidateIndex)).size !==
      normalized.length
  ) {
    throw new Error("Hook candidate indexes must be unique non-negative integers.");
  }

  return normalized;
}

function normalizeDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Hook candidates require a valid video duration.");
  }

  return Math.round(durationSeconds * 1000) / 1000;
}
