import { NextResponse } from "next/server";

import { listInstagramContentInsightsForOwner } from "@/lib/analytics/instagram-content";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedRanges = new Set<InstagramInsightsRangeDays>([7, 30, 90]);

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return json(
      {
        ok: false,
        message:
          status === 401
            ? "Sign in before viewing Instagram content performance."
            : error instanceof Error
              ? error.message
              : "Could not verify your sign-in session.",
      },
      status,
    );
  }

  const requestedDays = Number(new URL(request.url).searchParams.get("days"));

  if (!supportedRanges.has(requestedDays as InstagramInsightsRangeDays)) {
    return json(
      {
        ok: false,
        message: "Choose a supported Instagram content date range.",
      },
      400,
    );
  }

  try {
    const accounts = await listInstagramContentInsightsForOwner({
      days: requestedDays as InstagramInsightsRangeDays,
      userId,
    });

    return json({ accounts, ok: true });
  } catch (error) {
    console.error("Failed to load Instagram content performance:", error);

    return json(
      {
        ok: false,
        message: "Instagram content performance could not load right now.",
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
