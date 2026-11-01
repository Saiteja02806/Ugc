import "server-only";

import { getUserSubscription } from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";

const PRO_ACCESS_MESSAGE =
  "Your free generation credits have been used. Choose Starter or Growth for more AI credits.";

export async function isAIStudioProUser(user: VerifiedFirebaseUser) {
  const subscription = await getUserSubscription(user.uid, { strict: true });

  // "isPro" is the existing client capability flag for Explore and AI Studio
  // routes. A free account can open those routes, and generation still requires
  // a paid credit balance.
  return subscription.isActive || subscription.planKey === "free" || subscription.freeGenerationCredits.granted > 0;
}

export async function requireAIStudioProUser(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!(await isAIStudioProUser(user))) {
    throw new FirebaseAuthRequestError(PRO_ACCESS_MESSAGE, 403);
  }

  return user;
}
