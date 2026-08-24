import "server-only";

import { hasProductFeedbackAdminAccess } from "@/lib/feedback/admin-access";
import type { VerifiedFirebaseUser } from "@/lib/firebase/server-auth";

export function isProductFeedbackAdmin(user: VerifiedFirebaseUser) {
  return hasProductFeedbackAdminAccess(
    user,
    process.env.PRODUCT_FEEDBACK_ADMIN_EMAILS?.trim() ||
      process.env.CAROUSEL_ADMIN_EMAILS,
  );
}
