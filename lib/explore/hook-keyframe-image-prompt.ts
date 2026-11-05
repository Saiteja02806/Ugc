import { HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS, HOOK_KEYFRAME_MAX_PERSON_IMAGES } from "./hook-keyframe-draft.ts";
import { getHookKeyframeMotionReviewDraft } from "./hook-keyframe-motion.ts";
import { getPublicMiddleFrameMotionEntry, type MiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { getHookFullRecreationPilot } from "./hook-full-recreation-pilot.ts";
import { reviewedStartingFrameScene } from "../../worker/src/lib/starting-frame-reviewed-scene.ts";
import type { StartingFrameReferenceOptions } from "../../worker/src/lib/starting-frame-reference-options.ts";

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

/** New requests use original source frame0 only; old builders remain frozen for receipts. */
export function buildOriginalOpeningImagePrompt(input: { personImageCount: number; instructions?: string; referenceId?: string; sourceSha256?: string; version?: 7 | 8 | 9 }) {
  if (!Number.isInteger(input.personImageCount) || input.personImageCount < 1 || input.personImageCount > HOOK_KEYFRAME_MAX_PERSON_IMAGES) throw new Error("Choose supported photos of the same person.");
  const instructions = input.instructions ?? "";
  if (typeof instructions !== "string" || instructions.length > HOOK_KEYFRAME_MAX_IMAGE_INSTRUCTIONS || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(instructions)) throw new Error("Shorten the starting-image instructions.");
  if (input.version !== undefined && input.version !== 7 && input.version !== 8 && input.version !== 9) throw new Error("Choose a supported original-opening prompt version.");
  if (input.version !== 7) {
    const prompt = [
      "Recreate Image1's original video opening at t=0 as one photorealistic still, replacing only the person's identity with the influencer in Image2 and supporting photos. This is the same shot, not a newly staged portrait.",
      "SCENE AND POSE — Image1 controls camera angle/tilt, crop, perspective, subject size and screen position, head tilt, gaze direction, mouth opening, eyelid/brow expression, hand side and finger positions, props, contact and occlusion. Keep their visible positions relative to the frame. Do not mirror, recenter, straighten, zoom, frontalize or substitute a different gesture. A raised hand must remain on its original screen side. Do not move a hand onto the mouth if Image1 does not show that contact.",
      "APPEARANCE ROLES — Keep Image1's room geometry, visible objects, clothing and hairstyle unless the user's explicit role selections request a change to that named appearance. Identity photos supply facial features only, not their room, outfit, neutral pose, expression or lighting.",
      "LIGHT AND SKIN — Preserve Image1's light direction, softness, exposure, color cast and shadow variation. Relight the influencer naturally into that environment. Keep natural skin detail and expression-related creases. Face, neck and hands belong to one person under the same physical light; different orientations may have different brightness and shadows. Do not flatten illumination, beautify skin or soften the source expression.",
      "IDENTITY — Image2 is the primary influencer face. Later images are supporting views of the SAME person. Adapt those facial proportions to Image1's head angle and expression without blending the source performer's identity or copying the portraits' pose.",
      reviewedStartingFrameScene(input.referenceId, input.sourceSha256),
      "CLEANUP — Remove creator captions, subtitles, hook words, emojis, watermarks and graphic overlays, plus physical logos, branding and readable lettering. Reconstruct the actual surface beneath them with matching light and texture. Preserve the objects, clothing and scene geometry; do not erase an object or replace the room to remove its text. Add no replacement lettering.",
      "OUTPUT — Keep Image1's complete aspect ratio and composition. No extra person, extra hand, new prop or scene redesign. Check screen-side placement, gaze, mouth opening, head tilt, room and camera against Image1 before returning the photograph.",
      instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
    ].filter(Boolean).join("\n\n");
    if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
    return { version: (input.version ?? 9) as 8 | 9, prompt, imageCount: input.personImageCount + 1 };
  }
  const prompt = [
    "Create one photorealistic original-opening photograph for review before video generation. Image1 is the source video's first decoded frame at elapsed t=0, not a later clarity frame. Recreate this exact opening with the influencer from Image2 and supporting identity photos.",
    "SOURCE SHOT — Image1 alone controls camera height and tilt, framing/crop, subject size and placement, background geometry, clothing, body pose, head angle, gaze, expression, hands, held props and their contact/occlusion. Preserve the opening moment, including face obstruction. Do not clear the face, lower an object, change the outfit or jump to a later action.",
    "LIGHTING — Match Image1's light direction, softness, exposure, contrast, color cast, highlights, shadows and reflections. Relight the influencer naturally into that source environment while keeping their recognizable facial proportions and skin detail. Do not copy lighting or color grading from identity photos.",
    "COMPLEXION & YOUTH — Render a smooth, clear, youthful complexion with relaxed lower eyelids and subtle expression. Do not generate harsh forehead creases, vertical frown lines, or aging wrinkles.",
    "ANATOMICAL & LIGHTING HARMONY — The influencer's natural skin tone, warmth, and ambient illumination must be unified across the entire visible subject. Any visible hand, fingers, neck, and upper chest must share the exact same skin tone, brightness, and texture as the face, naturally lit without harsh dark shadows.",
    "IDENTITY — Image2 and later images depict the SAME selected influencer. Use only their recognizable facial features, proportions, hairline and natural appearance. They do not supply clothing, background, pose, expression or lighting. Do not blend the source performer's identity into the result.",
    "REMOVE ALL TEXT AND LOGOS — Remove creator captions, subtitles, hook words, emojis, watermarks and graphic overlays, including outlines and shadows. Also remove physical logos, branding and readable text on clothing, objects, packaging, screens, signs and background surfaces. Reconstruct plain underlying fabric or material with matching lighting and texture. Keep the objects and clothing themselves, their shape, color and placement; do not crop, blur or cover them with boxes. Do not generate replacement lettering or logos.",
    "OUTPUT — One complete image matching Image1's aspect ratio and composition, natural skin and anatomy, realistic fingers and prop contact. No new person, extra hand, beauty filter or scene redesign. Preserve source lighting and outfit except the requested logo/text cleanup.",
    instructions.trim() ? `USER IMAGE INSTRUCTIONS:\n${instructions.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  if (prompt.length > HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH) throw new Error("Shorten the starting-image instructions.");
  return { version: 7 as const, prompt, imageCount: input.personImageCount + 1 };
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

/** Stage 2 identity lock. The worker copy in openrouter-gemini-image.ts is what Gemini receives. */
export function buildHookKeyframeStage2Prompt(input: {
  instructions?: string;
  supportingImageCount?: number;
  referenceOptions?: StartingFrameReferenceOptions;
  stage2Version?: 2;
  referenceId?: string;
  sourceSha256?: string;
} = {}) {
  const instructions = input.instructions?.trim() ?? "";
  const supporting = Math.max(0, Math.floor(input.supportingImageCount ?? 0));
  if (input.stage2Version === 2) {
    const supportingCropLine = supporting === 0
      ? "Image 2 is the only close-up identity face photo."
      : supporting === 1
        ? "Image 3 is another close-up face photo of the same person as Image 2. Use it only to confirm that person's facial features from another angle."
        : `Images 3 through ${2 + supporting} are other close-up face photos of the same person as Image 2. Use them only to confirm that person's facial features from other angles.`;
    return [
      "STAGE 2 IDENTITY LOCK (FACE SWAP & CAPTION CLEANUP ONLY):",
      "Image 1 is the scene photograph. Keep 100% of its composition, camera angle and tilt, crop, subject size and screen position, background room, visible furniture and objects, lighting, shadows, jewelry, wardrobe, and hairstyle.",
      "POSE, HAND & EXPRESSION LOCK — Keep Image 1's exact body pose, head tilt, eye gaze direction, and mouth opening/expression. Keep any raised hand on its original screen side with the same finger positions and separation from the mouth. Do not mirror, recenter, straighten, zoom, frontalize, move the hand to the other side, or place fingers on the lips or chin if Image 1 does not show that contact. Do not copy the closed mouth or neutral expression from Image 2.",
      reviewedStartingFrameScene(input.referenceId, input.sourceSha256, input.referenceOptions),
      "Image 2 is the close-up influencer face reference. It decides the face.",
      supportingCropLine,
      "IDENTITY REPLACEMENT — Replace only the visible face in Image 1 with the person shown in Image 2. Copy the facial features that photo actually shows: facial bone structure, eye shape, eye spacing, iris color, brows, nose, natural freckles/skin detail, lip shape (adapted to Image 1's exact mouth opening), and jawline. Do not import any background, clothing, or hairstyle from the face crops.",
      "LIGHTING HARMONY — Relight that swapped face to Image 1 so the face, neck, and hands share the same physical scene light.",
      instructions ? `USER IMAGE INSTRUCTIONS:\n${instructions}` : "",
    ].filter(Boolean).join("\n\n");
  }
  const supportingLine = supporting === 0
    ? "Image 2 is the only identity photo."
    : supporting === 1
      ? "Image 3 is another photo of the same person as Image 2. Use it only to confirm that person's features from another angle."
      : `Images 3 through ${2 + supporting} are other photos of the same person as Image 2. Use them only to confirm that person's features from other angles.`;
  return [
    "STAGE 2 IDENTITY LOCK:",
    "Image 1 is the scene photograph. Keep its composition, camera, pose, hand placement, jewelry, wardrobe, lighting, background, and any part of the face covered by a hand or object.",
    "Image 2 is the influencer photo. It decides the face.",
    supportingLine,
    "Replace the visible face in Image 1 with the person shown in Image 2. Copy the features that photo actually shows: face shape, eye shape, eye spacing, iris color, brows, nose, lips, jawline, hairline, and natural skin detail. Do not assign a brow color, lip shape, forehead size, freckles, or nose shape that Image 2 does not show.",
    "Relight that face to Image 1 so the face, neck, and hands share the scene light. Keep the identity from Image 2.",
    instructions ? `USER IMAGE INSTRUCTIONS:\n${instructions}` : "",
  ].filter(Boolean).join("\n\n");
}
