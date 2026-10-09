/** Ordered slideshow images have distinct roles; user instructions stay intact. */
export function slideshowReferencePrompt(prompt: string, referenceCount: number, subjectReferenceIndex = 2) {
  if (referenceCount > 2 && subjectReferenceIndex === referenceCount) {
    return `Use images 1 through ${referenceCount - 1} as the slideshow layout and composition reference. Use image ${referenceCount} as the subject, product or style reference described by the user. Follow the user's changes below.\n\n${prompt}`;
  }
  return referenceCount > 1
    ? `Use image 1 as the layout and composition reference. Use image 2 as the subject, product or style reference described by the user. Follow the user's changes below.\n\n${prompt}`
    : prompt;
}
