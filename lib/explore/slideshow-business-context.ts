import "server-only";

import { getBusinessProfileForUser, type BusinessProfileRecord } from "@/lib/business-profiles/db";
import { parseSlideshowBusinessContext, type SlideshowBusinessContext } from "@/worker/src/lib/slideshow-business-context";

export { parseSlideshowBusinessContext, slideshowBusinessContextPrompt, type SlideshowBusinessContext } from "@/worker/src/lib/slideshow-business-context";

type ContextProfile = Pick<BusinessProfileRecord, "id" | "userId" | "profileVersion" | "context">;

export class SlideshowBusinessContextUnavailableError extends Error {
  constructor(message: string, readonly status: 409 | 503 = 409) {
    super(message);
    this.name = "SlideshowBusinessContextUnavailableError";
  }
}

/** Read only the authenticated owner's applied Settings profile, never an unapproved draft. */
export async function loadSlideshowBusinessContext(
  userId: string,
  loadProfile: (owner: string) => Promise<ContextProfile | null> = getBusinessProfileForUser,
): Promise<SlideshowBusinessContext> {
  let profile: ContextProfile | null;
  try {
    profile = await loadProfile(userId);
  } catch {
    throw new SlideshowBusinessContextUnavailableError("Could not load your business context. Try again before generating slides.", 503);
  }
  if (!profile || profile.userId !== userId || !profile.context.businessName?.trim() || !profile.context.productSummary?.trim()) {
    throw new SlideshowBusinessContextUnavailableError("Add your business name and product summary in Settings before generating slides.");
  }
  const context = profile.context;
  const snapshot = parseSlideshowBusinessContext({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    businessContext: {
      businessName: context.businessName,
      productSummary: context.productSummary,
      targetAudience: context.targetAudience,
      category: context.category,
      mainProblem: context.mainProblem,
      mainPromise: context.mainPromise,
      valueProps: context.valueProps,
      painPoints: context.painPoints,
      differentiators: context.differentiators,
      brandTone: context.brandTone,
      visualKeywords: context.visualKeywords,
      ctaIdeas: context.ctaIdeas,
      claimsToAvoid: context.claimsToAvoid,
    },
  });
  if (!snapshot) throw new SlideshowBusinessContextUnavailableError("Review and save your business context in Settings before generating slides.");
  return snapshot;
}
