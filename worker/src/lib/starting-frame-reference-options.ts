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

export function startingFrameReferenceInstructions(options?: StartingFrameReferenceOptions) {
  if (!options) return "";
  if (options.hairstyle !== undefined) return [
    "USER-SELECTED IMAGE ROLES — These choices independently override conflicting defaults/custom text.",
    options.background === "photo"
      ? "BACKGROUND: Use Image2's environment from Image1's camera viewpoint; replace the source room."
      : "BACKGROUND: Keep Image1's environment; do not copy photo backgrounds.",
    options.outfit === "photo"
      ? "OUTFIT: Use Image2's clothing adapted to source pose/light; do not borrow supporting-photo outfits."
      : "OUTFIT: Keep Image1's clothing; do not copy photo outfits.",
    options.hairstyle === "photo"
      ? "HAIRSTYLE: Use Image2's hairstyle, hair color, length, texture, parting and volume, adapted to source head angle, light and occlusions."
      : "HAIRSTYLE: Keep Image1's hairstyle, hair color, length, texture, parting and volume; do not restyle it from photos.",
    "Keep original source t=0 pose, camera, expression, hands, props and occlusion. Image2 defines facial identity; other photos support identity only. Match source light. Remove captions, watermarks, logos and readable text; restore surfaces. No new props/people.",
  ].join("\n\n");
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

export function withStartingFrameReferenceOptions(prompt: string, options?: StartingFrameReferenceOptions) {
  const instructions = startingFrameReferenceInstructions(options);
  return instructions && !prompt.endsWith(instructions) ? `${prompt}\n\n${instructions}` : prompt;
}
