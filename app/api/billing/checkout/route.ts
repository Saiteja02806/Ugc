import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createDodoCheckoutSession } from "@/lib/billing/dodo";
import {
  getPendingCheckoutSessionIds,
  PENDING_CHECKOUT_COOKIE_NAME,
  PENDING_CHECKOUT_MAX_AGE_SECONDS,
  serializePendingCheckoutSessionIds,
} from "@/lib/billing/pending-checkout";
import { getBillingCustomerId } from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const checkoutInputSchema = z.object({
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  planSlug: z.enum(["starter", "growth"]),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const parseResult = checkoutInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout request",
          issues: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { billingInterval, planSlug } = parseResult.data;

    const userEmail = user.email?.trim();

    if (!userEmail) {
      return NextResponse.json(
        { error: "Add a real email address to your account before subscribing." },
        { status: 400 },
      );
    }

    const customerId = await getBillingCustomerId(user.uid);
    const session = await createDodoCheckoutSession({
      billingInterval,
      customerId,
      planSlug,
      userEmail,
      userId: user.uid,
      userName: user.displayName,
    });

    const response = NextResponse.json({
      checkoutUrl: session.checkoutUrl,
      productId: session.productId,
      sessionId: session.sessionId,
      status: "ready",
    });
    const pendingCheckoutSessionIds = [
      session.sessionId,
      ...getPendingCheckoutSessionIds(
        request.cookies.get(PENDING_CHECKOUT_COOKIE_NAME)?.value,
      ),
    ];
    response.cookies.set({
      httpOnly: true,
      maxAge: PENDING_CHECKOUT_MAX_AGE_SECONDS,
      name: PENDING_CHECKOUT_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: serializePendingCheckoutSessionIds(pendingCheckoutSessionIds),
    });

    return response;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Dodo checkout creation error:", error);
    return NextResponse.json(
      { error: "Could not create secure checkout. Try again." },
      { status: 500 },
    );
  }
}
