import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import type { PauseAutomationUpcomingAction } from "@/lib/trending/slideshow-automation-contract";
import {
  pauseSlideshowAutomation,
  SlideshowAutomationError,
} from "@/lib/trending/slideshow-automation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as {
      action?: PauseAutomationUpcomingAction;
    } | null;

    const action: PauseAutomationUpcomingAction =
      body?.action === "keep_scheduled_slots"
        ? "keep_scheduled_slots"
        : "cancel_upcoming_auto_slots";

    const result = await pauseSlideshowAutomation({
      action,
      userId: user.uid,
    });

    return json({
      automation: result.automation,
      cancelledSlotCount: result.cancelledSlotCount,
      ok: true,
      slots: result.slots,
    });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          message:
            error.status === 401
              ? "Sign in before pausing slideshow automation."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    if (error instanceof SlideshowAutomationError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    console.error("Could not pause slideshow automation:", error);
    return json(
      {
        message: "Could not pause slideshow automation right now.",
        ok: false,
      },
      500,
    );
  }
}
