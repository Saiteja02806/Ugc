import { startingFrameReferenceInstructions as legacyInstructions, withStartingFrameReferenceOptions as legacyWithOptions } from "./starting-frame-reference-options-legacy.ts";
/** Optional on new jobs only; absent retains historical source-scene behavior. */
export type StartingFrameReferenceOptions = { background: "source" | "photo"; outfit: "source" | "photo"; hairstyle?: "source" | "photo" };

export function isStartingFrameReferenceOptions(value: unknown): value is StartingFrameReferenceOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return [2, 3].includes(Object.keys(item).length) && Object.keys(item).every(key => ["background", "outfit", "hairstyle"].includes(key)) &&
    (item.background === "source" || item.background === "photo") && (item.outfit === "source" || item.outfit === "photo") &&
    (!Object.hasOwn(item, "hairstyle") || item.hairstyle === "source" || item.hairstyle === "photo");
}

export function canonicalStartingFrameReferenceOptions(value: StartingFrameReferenceOptions) {
  // Do not add a default to old receipts: absence preserves historical hashes.
  return { background: value.background, outfit: value.outfit, ...(value.hairstyle !== undefined ? { hairstyle: value.hairstyle } : {}) };
}

export function startingFrameReferenceInstructions(options?: StartingFrameReferenceOptions, version: 1 | 2 = 2) {
  if (version === 1) return legacyInstructions(options);
  if (!options) return "";
  if (options.hairstyle !== undefined) {
    const isFullAppearance = options.background === "photo" && options.outfit === "photo" && options.hairstyle === "photo";
    return [
      "USER-SELECTED IMAGE ROLES — These choices independently override conflicting defaults/custom text.",
      ...(isFullAppearance
        ? ["FULL APPEARANCE: Use Image2 as the complete source of truth for hair, body build, skin tone, outfit and background, keeping Image1's camera angle, pose, hand placement, gaze and expression."]
        : []),
      options.background === "photo"
        ? "BACKGROUND: Use Image2's environment from Image1's camera viewpoint; replace the source room."
        : "BACKGROUND: Keep Image1's environment; do not copy photo backgrounds.",
      options.outfit === "photo"
        ? "OUTFIT: Use Image2's clothing, body build and natural skin tone adapted to source pose/light; do not borrow supporting-photo outfits."
        : "OUTFIT: Keep Image1's clothing; do not copy photo outfits.",
      options.hairstyle === "photo"
        ? "HAIRSTYLE: Use Image2's hairstyle, hair color, length, texture, parting and volume, adapted to source head angle, light and occlusions."
        : "HAIRSTYLE: Keep Image1's hairstyle, hair color, length, texture, parting and volume; do not restyle it from photos.",
      "Keep original source t=0 pose, camera, expression, hands, props and occlusion. Image2 defines facial identity; other photos support identity only. Match source light. Remove captions, watermarks, logos and readable text; restore surfaces. No new props/people.",
    ].join("\n\n");
  }
  return [
    "USER-SELECTED IMAGE ROLES — These explicit choices override conflicting background or wardrobe defaults and custom prompt text.",
    options.background === "photo"
      ? "BACKGROUND: Use the environment visible in the main influencer photo, Image 2. Reconstruct that environment behind the person from the source camera viewpoint. Do not retain the source video's room."
      : "BACKGROUND: Keep the source starting frame's environment; never copy the background from influencer photos.",
    options.outfit === "photo"
      ? "OUTFIT: Use the clothing visibly worn in the main influencer photo, Image 2, adapted to the source pose and illumination. Do not use the source performer's outfit or infer clothing from supporting photos."
      : "OUTFIT: Keep the source starting frame's clothing; do not import clothing from the influencer photos.",
    "Keep original source t=0 pose, head angle, expression, camera, framing, hands, props and occlusion. Image 2 remains the facial identity authority; other photos only support that identity. Relight the selected background and outfit consistently with the source light. Remove all captions, watermarks, logos and readable lettering, restoring underlying surfaces. Do not add props or another person.",
  ].join("\n\n");
}

function adaptBasePromptForPhotoRoles(prompt: string, options?: StartingFrameReferenceOptions) {
  if (!options) return prompt;
  const hasPhotoRole = options.background === "photo" || options.outfit === "photo" || options.hairstyle === "photo";
  if (!hasPhotoRole) return prompt;
  let adapted = prompt
    .replace(
      "replacing only the person's identity with the influencer in Image2 and supporting photos. This is the same shot, not a newly staged portrait.",
      "putting the influencer in Image2 into this exact shot and applying the selected Image2 roles below. Do not restage the portrait.",
    )
    .replace(
      "Identity photos supply facial features only, not their room, outfit, neutral pose, expression or lighting.",
      "Image2 supplies identity and the selected roles below; supporting photos supply facial features only.",
    );
  if (options.background === "photo") {
    adapted = adapted
      .replace(
        "Retain the visible room furniture at lower screen-left and the circular ceiling fixture near the top, with the source's muted room light.",
        "Use Image2's background environment from this tilted camera angle, not Image1's.",
      )
      .replace(
        "Preserve the objects, clothing and scene geometry; do not erase an object or replace the room to remove its text.",
        "Preserve the selected roles below and scene geometry while removing text and logos.",
      )
      .replace(
        "Check screen-side placement, gaze, mouth opening, head tilt, room and camera against Image1 before returning the photograph.",
        "Check screen-side placement, gaze, mouth opening, head tilt and camera against Image1 before returning the photo.",
      );
  } else if (options.outfit === "photo" || options.hairstyle === "photo") {
    adapted = adapted.replace(
      "Preserve the objects, clothing and scene geometry; do not erase an object or replace the room to remove its text.",
      "Preserve Image1's room and the selected Image2 roles below while removing text and logos.",
    );
  }
  return adapted;
}

export function withStartingFrameReferenceOptions(prompt: string, options?: StartingFrameReferenceOptions, version: 1 | 2 = 2) {
  if (version === 1) return legacyWithOptions(prompt, options);
  const instructions = startingFrameReferenceInstructions(options);
  const adapted = adaptBasePromptForPhotoRoles(prompt, options);
  return instructions && !adapted.endsWith(instructions) ? `${adapted}\n\n${instructions}` : adapted;
}
