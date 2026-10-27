import { HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS, HOOK_KEYFRAME_MAX_PERSON_IMAGES } from "./hook-keyframe-draft.ts";
import { getHookKeyframeMotionReviewDraft } from "./hook-keyframe-motion.ts";
import { getPublicMiddleFrameMotionEntry, type MiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { getHookFullRecreationPilot } from "./hook-full-recreation-pilot.ts";

export const HOOK_KEYFRAME_IMAGE_PROMPT_VERSION = 4;
// Explicit test candidate; application requests keep the user-selected v4 baseline.
export const HOOK_KEYFRAME_IMAGE_PROMPT_CANDIDATE_VERSION = 6;
export const HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH = 8_000;
type ImageRole = { imageIndex: number; role: "scene" | "main_face" | "supporting_face" };

/** Hook 100-only pilot. Image 1 is the literal animation opening; Image 2 is
 * evidence for continuity only; Image 3+ are the sole identity authority. */
export function buildHookFullRecreationOpeningImagePrompt(input: {
  personImageCount: number; instructions?: string; referenceId: string; sourceSha256: string; assignedEntry?: MiddleFrameMotionEntry;
}) {
  const pilot = getHookFullRecreationPilot(input.referenceId, input.sourceSha256);
  if (!pilot) throw new Error("This full-recreation preparation has not been reviewed.");
  if (!Number.isInteger(input.personImageCount) || input.personImageCount < 1 || input.personImageCount > HOOK_KEYFRAME_MAX_PERSON_IMAGES) {
    throw new Error(`Choose one main face photo and up to ${HOOK_KEYFRAME_MAX_PERSON_IMAGES - 1} supporting views.`);
  }
  const instructions = input.instructions ?? "";
  if (typeof instructions !== "string" || instructions.length > HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(instructions)) {
    throw new Error(`Keep starting-image instructions within ${HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS} characters.`);
  }
  const supporting = Array.from({ length: input.personImageCount - 1 }, (_, index) => `Image ${index + 4}`);
  const assigned = input.assignedEntry ?? getPublicMiddleFrameMotionEntry(input.referenceId, input.sourceSha256, pilot.identityClarityAnchor.index);
  if (!assigned || assigned.referenceId !== input.referenceId || assigned.sourceSha256 !== input.sourceSha256 ||
    assigned.clarityFrame.index !== pilot.identityClarityAnchor.index || assigned.clarityFrame.sha256 !== pilot.identityClarityAnchor.sha256) {
    throw new Error("This source's full-recreation prompts are unavailable. No generation was submitted.");
  }
  if (input.referenceId !== "explore-paired-hook-fc44f6214b6e17413600ec13") {
    const prompt = [
      "Create one photorealistic, caption-free animation opening matching Image 1's aspect ratio and crop, at original video t=0.",
      `Image 1 is the sole opening scene/pose authority. ${assigned.openingState} ${assigned.camera} ${assigned.openingImageRequirement}`,
      `Image 2 is the later clarity anchor at source t=${assigned.clarityFrame.timeSeconds}. It supports visible scene continuity only; it is not output time zero, the output pose, or identity authority. Preserve the opening hands, objects and facial occlusion rather than copying the later cleared pose.`,
      "Image 3 is the selected influencer's main identity photo; subsequent images are supporting views of that same person. Use those facial features, proportions and natural appearance, never their room, clothes, pose or lighting. Do not copy the source performer's identity.",
      `REQUIRED CAPTION DELETION: Remove the complete added overlay, including outlines, shadows and emoji fragments: ${assigned.captionCleanup.text}. Region: ${assigned.captionCleanup.region}. Restore physical photographic detail underneath. These words identify what to erase, never what to generate. Preserve real props, logos and scene signage.`,
      "Keep the original opening viewpoint, framing, outfit, light and physically natural hand/prop contact. No new text, extra person, extra hand, beauty filter, cropped scene or portrait-background substitution. Return one original-opening photograph for visual review before animation.",
      instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
    ].filter(Boolean).join("\n\n");
    if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
    return { version: 5 as const, prompt, imageCount: input.personImageCount + 2 };
  }

  const prompt = [
    "Create one photorealistic, caption-free 9:16 animation opening frame. Recreate the original opening moment visible in Image 1, replacing the performer with my influencer from Image 3 and completely removing the superimposed creator caption.",
    'REQUIRED CAPTION DELETION — Images 1 and 2 contain the same added three-line caption: "POV: you finally understand" / "how to use Claude" / "for marketing". These quoted words identify text to ERASE; never render, rewrite, translate or retain them in the output. The overlay spans almost the full width of the lower-middle image, approximately y=63% to 80% from the top. Remove every white letter, black outline and shadow. Reconstruct the neck, sweater, shoulder and background underneath as uninterrupted photographic detail. Do not cover the area with a box, blur, crop, watermark or new text. Scene-preservation instructions apply to the physical scene, not to these added caption pixels.',
    "ANIMATION OPENING — Image 1 is the sole blueprint for output time t=0.000. Preserve its low, slightly tilted close-selfie camera, crop, subject position, pale beams and windows, black ribbed sweater, white earbuds, round eyeglasses on the face, hand already touching the glasses at the temple, off-screen-right gaze and slightly open mouth. Preserve the real opening occlusion and side-facing pose; do not jump ahead to a clear front-facing pose.",
    `CLARITY ANCHOR — Image 2 is the reviewed later source moment at t=${pilot.identityClarityAnchor.timeSeconds.toFixed(6)}. Use it only to understand stable scene, wardrobe, hair, earbuds and facial-area geometry that Image 1 partly obscures. It is not the output pose, not video time zero and not an identity photo. Do not copy the source performer's facial identity, cleared face, lowered hands or glasses-off state into the opening.`,
    "INFLUENCER IDENTITY — Image 3 is the main identity photo and the only person who must appear. Preserve this influencer's face shape, eyes and spacing, brows, nose, lips, jawline, skin texture and natural proportions while adapting them to Image 1's head angle, expression, lighting and partial occlusion.",
    supporting.length ? `SUPPORTING IDENTITY — ${supporting.join(", ")} ${supporting.length === 1 ? "is another view" : "are other views"} of the same influencer as Image 3. Use facial identity only; do not import their poses, clothes, lighting or backgrounds.` : "Image 3 is the only identity photo; do not infer another identity input.",
    "FIDELITY — Keep natural skin and hair, physically correct hand-to-glasses contact, intact fingers, realistic lens reflections, consistent shadows and the same phone-camera look. Do not beautify, frontalize, uncover or redesign the opening merely to show more of the face.",
    "OUTPUT — Return one complete still with Image 1's aspect ratio and crop. Remove creator-added captions, hook text, subtitles, emojis and graphics while reconstructing the scene beneath them. Add no text, border, watermark, extra person, extra hand, changed outfit or changed background.",
    "FINAL CHECK — The result must be a clean photograph with no visible creator caption, lettering fragments, black text outlines or ghost words in the lower-middle region. This still will be reviewed before animation. It must depict only original t=0, not a blend or average of Image 1 and Image 2.",
    instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
  return { version: 5 as const, prompt, imageCount: input.personImageCount + 2 };
}

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
