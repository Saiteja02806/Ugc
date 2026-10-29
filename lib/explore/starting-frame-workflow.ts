import { buildHookAnimationPrompt } from "./hook-keyframe-motion.ts";
import { retimeSourceMotionDirections } from "./hook-middle-frame-motion.ts";

export type StartingFrameWorkflow = "hook" | "wall_text" | "talking_head";

/** New workflows use editable scene animation, not an unreviewed copy of source motion. */
export function startingFrameWorkflowDirections(format: StartingFrameWorkflow) {
  if (format === "talking_head") return "Animate the approved person and scene as a natural talking-head shot. Keep the camera on the person with subtle gestures and a stable composition. Follow only the user's own spoken script; do not copy the reference's script, claims, captions or demo. Do not add text, app screens, logos or watermarks.";
  if (format === "wall_text") return "Animate the approved background with subtle natural movement. Keep the composition stable and leave space for an editable text overlay. Do not render captions, overlay text, logos or watermarks into the footage.";
  return "";
}

/** Script/overlay workflows do not use Hook's action-only grammar.
 * The server chooses the workflow from the owned image's canonical source. */
export function buildStartingFrameAnimationPrompt(input: {
  workflow: StartingFrameWorkflow; directions: string; durationSeconds: number; generateAudio: boolean; actionDurationSeconds?: number; removePhysicalText?: boolean; voiceReference?: boolean; voiceIdentityPhotoCount?: number;
}) {
  if (input.workflow === "hook") return buildHookAnimationPrompt(input);
  if (typeof input.directions !== "string" || !input.directions.trim() || input.directions.length > 6_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input.directions)) throw new Error("Describe the video within 6,000 characters.");
  if (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 3 || input.durationSeconds > 15 || typeof input.generateAudio !== "boolean") throw new Error("Choose a supported animation duration and sound setting.");
  return [
    input.voiceReference ? `Create a ${input.durationSeconds}-second talking-head video. Image 1 is the approved visual reference for the person, scene and opening pose; it is not a strict first-frame input. Audio 1 is a voice reference: use its vocal characteristics and delivery, not its words or background music. Speak only the user's script below.` : `Animate the approved starting image into a ${input.durationSeconds}-second video. The image supplies the person's appearance and the complete opening composition.`,
    "Keep the approved facial features and proportions, hairstyle, clothing, lighting and scene consistent throughout the movement. Do not replace the person's identity or introduce a different person.",
    ...(input.voiceReference && input.voiceIdentityPhotoCount ? [`Images 2 through ${input.voiceIdentityPhotoCount + 1} are supporting facial identity references for that same person only. Do not copy their clothing, lighting, background or pose; Image 1 controls the scene.`] : []),
    input.workflow === "talking_head" ? "Create a natural talking-head performance. Use only the user's own script below. Do not invent product claims or add a demo segment." : "Create clean moving background footage. Overlay text is added separately in the editor; do not render the requested overlay words into the video.",
    input.workflow === "wall_text" ? retimeSourceMotionDirections(input.directions.trim(), input.durationSeconds) : input.directions.trim(),
    input.removePhysicalText ? "Keep the scene free of captions, physical logos, readable text, labels, signage and watermarks. Preserve the underlying surfaces, clothing and props without recreating removed lettering." : "Do not add captions, floating logos or creator-added graphics. Preserve text physically present on objects in the approved image.",
    input.generateAudio
      ? input.workflow === "talking_head" ? "SOUND SETTING: ON. Generate the user's requested speech with natural delivery and lip-sync. Do not invent extra spoken words." : "SOUND SETTING: ON. Natural ambient sound is allowed. Do not add speech, narration, singing or music."
      : "SOUND SETTING: OFF. Return a completely silent video, with no music, speech or sound effects. Natural expressive mouth movements may occur without sound.",
  ].join("\n\n");
}
