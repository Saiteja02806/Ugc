import "server-only";

import { hasAIStudioProAccess } from "@/lib/ai-studio/access-policy";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";

const PRO_ACCESS_MESSAGE = "AI Studio generation is available to Pro users.";

export function isAIStudioProUser(user: VerifiedFirebaseUser) {
  return hasAIStudioProAccess(
    user,
    process.env.AI_STUDIO_ALLOWED_EMAILS,
  );
}

export async function requireAIStudioProUser(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!isAIStudioProUser(user)) {
    throw new FirebaseAuthRequestError(PRO_ACCESS_MESSAGE, 403);
  }

  return user;
}
