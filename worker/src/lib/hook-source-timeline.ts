/** Frozen only for new original-opening Hook jobs. Legacy jobs omit this field. */
export type HookSourceTimeline = {
  version: 1; policy: "source_speed"; referenceId: string; sourceSha256: string;
  sourceDurationSeconds: number; generatedDurationSeconds: number;
  actionDurationSeconds: number; trimEndMs: number;
};

type OpeningReceipt = { version: number; promptVersion: number; referenceId: string; sourceSha256: string;
  sourceFrame: { index: number; timeSeconds: number } };

export function createHookSourceTimeline(receipt: OpeningReceipt, sourceDurationSeconds: number, generatedDurationSeconds: number): HookSourceTimeline {
  if (receipt.version !== 5 || receipt.promptVersion !== 7 || receipt.sourceFrame.index !== 0 || receipt.sourceFrame.timeSeconds !== 0 ||
    !receipt.referenceId || !/^[a-f0-9]{64}$/.test(receipt.sourceSha256) ||
    !Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds < .001 || sourceDurationSeconds > 120 ||
    !Number.isInteger(generatedDurationSeconds) || generatedDurationSeconds < 3 || generatedDurationSeconds > 15)
    throw new Error("This original-opening action timeline could not be verified.");
  const actionDurationSeconds = Math.min(sourceDurationSeconds, generatedDurationSeconds);
  return { version: 1, policy: "source_speed", referenceId: receipt.referenceId, sourceSha256: receipt.sourceSha256,
    sourceDurationSeconds, generatedDurationSeconds, actionDurationSeconds, trimEndMs: Math.round(actionDurationSeconds * 1000) };
}

export function parseHookSourceTimeline(value: unknown, receipt: OpeningReceipt, generatedDurationSeconds: number): HookSourceTimeline {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This original-opening action timeline is missing.");
  const raw = value as Record<string, unknown>;
  const expected = createHookSourceTimeline(receipt, raw.sourceDurationSeconds as number, generatedDurationSeconds);
  if (Object.keys(raw).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => raw[key] !== value))
    throw new Error("This original-opening action timeline changed.");
  return expected;
}
