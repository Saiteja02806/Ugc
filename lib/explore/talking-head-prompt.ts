import { estimateTalkingHeadSpeechSeconds, TALKING_HEAD_REMIX_MAX_SECONDS } from "./talking-head-script-remix.ts";
import { talkingHeadPerformanceDirections } from "./talking-head-animation-prompt.ts";

export type TalkingHeadPromptExport = {
  version: 1; text: string; script: string; sceneDirections: string;
  selectionSha256: string; durationSeconds: number;
  businessProfileVersion?: number; requestKey?: string; targetDurationSeconds?: number;
};

const sceneHeading = "SCENE AND PERFORMANCE DIRECTIONS:\n";
const scriptHeading = "COMPLETE SPOKEN HOOK (say exactly these words, once, in this order; this block overrides any conflicting dialogue in the scene directions):\n";
const validText = (text: string, max: number) => typeof text === "string" && Boolean(text.trim()) && text.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text);

export function formatTalkingHeadPromptExport(script: string, sceneDirections: string, durationSeconds: number) {
  return [
    `Create one continuous talking-head hook of approximately ${durationSeconds} seconds. Leave enough time for the complete script at a natural speaking pace; do not cut words or speed up delivery to fit.`,
    "Use the generated, reviewed starting image as the actual first frame at t=0. Preserve its opening pose, composition, facial identity, hairstyle, clothing, lighting, camera and scene throughout. This image takes priority over conflicting appearance or scene details in the directions. Begin movement from that image; do not substitute a later opening pose.",
    `${sceneHeading}${talkingHeadPerformanceDirections(sceneDirections)}`,
    `${scriptHeading}${JSON.stringify(script.trim())}`,
    "Use natural speech, matching lip movements, expressions and small physically consistent gestures. Never read scene directions aloud. Do not invent dialogue, product claims, a sales pitch or demo narration. Keep this clip talking-head only: no app demonstration or demo cutaway.",
    "Do not generate captions, readable text, logos or watermarks. Keep cleaned surfaces and props from the starting image unchanged. Finish the complete hook, then hold naturally if time remains.",
  ].join("\n\n");
}

/** Import the editable scene block. Create owns the reviewed words and generation settings. */
export function talkingHeadPromptDirections(prompt: TalkingHeadPromptExport) {
  const original = formatTalkingHeadPromptExport(prompt.script, "", prompt.durationSeconds);
  const start = original.indexOf(sceneHeading) + sceneHeading.length;
  const prefix = original.slice(0, start), suffix = original.slice(start);
  if (!prompt.text.startsWith(prefix) || !prompt.text.endsWith(suffix)) return null;
  const directions = prompt.text.slice(prefix.length, -suffix.length).trim();
  return validText(directions, 6000) && !directions.includes(scriptHeading) && !directions.includes(sceneHeading) ? directions : null;
}

export function buildTalkingHeadPromptExport(input: {
  script: string; sourceReviewed: boolean; sceneDirections: string;
  selectionSha256: string; hookEndMs: number; targetDurationSeconds?: number;
}): TalkingHeadPromptExport {
  // Reviewing the source permits a personalized draft. It does not approve
  // the returned AI wording for a paid video request.
  if (!input.sourceReviewed || !validText(input.script, 6000)) throw Error("Review the complete spoken hook before generating its prompt.");
  if (!validText(input.sceneDirections, 6000) || !/^[a-f0-9]{64}$/u.test(input.selectionSha256) || !Number.isInteger(input.hookEndMs) || input.hookEndMs <= 0) throw Error("Load the selected source and its scene directions before generating a prompt.");
  const target = input.targetDurationSeconds;
  if (target !== undefined && (!Number.isInteger(target) || target < 3 || target > TALKING_HEAD_REMIX_MAX_SECONDS || estimateTalkingHeadSpeechSeconds(input.script) > target)) throw Error("The spoken script exceeds the selected remix duration.");
  const durationSeconds = target ?? Math.max(3, Math.ceil(input.hookEndMs / 1000), Math.ceil(estimateTalkingHeadSpeechSeconds(input.script)));
  const text = formatTalkingHeadPromptExport(input.script, input.sceneDirections, durationSeconds);
  return { version: 1, text, script: input.script, sceneDirections: input.sceneDirections, selectionSha256: input.selectionSha256, durationSeconds,
    ...(target === undefined ? {} : { targetDurationSeconds: target }) };
}
