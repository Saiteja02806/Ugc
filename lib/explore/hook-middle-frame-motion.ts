import publicData from "./hook-middle-frame-public.json" with { type: "json" };
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import type { HookMotionPlan } from "./hook-keyframe-motion.ts";

export type MiddleFrameMotionEntry = {
  referenceId: string;
  sourceSha256: string;
  sourceDurationSeconds: number;
  sourceFps: number;
  sourceFrameCount: number;
  clarityFrame: { index: number; timeSeconds: number; sha256: string; presentationTimeSeconds?: number };
  openingState: string;
  camera: string;
  beats: readonly { startSeconds: number; endSeconds: number; action: string }[];
  endingState: string;
  captionCleanup: { text: string; region: string };
  openingImageRequirement: string;
  constraints?: readonly string[];
  risks?: readonly string[];
  visualQualification: "not_tested";
};

const entries = publicData.entries as readonly MiddleFrameMotionEntry[];
const epsilon = 1e-6;
const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());

/** Source-bound data validation, not a claim of generated-output fidelity. */
export function validateMiddleFrameMotionEntry(entry: MiddleFrameMotionEntry): boolean {
  if (!entry || !text(entry.referenceId) || !/^[a-f0-9]{64}$/.test(entry.sourceSha256) ||
    !Number.isFinite(entry.sourceDurationSeconds) || entry.sourceDurationSeconds <= 0 ||
    !Number.isFinite(entry.sourceFps) || entry.sourceFps <= 0 ||
    !Number.isSafeInteger(entry.sourceFrameCount) || entry.sourceFrameCount < 1 ||
    Math.abs(entry.sourceFrameCount / entry.sourceFps - entry.sourceDurationSeconds) > epsilon ||
    !entry.clarityFrame || !Number.isSafeInteger(entry.clarityFrame.index) || entry.clarityFrame.index <= 0 || entry.clarityFrame.index >= entry.sourceFrameCount ||
    !Number.isFinite(entry.clarityFrame.timeSeconds) || entry.clarityFrame.timeSeconds <= 0 || entry.clarityFrame.timeSeconds >= entry.sourceDurationSeconds ||
    !/^[a-f0-9]{64}$/.test(entry.clarityFrame.sha256) ||
    ![entry.openingState, entry.camera, entry.endingState, entry.openingImageRequirement].every(text) ||
    !Array.isArray(entry.beats) || !entry.beats.length || entry.visualQualification !== "not_tested") return false;
  let cursor = 0;
  for (const beat of entry.beats) {
    if (!beat || !Number.isFinite(beat.startSeconds) || Math.abs(cursor - beat.startSeconds) > epsilon ||
      !Number.isFinite(beat.endSeconds) || beat.endSeconds <= beat.startSeconds || beat.endSeconds > entry.sourceDurationSeconds + epsilon || !text(beat.action)) return false;
    cursor = beat.endSeconds;
  }
  return Math.abs(cursor - entry.sourceDurationSeconds) <= epsilon;
}

export function getPublicMiddleFrameMotionEntry(referenceId: string, sourceSha256: string, anchorIndex: number): MiddleFrameMotionEntry | undefined {
  const entry = entries.find(row => row.referenceId === referenceId && row.sourceSha256 === sourceSha256 && row.clarityFrame.index === anchorIndex);
  const frame = getCuratedHookFrame(referenceId, sourceSha256);
  if (!entry || !frame || frame.index !== anchorIndex || frame.timeSeconds !== entry.clarityFrame.timeSeconds || frame.sha256 !== entry.clarityFrame.sha256 || !validateMiddleFrameMotionEntry(entry)) return undefined;
  return entry;
}

const fraction = (value: number) => Number(value.toFixed(12)).toString();
const phaseMarker = (start: number, end: number) => `PHASE [${fraction(start)}–${fraction(end)}]`;

/** Only public data is bundled. Private entries are passed to this pure builder by server callers. */
export function sourceMotionPlan(entry: MiddleFrameMotionEntry): HookMotionPlan {
  if (!validateMiddleFrameMotionEntry(entry)) throw new Error("This full-video motion record could not be verified.");
  return {
    openingState: entry.openingState,
    beats: entry.beats.map((beat, index) => ({
      phase: index === 0 ? "opening" : index === entry.beats.length - 1 ? "ending" : "middle",
      action: `${phaseMarker(index === 0 ? 0 : beat.startSeconds / entry.sourceDurationSeconds, index === entry.beats.length - 1 ? 1 : beat.endSeconds / entry.sourceDurationSeconds)}: ${beat.action}`,
    })),
    camera: entry.camera,
    endingState: entry.endingState,
    constraints: ["Keep the approved identity, clothing and setting continuous through the final frame. Maintain hand and held-object contact; preserve every held reaction and the final pose."],
  };
}

export function buildSourceMotionDirections(entry: MiddleFrameMotionEntry): string {
  const plan = sourceMotionPlan(entry);
  return [
    `OPENING STATE: ${plan.openingState}`,
    ...plan.beats.map(beat => `${beat.phase.toUpperCase()}: ${beat.action}`),
    `CAMERA: ${plan.camera}`,
    `ENDING STATE: ${plan.endingState}`,
    ...plan.constraints.map(value => `CONSTRAINT: ${value}`),
  ].join("\n\n");
}

/** Normalized authoring boundaries are mapped only at submission/preview duration.
 * Words remain exactly as edited; ordinary manual/legacy prose is untouched. */
export function retimeSourceMotionDirections(directions: string, durationSeconds: number, actionDurationSeconds?: number): string {
  if (!directions.includes("PHASE [")) return directions;
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds < 3 || durationSeconds > 15) throw new Error("Choose a supported animation duration.");
  if (actionDurationSeconds !== undefined && (!Number.isFinite(actionDurationSeconds) || actionDurationSeconds < 1 || actionDurationSeconds > durationSeconds)) throw new Error("Review the original-opening action duration.");
  const pattern = /PHASE \[(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)\]/g;
  const matches = [...directions.matchAll(pattern)];
  if (!matches.length || matches.length !== directions.split("PHASE [").length - 1) throw new Error("Review the complete motion timeline before generating.");
  let cursor = 0;
  for (const match of matches) {
    const start = Number(match[1]), end = Number(match[2]);
    if (Math.abs(start - cursor) > epsilon || end <= start || start < 0 || end > 1) throw new Error("Review the complete motion timeline before generating.");
    cursor = end;
  }
  if (Math.abs(cursor - 1) > epsilon) throw new Error("The motion timeline must include the complete ending.");
  const actionDuration = actionDurationSeconds ?? durationSeconds;
  const seconds = (value: number) => Number((value * actionDuration).toFixed(2)).toString();
  const timed = directions.replace(pattern, (_match, start: string, end: string) => `${seconds(Number(start))}–${seconds(Number(end))}s`);
  return actionDuration < durationSeconds ? `${timed}\n\nFINAL HOLD ${seconds(1)}–${durationSeconds}s: Keep the completed ending pose, expression, hand and prop contact, lighting and camera composition continuous. Introduce no new gesture or scene change.` : timed;
}
