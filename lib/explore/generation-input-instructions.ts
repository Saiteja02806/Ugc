import { PERSON_REFERENCE_INSTRUCTIONS } from "./person-reference.ts";

/** New requests only. User text and original assets retain their order. */
export function buildExploreGenerationInstructions({ model, personPhotos, imageCount, hasVideo, generateAudio, referenceVideoMode }: {
  model: string; personPhotos: boolean; imageCount: number; hasVideo: boolean; generateAudio?: boolean; referenceVideoMode?: "edit";
}) {
  const seedance = model === "seedance_2_5";
  const reapi = seedance || model === "wan_3_0";
  const image = (number: number) => seedance ? `@Image ${number}` : `Image ${number}`;
  const video = seedance ? "@Video 1" : model === "wan_3_0" ? "Video 1" : "the supplied source video";
  const identity = personPhotos && imageCount > 0;
  const editing = hasVideo && referenceVideoMode === "edit";
  const intent = identity ? hasVideo ? editing ? "replace_face" : "recreate_performance" : "create_performance" : editing ? "edit_video" : "general";
  const instructions: string[] = [];
  if (identity) {
    // Keep the established role requirements; bind their names to this route's
    // documented media syntax rather than inventing provider identity fields.
    instructions.push(hasVideo
      ? seedance ? PERSON_REFERENCE_INSTRUCTIONS.replace(/Image 1/g, "@Image 1") : PERSON_REFERENCE_INSTRUCTIONS
      : `IMAGE ROLES: ${image(1)} is the main face photo. All remaining images are supporting views of the SAME person. Preserve their facial features and proportions. Use the main photo for appearance and clothing unless the user requests a change; supporting views describe identity, not alternative scenes.`);
    if (imageCount > 1) instructions.push(`${Array.from({ length: imageCount - 1 }, (_, index) => image(index + 2)).join(", ")} are supporting views of the same person in ${image(1)}.`);
    instructions.push(hasVideo
      ? editing
        ? `EDIT THE EXISTING VIDEO: In ${video}, replace the original performer's facial identity with the person in ${image(1)}. Preserve that person's facial features and proportions, including face shape, eye spacing, nose, lips and jawline, consistently throughout the clip. The supporting images show additional views of that same person. Keep the source video's actions, emotions, expressions, gaze, pose, clothing, hairstyle, lighting, camera, scene and timing unless the user requests a change. Do not blend the original performer's facial identity with the reference person. Match the replacement face to the source lighting; do not copy the photos' background, clothing or pose. Modify this supplied footage rather than describe or create a new scene.`
        : `PERFORMANCE SOURCE: ${video} supplies actions, emotions, expressions, gaze, pose, clothing, hairstyle, camera and scene. The body may be regenerated while following that performance and clothing. The photos supply facial identity and proportions; the video's original performer does not supply facial identity.`
      : `NEW PERFORMANCE: Create the scene, actions and emotions requested by the user, using ${image(1)} and its supporting views for facial identity and proportions.`);
  } else if (editing) {
    instructions.push(`EDIT THE EXISTING VIDEO: Apply the user's requested changes to ${video}, retaining the source performance, scene and timing unless requested otherwise. Modify the supplied footage rather than create a new scene.`);
  } else if (reapi && hasVideo) {
    instructions.push(`VIDEO REFERENCE: ${video} is inspiration for a new clip. Follow the user's instructions about how to use it; this is reference-guided creation, not an edit of the original footage.`);
  }
  if (generateAudio !== undefined) instructions.push(generateAudio
    ? "SOUND SETTING: ON. Follow the user's requested speech, music or sound effects. Do not invent dialogue or copy spoken words from the reference video unless requested."
    : "SOUND SETTING: OFF. Return a completely silent video with no speech, music or sound effects. Preserve requested visual expressions and mouth movements without sound.");
  return { intent, instructions: instructions.join("\n") };
}
