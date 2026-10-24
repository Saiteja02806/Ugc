import { HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS, HOOK_KEYFRAME_MAX_PERSON_IMAGES } from "./hook-keyframe-draft.ts";
import { getHookKeyframeMotionReviewDraft } from "./hook-keyframe-motion.ts";

export const HOOK_KEYFRAME_IMAGE_PROMPT_VERSION = 4;
// Explicit test candidate; application requests keep the user-selected v4 baseline.
export const HOOK_KEYFRAME_IMAGE_PROMPT_CANDIDATE_VERSION = 6;
export const HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH = 8_000;
type ImageRole = { imageIndex: number; role: "scene" | "main_face" | "supporting_face" };

/** Ordered multi-image editing contract, separate from slideshow prompts and the
 * later animation prompt. Image numbers refer to the real transmitted order. */
export function buildHookKeyframeImagePrompt(input: { personImageCount: number; instructions?: string; referenceId?: string; sourceSha256?: string; sourceFrameIndex?: number; promptVersion?: 4 | 5 | 6 }) {
  const version = input.promptVersion ?? HOOK_KEYFRAME_IMAGE_PROMPT_VERSION;
  if (version !== 4 && version !== 5 && version !== 6) throw new Error("Unsupported starting-image prompt version.");
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
  const openingScene = (input.sourceFrameIndex ?? 0) === 0 && sourceReview?.staticReview?.status === "static_reviewed" && sourceReview.staticReview.startingFrameIndex === 0
    ? sourceReview.candidatePlan?.openingState.trim() : undefined;
  const prompt = [
    version === 6
      ? "Generate a new photograph recreating the shot in Image 1 (VISUAL_REFERENCE), with my influencer from Image 2 (MY_INFLUENCER) as the person in that shot. Keep the same scene and visible moment, with my influencer's own recognizable face and natural appearance."
      : "Generate a new photograph of my influencer shown in Image 2 (MY_INFLUENCER). Use Image 1 (VISUAL_REFERENCE) to understand how I want my influencer to be photographed: the setting, composition, pose and expression. Show my influencer in that situation, with their own recognizable face and natural appearance.",
    "PERSON — Image 2 is the main face photo of my influencer. Use their facial features and proportions: face shape, eye shape and spacing, brows, nose, lips, jawline and natural skin detail. Keep their recognizable appearance as you depict the reference pose and expression.",
    supporting.length ? `SUPPORTING VIEWS — ${supporting.join(", ")} ${supporting.length === 1 ? "is an additional view" : "are additional views"} of the SAME person in Image 2. Use these photos to understand my influencer from other angles. Image 1 supplies the visual direction for the new photograph.` : "Image 2 is the only identity photo; do not infer additional photo inputs.",
    version === 6
      ? "VISUAL DIRECTION — Recreate the same camera angle, framing, subject size and position, body pose, head angle, gaze, emotion and expression shown in Image 1. Keep the same clothing, background layout, lighting direction and color, and the same visible objects and hand gestures. Preserve any parts of the face covered by hands or objects. Use Image 2 and its supporting photos for my influencer's facial features and proportions; use Image 1 for how they are posed, dressed and lit. Recreate this shot without redesigning the scene, changing the crop or importing clothing and backgrounds from the influencer photos."
      : version === 5
      ? "VISUAL DIRECTION — Photograph my influencer in the composition shown in Image 1. Keep the same camera viewpoint and tilt, crop, subject size and placement, background layout, clothing and lighting. Keep visible objects on the same side and in the same positions relative to the person. Do not zoom out, mirror the scene or redesign the setting. Use the person photos for facial appearance, not for their pose, clothing or background; do not blend the reference performer's facial features into my influencer's face."
      : "VISUAL DIRECTION — Use Image 1 as a guide for the environment, camera angle, framing, subject placement, clothing, lighting, body pose, head angle, gaze and expression. Depict my influencer performing the visible gesture, including any held objects and any parts of the face covered by hands or objects. Compose the scene naturally around my influencer; recognizable likeness takes priority over copying the reference person's facial appearance or exact facial geometry.",
    version === 5 ? "VISIBLE MOMENT — Match the body pose, head angle, gaze, mouth opening and visible gesture in Image 1 while retaining my influencer's own facial proportions. Keep hands and held objects in their visible locations, including contact and occlusion. Preserve a side view or partially covered face when shown; do not turn it toward the camera or uncover it to display more of the face. Depict only this visible moment, without inventing a later action or extra body parts outside the crop." : "",
    openingScene ? `VERIFIED OPENING SCENE — ${openingScene} ${version === 5 ? "Use this as supplementary guidance. If a detail conflicts with Image 1, follow the visible image for the scene and pose; continue using Image 2 and its supporting photos for the person's facial appearance." : "Use this description of the visible opening moment as guidance for the new photograph."}` : "",
    version === 6 && openingScene ? "The opening description is supplementary: follow Image 1 if its visible scene or pose differs from the description. Continue using the influencer photos for facial features." : "",
    version === 5
      ? "OUTPUT — Return one complete photograph with the same aspect ratio and crop as Image 1. Remove creator-added captions, hook text, subtitles, emojis and graphic overlays, including their outlines, shadows and text boxes. Reconstruct the scene beneath those overlays without changing the framing. Preserve text physically belonging to objects in the scene unless the user's image instructions ask otherwise. Use realistic skin texture without beauty filters or artificial smoothing. No added text, borders or watermarks."
      : "OUTPUT — Return one complete photograph with the same aspect ratio as Image 1. Omit creator-added captions, hook text, subtitles, emojis and graphic overlays. Preserve text physically belonging to objects in the scene unless the user's image instructions ask otherwise. Use realistic skin texture without beauty filters or artificial smoothing. No added borders or watermarks.",
    "Apply explicit user-requested image changes below. Create a still photograph for review before video generation.",
    instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
  return { version, prompt, roles, imageCount: roles.length };
}
