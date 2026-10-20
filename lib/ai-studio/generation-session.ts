export function appendAIStudioSessionResultIds(
  currentIds: readonly string[],
  resultId: string,
) {
  return currentIds.includes(resultId) ? [...currentIds] : [...currentIds, resultId];
}

export function getAIStudioSessionResults<Result extends { id: string }>(
  results: readonly Result[],
  sessionResultIds: readonly string[],
  selectedHistoryResultId: string | null = null,
) {
  const resultsById = new Map(results.map((result) => [result.id, result]));
  const visibleIds = selectedHistoryResultId ? [selectedHistoryResultId] : sessionResultIds;
  return [...new Set(visibleIds)].flatMap((id) => {
    const result = resultsById.get(id);
    return result ? [result] : [];
  });
}

export function isAIStudioSessionCompletion(
  jobId: string,
  completionEpoch: number,
  currentEpoch: number,
  sessionJobIds: ReadonlySet<string>,
) {
  return completionEpoch === currentEpoch && sessionJobIds.has(jobId);
}
