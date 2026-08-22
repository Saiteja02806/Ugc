import { NextResponse } from "next/server";
import { z } from "zod";

import { createDodoCheckoutSession } from "@/lib/billing/dodo";
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

export async function POST(request: Request) {
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

    const userEmail = user.email || `${user.uid}@getugcpilot.com`;
    const customerId = await getBillingCustomerId(user.uid);
    const session = await createDodoCheckoutSession({
      billingInterval,
      customerId,
      planSlug,
      userEmail,
      userId: user.uid,
      userName: user.displayName,
    });

    return NextResponse.json({
      checkoutUrl: session.checkoutUrl,
      productId: session.productId,
      sessionId: session.sessionId,
      status: "ready",
    });
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
