import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { listTikTokPublicVideoAnalyticsForOwner } from "@/lib/analytics/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    return json(
      {
        ok: false,
        message:
          status === 401
            ? "Sign in before viewing TikTok analytics."
            : error instanceof Error
              ? error.message
              : "Could not verify your sign-in session.",
      },
      status,
    );
  }

  try {
    const accounts = await listTikTokPublicVideoAnalyticsForOwner({ userId });

    return json({ accounts, ok: true });
  } catch (error) {
    console.error("Failed to load TikTok analytics:", error);

    return json(
      {
        ok: false,
        message: "Could not load TikTok analytics right now.",
      },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
