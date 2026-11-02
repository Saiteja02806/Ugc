/** Optional on new jobs only; absent retains historical source-scene behavior. */
export type StartingFrameReferenceOptions = { background: "source" | "photo"; outfit: "source" | "photo" };

export function isStartingFrameReferenceOptions(value: unknown): value is StartingFrameReferenceOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && ["source", "photo"].includes(String(item.background)) && ["source", "photo"].includes(String(item.outfit));
}

export function canonicalStartingFrameReferenceOptions(value: StartingFrameReferenceOptions) {
  return { background: value.background, outfit: value.outfit };
}

export function startingFrameReferenceInstructions(options?: StartingFrameReferenceOptions) {
  if (!options) return "";
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
