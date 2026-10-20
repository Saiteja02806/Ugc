/** Ordered slideshow images have distinct roles; user instructions stay intact. */
export function slideshowReferencePrompt(prompt: string, referenceCount: number, subjectReferenceIndex = 2) {
  if (referenceCount > 2 && subjectReferenceIndex === referenceCount) {
    return `Use images 1 through ${referenceCount - 1} as the slideshow layout and composition reference. Use image ${referenceCount} as the subject, product or style reference described by the user. Follow the user's changes below.\n\n${prompt}`;
  }
  return referenceCount > 1
    ? `Use image 1 as the layout and composition reference. Use image 2 as the subject, product or style reference described by the user. Follow the user's changes below.\n\n${prompt}`
    : prompt;
}

/** New multi-attachment requests identify the primary layout and every added reference. */
export function slideshowReferenceImagesPrompt(prompt: string, referenceCount: number, additionalReferenceStartIndex: number, regenerationReferenceIndex?: number) {
  const imageRange = (first: number, last: number) => first === last ? `image ${first}` : `images ${first} through ${last}`;
  const layouts = additionalReferenceStartIndex - 1;
  const attachmentEnd = regenerationReferenceIndex ? regenerationReferenceIndex - 1 : referenceCount;
  const instructions = layouts
    ? `Use image 1 as the primary slideshow layout and composition reference.${layouts > 1 ? ` Use ${imageRange(2, layouts)} as additional slideshow layout context.` : ""}`
    : "";
  const attachments = attachmentEnd >= additionalReferenceStartIndex ? `Use ${imageRange(additionalReferenceStartIndex, attachmentEnd)} as the user's ${layouts ? "additional " : ""}image references, according to their instructions. These are the attached references in the user's selected order.` : "";
  const regeneration = regenerationReferenceIndex ? `Use image ${regenerationReferenceIndex} as the existing slide being edited, keeping its content except where the user asks for changes.` : "";
  return `${[instructions, attachments, regeneration, "Generate one image. Follow the user's changes below."].filter(Boolean).join(" ")}\n\n${prompt}`;
}
