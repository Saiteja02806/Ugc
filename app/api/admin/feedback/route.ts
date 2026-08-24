import { NextResponse } from "next/server";

import { isProductFeedbackAdmin } from "@/lib/feedback/server-admin-access";
import {
  listProductFeedback,
  ProductFeedbackStoreError,
} from "@/lib/feedback/product-feedback-store";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);

    if (!isProductFeedbackAdmin(user)) {
      return json({ canReview: false, ok: true, submissions: [] });
    }

    const submissions = await listProductFeedback(100);
    return json({ canReview: true, ok: true, submissions });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    if (error instanceof ProductFeedbackStoreError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    console.error("Could not load product feedback:", error);
    return json(
      { message: "Could not load customer requests. Try again.", ok: false },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
