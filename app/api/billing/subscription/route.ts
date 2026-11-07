import { NextResponse } from "next/server";

import {
  claimFreeVideoPassLink,
  FREE_VIDEO_PASS_COOKIE_NAME,
  FreeVideoPassError,
  getUserFreeVideoPass,
  readPendingFreeVideoPassCodeFromRequest,
  type FreeVideoPassStatus,
} from "@/lib/billing/free-video-pass";
import { getUserSubscription } from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const subscription = await getUserSubscription(user.uid, { strict: true });
    const pendingCode = readPendingFreeVideoPassCodeFromRequest(request);
    let shouldClearCookie = false;
    let freeVideoPass: FreeVideoPassStatus | null = null;

    if (!subscription.isActive) {
      if (pendingCode) {
        try {
          freeVideoPass = await claimFreeVideoPassLink({
            code: pendingCode,
            userId: user.uid,
          });
          shouldClearCookie = true;
        } catch (claimError) {
          if (
            claimError instanceof FreeVideoPassError &&
            [400, 404, 409, 410].includes(claimError.status)
          ) {
            shouldClearCookie = true;
          }
          freeVideoPass = await getUserFreeVideoPass(user.uid);
        }
      } else {
        freeVideoPass = await getUserFreeVideoPass(user.uid);
      }
    } else if (pendingCode) {
      shouldClearCookie = true;
    }

    const response = NextResponse.json(
      { subscription: { ...subscription, freeVideoPass } },
      { headers: { "Cache-Control": "private, no-store" } },
    );

    if (shouldClearCookie) {
      response.cookies.set(FREE_VIDEO_PASS_COOKIE_NAME, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Could not load billing status. Try again." },
      { status: 500 },
    );
  }
}
