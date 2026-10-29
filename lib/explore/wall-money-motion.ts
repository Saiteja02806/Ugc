import catalog from "./wall-reference-motion-catalog.json" with { type: "json" };

/** Reviewed source directions only; generated image/video fidelity remains untested. */
export function getWallReferenceMotion(referenceId: string, sourceSha256: string, openingIndex = 0) {
  if (openingIndex !== 0) return undefined;
  const entry = catalog.entries.find(row => row.referenceId === referenceId && row.sourceSha256 === sourceSha256);
  if (!entry) return undefined;
  const duration = entry.sourceDurationSeconds;
  let cursor = 0;
  for (const beat of entry.beats) {
    if (Math.abs(beat.startSeconds - cursor) > 1e-6 || beat.endSeconds <= cursor || beat.endSeconds > duration + 1e-6) return undefined;
    cursor = beat.endSeconds;
  }
  if (Math.abs(cursor - duration) > 1e-6) return undefined;
  const fraction = (value: number) => Number((value / duration).toFixed(12)).toString();
  return [
    `OPENING COMPOSITION: ${entry.scene}`,
    ...entry.beats.map(beat => `PHASE [${fraction(beat.startSeconds)}–${fraction(beat.endSeconds)}]: ${beat.action}`),
    "Keep the approved person's identity, clothing, hand anatomy, accessories and scene continuous. Retain the observed gentle handheld movement and final framing. No added gestures, scene cuts or dramatic reaction. These phases cover the full performance and scale proportionally to the chosen output duration.",
  ].join("\n\n");
}

export const getWallMoneyMotion = getWallReferenceMotion;
