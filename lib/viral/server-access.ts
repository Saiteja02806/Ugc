import "server-only";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";
import { hasViralReviewerAccess } from "@/lib/viral/reviewer-access";

const REVIEWER_ACCESS_MESSAGE =
  "Explore is restricted to approved reviewer accounts.";
const REVIEWER_CONFIGURATION_MESSAGE =
  "Explore reviewer access is not configured.";

export function isViralReviewer(user: VerifiedFirebaseUser) {
  return hasViralReviewerAccess(
    user,
    process.env.EXPLORE_REVIEWER_EMAILS,
  );
}

export async function requireViralReviewer(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!process.env.EXPLORE_REVIEWER_EMAILS?.trim()) {
    throw new FirebaseAuthRequestError(REVIEWER_CONFIGURATION_MESSAGE, 503);
  }

  if (!isViralReviewer(user)) {
    throw new FirebaseAuthRequestError(REVIEWER_ACCESS_MESSAGE, 403);
  }

  return user;
}
