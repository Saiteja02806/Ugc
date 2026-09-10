import "server-only";

import { hasBillingAdminAccess } from "./admin-access";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";

const ADMIN_ACCESS_MESSAGE =
  "This account does not have billing administration access.";
const ADMIN_CONFIGURATION_MESSAGE =
  "Billing administration access is not configured.";

export function isBillingAdmin(user: VerifiedFirebaseUser) {
  return hasBillingAdminAccess(user, process.env.BILLING_ADMIN_EMAILS);
}

export async function requireBillingAdmin(request: Request) {
  const user = await requireFirebaseUser(request);

  if (!process.env.BILLING_ADMIN_EMAILS?.trim()) {
    throw new FirebaseAuthRequestError(ADMIN_CONFIGURATION_MESSAGE, 503);
  }

  if (!isBillingAdmin(user)) {
    throw new FirebaseAuthRequestError(ADMIN_ACCESS_MESSAGE, 403);
  }

  return user;
}
