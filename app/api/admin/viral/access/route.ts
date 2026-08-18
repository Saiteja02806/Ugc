import { NextResponse } from "next/server";

import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { requireViralReviewer } from "@/lib/viral/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireViralReviewer(request);

    return json({ hasAccess: true, ok: true });
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    if (!(error instanceof FirebaseAuthRequestError)) {
      console.error("Could not verify the Explore reviewer:", error);
    }

    return json(
      {
        hasAccess: false,
        message:
          status === 503
            ? "Explore reviewer access is temporarily unavailable."
            : status === 403
              ? "This account does not have Explore access."
              : status === 401
                ? "Sign in before opening Explore."
                : "Could not verify your Explore access.",
        ok: false,
      },
      status,
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
