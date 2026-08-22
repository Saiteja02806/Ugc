import { NextResponse } from "next/server";

import { createDodoCustomerPortalSession } from "@/lib/billing/dodo";
import { getBillingCustomerId } from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const customerId = await getBillingCustomerId(user.uid);

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account is available for this user." },
        { status: 404 },
      );
    }

    const portalUrl = await createDodoCustomerPortalSession({ customerId });

    return NextResponse.json(
      { portalUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Dodo customer portal creation error:", error);
    return NextResponse.json(
      { error: "Could not open the billing portal." },
      { status: 500 },
    );
  }
}
