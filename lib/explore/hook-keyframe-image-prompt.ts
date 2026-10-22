import { HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS, HOOK_KEYFRAME_MAX_PERSON_IMAGES } from "./hook-keyframe-draft.ts";
import { getHookKeyframeMotionReviewDraft } from "./hook-keyframe-motion.ts";

export const HOOK_KEYFRAME_IMAGE_PROMPT_VERSION = 2;
export const HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH = 8_000;
type ImageRole = { imageIndex: number; role: "scene" | "main_face" | "supporting_face" };

/** Ordered multi-image editing contract, separate from slideshow prompts and the
 * later animation prompt. Image numbers refer to the real transmitted order. */
export function buildHookKeyframeImagePrompt(input: { personImageCount: number; instructions?: string; referenceId?: string; sourceSha256?: string }) {
  if (!Number.isInteger(input.personImageCount) || input.personImageCount < 1 || input.personImageCount > HOOK_KEYFRAME_MAX_PERSON_IMAGES) {
    throw new Error(`Choose one main face photo and up to ${HOOK_KEYFRAME_MAX_PERSON_IMAGES - 1} supporting views.`);
  }
  const instructions = input.instructions ?? "";
  if (typeof instructions !== "string" || instructions.length > HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(instructions)) {
    throw new Error(`Keep starting-image instructions within ${HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS} characters.`);
  }
  const supporting = Array.from({ length: input.personImageCount - 1 }, (_, i) => `Image ${i + 3}`);
  const roles: ImageRole[] = [{ imageIndex: 1, role: "scene" }, { imageIndex: 2, role: "main_face" },
    ...supporting.map((_, i) => ({ imageIndex: i + 3, role: "supporting_face" as const }))];
  const sourceReview = input.referenceId && input.sourceSha256 ? getHookKeyframeMotionReviewDraft(input.referenceId, input.sourceSha256) : undefined;
  // Reuse only the verified FRAME-ZERO description. Motion beats/ending frames
  // would change the still's pose, and unreviewed or stale descriptions cannot
  // provide additional image instructions.
  const openingScene = sourceReview?.staticReview?.status === "static_reviewed" && sourceReview.staticReview.startingFrameIndex === 0
    ? sourceReview.candidatePlan?.openingState.trim() : undefined;
  const prompt = [
    "Edit Image 1 (BASE_SCENE_TO_EDIT), keeping its complete scene and composition. Replace the scene performer's face using Image 2 (MAIN_FACE_IDENTITY), then remove creator-added captions. Return one full-scene image with the same framing and aspect ratio as Image 1, not a recreation of a person photo.",
    "SCENE — Image 1 supplies the scene, camera angle and framing, lighting, background, body pose, facial expression, hands and existing occlusions, clothing, accessories and source hairstyle. Preserve these by default. Keep hands in place and do not invent visible facial parts where a hand or object should cover them.",
    openingScene ? `VERIFIED OPENING SCENE — ${openingScene} This describes the opening still only. Preserve the scene visible in Image 1; do not perform later actions or invent unseen details.` : "",
    "FACE — Image 2 is the main face photo of the intended person. Replace the scene performer's facial appearance with that person's facial features and proportions: face shape, eye shape and spacing, brows, nose, lips, jawline and natural skin detail. Do not average this face with the original performer's face or substitute a similar-looking person. Keep the scene expression while using the intended person's facial structure. Match the face to the scene's existing light, exposure and shadows; do not add beauty filters, artificial glow or skin smoothing.",
    supporting.length ? `SUPPORTING VIEWS — ${supporting.join(", ")} ${supporting.length === 1 ? "is an additional view" : "are additional views"} of the SAME person in Image 2. Use them only to understand that person's facial features and proportions from other angles. Do not borrow their pose, clothing, hairstyle, lighting or background. Do not merge multiple identities.` : "Image 2 is the only identity photo; do not infer additional photo inputs.",
    "TEXT — Remove creator-added captions, hook text, subtitles, emojis and overlays from Image 1, reconstructing the scene beneath them. Preserve text physically belonging to objects in the scene unless the user's image instructions explicitly ask to change it. Do not add new text, borders or watermarks.",
    "Apply explicit user-requested image changes below. Otherwise keep the scene, clothing, hairstyle and pose from Image 1. The person photos supply facial appearance, not a replacement scene. This step produces an image for inspection; it does not animate a video.",
    instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
  return { version: HOOK_KEYFRAME_IMAGE_PROMPT_VERSION, prompt, roles, imageCount: roles.length };
}
