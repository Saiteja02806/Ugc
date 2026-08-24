import "server-only";

import { getUserSubscription } from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";

const PRO_ACCESS_MESSAGE =
  "An active Starter or Growth subscription is required for AI Studio generation.";

export async function isAIStudioProUser(user: VerifiedFirebaseUser) {
  const subscription = await getUserSubscription(user.uid);

  return subscription.isActive;
}

export async function requireAIStudioProUser(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!(await isAIStudioProUser(user))) {
    throw new FirebaseAuthRequestError(PRO_ACCESS_MESSAGE, 403);
  }

  return user;
}
