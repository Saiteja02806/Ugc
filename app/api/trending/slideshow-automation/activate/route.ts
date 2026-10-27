import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import type { TrendingSlideshowAutomationConfig } from "@/lib/trending/slideshow-automation-contract";
import {
  activateSlideshowAutomation,
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
      config?: TrendingSlideshowAutomationConfig;
    } | null;

    const result = await activateSlideshowAutomation({
      config: body?.config,
      userId: user.uid,
    });

    return json({
      automation: result.automation,
      ok: true,
      slots: result.slots,
    });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          message:
            error.status === 401
              ? "Sign in before activating slideshow automation."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    if (error instanceof SlideshowAutomationError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    console.error("Could not activate slideshow automation:", error);
    return json(
      {
        message: "Could not activate slideshow automation right now.",
        ok: false,
      },
      500,
    );
  }
}
