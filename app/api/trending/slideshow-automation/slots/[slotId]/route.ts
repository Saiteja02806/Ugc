import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  mutateAutomationSlot,
  SlideshowAutomationError,
} from "@/lib/trending/slideshow-automation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slotId: string }>;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireFirebaseUser(request);
    const { slotId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      action?: "cancel" | "retry" | "skip";
    } | null;

    if (
      body?.action !== "cancel" &&
      body?.action !== "retry" &&
      body?.action !== "skip"
    ) {
      return json(
        { message: "Specify retry, skip, or cancel for this slot.", ok: false },
        400,
      );
    }

    const result = await mutateAutomationSlot({
      action: body.action,
      slotId,
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
              ? "Sign in before updating this slot."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    if (error instanceof SlideshowAutomationError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    console.error("Could not update automation slot:", error);
    return json(
      { message: "Could not update this automation slot right now.", ok: false },
      500,
    );
  }
}
