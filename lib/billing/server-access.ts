import "server-only";

import { hasAIStudioProAccess } from "@/lib/ai-studio/access-policy";
import {
  BillingAccessError,
  getUserSubscription,
} from "@/lib/billing/subscription-db";
import { requireFirebaseUser } from "@/lib/firebase/server-auth";

export async function requireActivePaidUser(request: Request) {
  const user = await requireFirebaseUser(request);
  const subscription = await getUserSubscription(user.uid);
  const internalAccess = hasAIStudioProAccess(
    user,
    process.env.AI_STUDIO_ALLOWED_EMAILS,
  );

  if (!subscription.isActive && !internalAccess) {
    throw new BillingAccessError(
      "An active Starter or Growth subscription is required for this feature.",
    );
  }

  return { subscription, user };
}
