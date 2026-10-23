import { HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS, HOOK_KEYFRAME_MAX_PERSON_IMAGES } from "./hook-keyframe-draft.ts";
import { getHookKeyframeMotionReviewDraft } from "./hook-keyframe-motion.ts";

export const HOOK_KEYFRAME_IMAGE_PROMPT_VERSION = 4;
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
    "Generate a new photograph of my influencer shown in Image 2 (MY_INFLUENCER). Use Image 1 (VISUAL_REFERENCE) to understand how I want my influencer to be photographed: the setting, composition, pose and expression. Show my influencer in that situation, with their own recognizable face and natural appearance.",
    "PERSON — Image 2 is the main face photo of my influencer. Use their facial features and proportions: face shape, eye shape and spacing, brows, nose, lips, jawline and natural skin detail. Keep their recognizable appearance as you depict the reference pose and expression.",
    supporting.length ? `SUPPORTING VIEWS — ${supporting.join(", ")} ${supporting.length === 1 ? "is an additional view" : "are additional views"} of the SAME person in Image 2. Use these photos to understand my influencer from other angles. Image 1 supplies the visual direction for the new photograph.` : "Image 2 is the only identity photo; do not infer additional photo inputs.",
    "VISUAL DIRECTION — Use Image 1 as a guide for the environment, camera angle, framing, subject placement, clothing, lighting, body pose, head angle, gaze and expression. Depict my influencer performing the visible gesture, including any held objects and any parts of the face covered by hands or objects. Compose the scene naturally around my influencer; recognizable likeness takes priority over copying the reference person's facial appearance or exact facial geometry.",
    openingScene ? `VERIFIED OPENING SCENE — ${openingScene} Use this description of the visible opening moment as guidance for the new photograph.` : "",
    "OUTPUT — Return one complete photograph with the same aspect ratio as Image 1. Omit creator-added captions, hook text, subtitles, emojis and graphic overlays. Preserve text physically belonging to objects in the scene unless the user's image instructions ask otherwise. Use realistic skin texture without beauty filters or artificial smoothing. No added borders or watermarks.",
    "Apply explicit user-requested image changes below. Create a still photograph for review before video generation.",
    instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
  return { version: HOOK_KEYFRAME_IMAGE_PROMPT_VERSION, prompt, roles, imageCount: roles.length };
}
