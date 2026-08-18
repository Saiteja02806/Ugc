import "server-only";

import { hasCarouselAdminAccess } from "@/lib/carousel/admin-access";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";

const ADMIN_ACCESS_MESSAGE =
  "This account does not have Carousel administration access.";
const ADMIN_CONFIGURATION_MESSAGE =
  "Carousel administration access is not configured.";

export function isCarouselAdmin(user: VerifiedFirebaseUser) {
  return hasCarouselAdminAccess(user, process.env.CAROUSEL_ADMIN_EMAILS);
}
export async function requireCarouselAdmin(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!process.env.CAROUSEL_ADMIN_EMAILS?.trim()) {
    throw new FirebaseAuthRequestError(ADMIN_CONFIGURATION_MESSAGE, 503);
  }

  if (!isCarouselAdmin(user)) {
    throw new FirebaseAuthRequestError(ADMIN_ACCESS_MESSAGE, 403);
  }

  return user;
}
