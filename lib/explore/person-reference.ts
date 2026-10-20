/** Image order is part of the provider contract: main first, supporting views next. */
export type ExploreImagePurpose = "person" | "general";

export function makeMainReference<T extends { asset: { id: string } }>(images: T[], id: string): T[] {
  const main = images.find(image => image.asset.id === id);
  return main ? [main, ...images.filter(image => image.asset.id !== id)] : images;
}

export const PERSON_REFERENCE_INSTRUCTIONS = "IMAGE ROLES: Image 1 is the main face photo. All remaining images are supporting views of the SAME person, not other people, products or scene references. Use their facial features and proportions for the person's identity; do not borrow their clothing, hair, background, lighting or pose. When a source video is attached, use that video for the scene, body, actions, expressions, camera and timing. Apply the user's requested changes. Do not average the reference person's face with the original performer's face.";

export function personReferenceRoles(imageUrls: readonly string[]) {
  return {
    version: 1,
    mainImageUrl: imageUrls[0],
    supportingImageUrls: imageUrls.slice(1),
  };
}
