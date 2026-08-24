import "server-only";

import {
  BillingAccessError,
  getUserSubscription,
} from "@/lib/billing/subscription-db";
import { requireFirebaseUser } from "@/lib/firebase/server-auth";

export async function requireActivePaidUser(request: Request) {
  const user = await requireFirebaseUser(request);
  const subscription = await getUserSubscription(user.uid);

  if (!subscription.isActive) {
    throw new BillingAccessError(
      "An active Starter or Growth subscription is required for this feature.",
    );
  }

  return { subscription, user };
}
