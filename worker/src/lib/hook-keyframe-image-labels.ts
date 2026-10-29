/** Browser-safe image-role instructions shared by preview and providers. */
export function hookKeyframeProviderImageLabels(personImageCount: number, promptVersion: 2 | 3 | 4 | 5 | 7 = 2): string[] {
  if (!Number.isInteger(personImageCount) || personImageCount < 1 || personImageCount > 5) throw new Error("Choose one main face photo and up to four supporting views.");
  if (promptVersion === 7) return [
    "IMAGE 1 — ORIGINAL_OPENING_SCENE. Source frame0 is the sole authority for lighting direction and color, exposure, shadows, outfit, camera, pose, hands, props and occlusion. Remove all captions, physical logos and readable text while restoring those surfaces; do not use the source person's identity.",
    "IMAGE 2 — INFLUENCER_IDENTITY. Depict this person's facial proportions and natural identity in Image1's scene, outfit and lighting. Do not import this photo's room, clothing, light, pose or expression.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — SUPPORTING_INFLUENCER_IDENTITY_${index + 1}. Another view of the same person as Image2; facial identity only, never background, clothing, lighting or pose.`),
  ];
  if (promptVersion === 5) return [
    "IMAGE 1 — ANIMATION_OPENING_FRAME_BLUEPRINT. Recreate this original source t=0 shot with the selected influencer. This image alone defines the output pose, camera, composition, hands, glasses, clothing, lighting and background; it does not define facial identity.",
    "IMAGE 2 — IDENTITY_CLARITY_ANCHOR. A later clear moment from the same source performance. Use only to understand stable scene, wardrobe, hair, earbuds and facial-area geometry obscured in Image 1. Do not use its later pose as the output pose and do not copy this source performer's identity.",
    "IMAGE 3 — MAIN_INFLUENCER_IDENTITY. This is the only person who must appear in the recreated opening frame. Preserve this person's recognizable facial structure and natural appearance while following Image 1's original opening pose and occlusions.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 4} — SUPPORTING_INFLUENCER_IDENTITY_${index + 1}. Another view of the same person as Image 3. Use facial identity only; do not copy its pose, clothing, lighting or background.`),
  ];
  if (promptVersion === 4) return [
    "IMAGE 1 — VISUAL_REFERENCE. A reference for the setting, composition, lighting, clothing, pose, expression and gesture of a new photograph of my influencer. Use it as visual guidance for how my influencer should be photographed.",
    "IMAGE 2 — MY_INFLUENCER. The person to photograph. Generate this influencer with their recognizable facial features and natural appearance in the situation illustrated by Image 1.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — MY_INFLUENCER_SUPPORT_${index + 1}. Another view of my influencer from Image 2, to help depict their recognizable appearance from the requested angle.`),
  ];
  if (promptVersion === 3) return [
    "IMAGE 1 — PRIMARY_FRAME_BLUEPRINT. Recreate this complete shot with the selected influencer as the performer. This image defines camera framing, background, lighting, pose, expression, hands, occlusions, clothing and hairstyle. It does not define the output person's facial identity. Remove creator-added captions.",
    "IMAGE 2 — MAIN_INFLUENCER_IDENTITY. This is the person who must appear in the recreated primary frame. Use this person's facial structure and proportions, adapted to Image 1's head angle, expression and light. Do not copy this photo's background, clothing or pose, or retain Image 1's original facial identity.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — SUPPORTING_INFLUENCER_IDENTITY_${index + 1}. Another view of the same person as Image 2. Use it to understand their facial structure. Image 1 remains the blueprint for the shot; this photo supplies identity only.`),
  ];
  return [
    "IMAGE 1 — BASE_SCENE_TO_EDIT. Edit this image. It is the sole source for the composition, background, lighting, body pose, hands, expression, clothing and hairstyle. The final image must remain this scene, with only the face replaced and creator-added captions removed.",
    "IMAGE 2 — MAIN_FACE_IDENTITY. Use only this person's facial identity and proportions for the face in BASE_SCENE_TO_EDIT. This photo is not the output scene: do not copy its background, body pose, expression, clothing or lighting.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — SUPPORTING_FACE_IDENTITY_${index + 1}. An additional view of the same person as MAIN_FACE_IDENTITY. Use facial structure only; do not copy this photo's background, body pose, expression, clothing or lighting.`),
  ];
}
