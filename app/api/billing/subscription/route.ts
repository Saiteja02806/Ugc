import { NextResponse } from "next/server";

import { getUserSubscription } from "@/lib/billing/subscription-db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const subscription = await getUserSubscription(user.uid);

    return NextResponse.json(
      { subscription },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
