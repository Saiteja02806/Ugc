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

  // "isPro" is the existing client capability flag. Free generation credits
  // enable AI Studio without activating a subscription or other paid features.
  return subscription.isActive || subscription.freeGenerationCredits.granted > 0;
}

export async function requireAIStudioProUser(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!(await isAIStudioProUser(user))) {
    throw new FirebaseAuthRequestError(PRO_ACCESS_MESSAGE, 403);
  }

  return user;
}
