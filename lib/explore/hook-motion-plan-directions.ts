import type { HookMotionPlan } from "./hook-keyframe-motion.ts";

/** Keep each timed action once, with repeated continuous instructions outside the beats. */
export function hookMotionPlanDirections(plan: HookMotionPlan): string {
  const sentences = (text: string) => text.trim().split(/(?<=[.!?])\s+(?=[A-Z])/u);
  const beats = plan.beats.map(beat => {
    const prefix = beat.action.match(/^PHASE \[[^\]]+\]:\s*/u)?.[0] ?? "";
    return { ...beat, prefix, sentences: sentences(beat.action.slice(prefix.length)) };
  });
  const continuous = [...new Set([
    ...beats[0].sentences.filter(sentence => beats.every(beat => beat.sentences.includes(sentence))),
    ...beats.flatMap(beat => beat.sentences).filter(sentence => sentence === "The phone stays out of frame." || sentence === "Do not use a smooth digital zoom."),
  ])];
  const stated = new Set([...sentences(plan.openingState), ...beats.flatMap(beat => beat.sentences)]);
  const summary = (text: string) => sentences(text).filter(sentence => !stated.has(sentence)).join(" ");
  const camera = plan.summariesInTimeline?.includes("camera") ? "" : summary(plan.camera);
  const ending = plan.summariesInTimeline?.includes("ending") ? "" : summary(plan.endingState);
  return [
    `OPENING STATE: ${plan.openingState.trim()}`,
    ...(continuous.length ? [`THROUGHOUT: ${continuous.join(" ")}`] : []),
    ...beats.map(beat => `${beat.phase.toUpperCase()}: ${beat.prefix}${beat.sentences.filter(sentence => !continuous.includes(sentence)).join(" ") || "Hold the same pose and expression."}`),
    ...(camera ? [`CAMERA: ${camera}`] : []),
    ...(ending ? [`ENDING STATE: ${ending}`] : []),
    ...plan.constraints.map(summary).filter(Boolean).map(constraint => `CONSTRAINT: ${constraint}`),
  ].join("\n");
}
