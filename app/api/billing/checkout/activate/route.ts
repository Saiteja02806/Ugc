import { after, NextRequest, NextResponse } from "next/server";

import { reconcileCheckoutActivation } from "@/lib/billing/checkout-activation";
import {
  getPendingCheckoutSessionIds,
  PENDING_CHECKOUT_COOKIE_NAME,
} from "@/lib/billing/pending-checkout";
import { dispatchPaidTrendingPrebuild } from "@/lib/billing/paid-trending-prebuild-dispatch";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const checkoutSessionIds = getPendingCheckoutSessionIds(
      request.cookies.get(PENDING_CHECKOUT_COOKIE_NAME)?.value,
    );
    const result = await reconcileCheckoutActivation({ checkoutSessionIds, user });
    const { prebuildDispatch, ...publicResult } = result;

    if (prebuildDispatch) {
      after(() => dispatchPaidTrendingPrebuild(prebuildDispatch));
    }

    const response = NextResponse.json(
      publicResult,
      { headers: { "Cache-Control": "private, no-store" } },
    );

    if (publicResult.status !== "pending") {
      response.cookies.delete(PENDING_CHECKOUT_COOKIE_NAME);
    }

    return response;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Dodo checkout activation error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Could not confirm the completed checkout. Try again shortly." },
      { status: 502 },
    );
  }
}
