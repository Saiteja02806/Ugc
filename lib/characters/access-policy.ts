import { CHARACTER_CANDIDATE_COUNT } from "./schema";
import type { CharacterGenerationAccess, CharacterGenerateRequest } from "./types";

/** All Explore generators spend the same subscription or lifetime free balance. */
export function characterAccessFromCredits(isPaid: boolean, creditsRemaining: number, imageCreditCost: number): CharacterGenerationAccess {
  if (!Number.isSafeInteger(creditsRemaining) || creditsRemaining < 0 ||
      !Number.isSafeInteger(imageCreditCost) || imageCreditCost < 1) {
    throw new Error("Invalid character credit balance.");
  }
  const affordableImageCount = Math.min(CHARACTER_CANDIDATE_COUNT, Math.floor(creditsRemaining / imageCreditCost));
  return {
    isPaid,
    canGenerate: affordableImageCount > 0,
    freeGenerationAvailable: !isPaid && affordableImageCount > 0,
    // Retain the default for old clients that omit imageCount. New clients choose explicitly.
    requestedCount: isPaid ? 3 : 1,
    creditsRequired: imageCreditCost * (isPaid ? 3 : 1),
    imageCreditCost,
    affordableImageCount,
    creditsRemaining,
    message: affordableImageCount > 0 ? null : "You don’t have enough credits to create an image. Get more credits to continue.",
  };
}

export function characterRequestCount(access: CharacterGenerationAccess, request: CharacterGenerateRequest) {
  const count = request.imageCount ?? access.requestedCount;
  return count <= access.affordableImageCount ? count : null;
}
