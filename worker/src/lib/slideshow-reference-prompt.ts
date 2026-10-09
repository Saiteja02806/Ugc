/** Ordered slideshow images have distinct roles; user instructions stay intact. */
export function slideshowReferencePrompt(prompt: string, referenceCount: number) {
  return referenceCount > 1
    ? `Use image 1 as the layout and composition reference. Use image 2 as the subject, product or style reference described by the user. Follow the user's changes below.\n\n${prompt}`
    : prompt;
}
