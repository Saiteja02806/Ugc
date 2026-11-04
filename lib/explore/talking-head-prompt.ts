import { estimateTalkingHeadSpeechSeconds } from "./talking-head-script-remix.ts";

export type TalkingHeadPromptExport = {
  version: 1; text: string; script: string; sceneDirections: string;
  selectionSha256: string; durationSeconds: number;
  businessProfileVersion?: number; requestKey?: string;
};

/** Copyable text only. Does not submit a generation or relax provider limits. */
export function buildTalkingHeadPromptExport(input: {
  script: string; sourceReviewed: boolean; sceneDirections: string;
  selectionSha256: string; hookEndMs: number;
}): TalkingHeadPromptExport {
  const validText = (text: string, max: number) => typeof text === "string" && Boolean(text.trim()) && text.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text);
  // Reviewing the source permits a personalized draft. It does not approve
  // the returned AI wording for a paid video request.
  if (!input.sourceReviewed || !validText(input.script, 6000)) throw Error("Review the complete spoken hook before generating its prompt.");
  if (!validText(input.sceneDirections, 6000) || !/^[a-f0-9]{64}$/u.test(input.selectionSha256) || !Number.isInteger(input.hookEndMs) || input.hookEndMs <= 0) throw Error("Load the selected source and its scene directions before generating a prompt.");
  const durationSeconds = Math.max(3, Math.ceil(input.hookEndMs / 1000), Math.ceil(estimateTalkingHeadSpeechSeconds(input.script)));
  const text = [
    `Create one continuous talking-head hook of approximately ${durationSeconds} seconds. Leave enough time for the complete script at a natural speaking pace; do not cut words or speed up delivery to fit.`,
    "Use the generated, reviewed starting image as the actual first frame at t=0. Preserve its opening pose, composition, facial identity, hairstyle, clothing, lighting, camera and scene throughout. This image takes priority over conflicting appearance or scene details in the directions. Begin movement from that image; do not substitute a later opening pose.",
    `SCENE AND PERFORMANCE DIRECTIONS:\n${input.sceneDirections.trim()}`,
    `COMPLETE SPOKEN HOOK (say exactly these words, once, in this order; this block overrides any conflicting dialogue in the scene directions):\n${JSON.stringify(input.script.trim())}`,
    "Use natural speech, matching lip movements, expressions and small physically consistent gestures. Never read scene directions aloud. Do not invent dialogue, product claims, a sales pitch or demo narration. Keep this clip talking-head only: no app demonstration or demo cutaway.",
    "Do not generate captions, readable text, logos or watermarks. Keep cleaned surfaces and props from the starting image unchanged. Finish the complete hook, then hold naturally if time remains.",
  ].join("\n\n");
  return { version: 1, text, script: input.script, sceneDirections: input.sceneDirections, selectionSha256: input.selectionSha256, durationSeconds };
}
