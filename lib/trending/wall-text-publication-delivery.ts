type PublicationReconciliationResult = {
  error?: unknown;
};

/**
 * A task must receive a non-2xx response when its claimed outbox event could
 * not be admitted. Cloud Tasks can then retry the exact event promptly.
 */
export function wallTextPublicationNeedsRetry(
  results: readonly PublicationReconciliationResult[],
) {
  return results.some((result) => Boolean(result.error));
}
