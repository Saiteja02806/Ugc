/** Frozen roles for new slideshow jobs; older queued jobs keep their original contract. */
export type SlideshowReferenceContract = {
  version: 2;
  styleReferenceIndices: number[];
  attachmentReferenceIndices: number[];
  regenerationReferenceIndex?: number;
};

export function parseSlideshowReferenceContract(value: unknown, referenceCount: number): SlideshowReferenceContract {
  const invalid = () => new Error("Choose valid slideshow style, attachment and edit-target references.");
  if (!value || typeof value !== "object" || Array.isArray(value) || referenceCount < 1) throw invalid();
  const roles = value as Record<string, unknown>;
  const validIndex = (index: unknown): index is number => typeof index === "number" && Number.isInteger(index) && index >= 1 && index <= referenceCount;
  const validIndices = (indices: unknown): indices is number[] => Array.isArray(indices) && indices.every(validIndex);
  if (roles.version !== 2 || !validIndices(roles.styleReferenceIndices) || new Set(roles.styleReferenceIndices).size !== roles.styleReferenceIndices.length || !validIndices(roles.attachmentReferenceIndices) || (roles.regenerationReferenceIndex !== undefined && !validIndex(roles.regenerationReferenceIndex))) throw invalid();
  const covered = new Set([...roles.styleReferenceIndices, ...roles.attachmentReferenceIndices, ...(roles.regenerationReferenceIndex === undefined ? [] : [roles.regenerationReferenceIndex])]);
  if (covered.size !== referenceCount) throw invalid();
  return {
    version: 2,
    styleReferenceIndices: [...roles.styleReferenceIndices],
    attachmentReferenceIndices: [...roles.attachmentReferenceIndices],
    ...(roles.regenerationReferenceIndex === undefined ? {} : { regenerationReferenceIndex: roles.regenerationReferenceIndex }),
  };
}

export function slideshowGenerationPrompt(prompt: string, ratio: string, roles: SlideshowReferenceContract) {
  const instructions = [`Generate one slideshow image composed directly for the ${ratio} aspect ratio. Keep the complete subject and important visual elements inside the canvas with comfortable margins.`];
  if (roles.styleReferenceIndices.length) {
    instructions.push(`Selected slideshow style references: ${roles.styleReferenceIndices.map(index => `image ${index}`).join(", ")}. Take inspiration from their visual style, composition, lighting and atmosphere. ${roles.regenerationReferenceIndex ? "They guide the style of the edit; they do not replace the existing slide." : `Image ${roles.styleReferenceIndices[0]} is the selected slide whose visual composition guides this output; the other selected slides, if any, provide the same slideshow's style guidance.`}`);
  }
  if (roles.attachmentReferenceIndices.length) {
    instructions.push(`Images attached to the user's prompt: ${roles.attachmentReferenceIndices.map((index, order) => `attachment ${order + 1} = image ${index}`).join("; ")}. Use the person, product, object, background or other guidance from these attachments as the user's instructions describe, within the selected slideshow style. "My first attached image" means attachment 1, not the first slideshow style reference.`);
  }
  if (roles.regenerationReferenceIndex) {
    instructions.push(`Image ${roles.regenerationReferenceIndex} is the existing slide being edited and is the main edit target. Base the result on this image, preserving its visual content and composition except for changes requested by the user. Use the style references and attachments as guidance for those changes.`);
  }
  instructions.push("By default, generate the visual without reproducing reference captions, headlines or text overlays; editable copy is added separately through Remix Text. If the user's instructions explicitly request visible text inside the image, include the requested text in a clear readable area, preferably near the middle, with comfortable margins and without obscuring the main subject. Preserve incidental product labels unless the user asks to change them. The user's explicit instructions take priority over these defaults.");
  return `${instructions.join("\n\n")}\n\nUser instructions:\n${prompt}`;
}
