import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import type { TrendingSlideshowAutomationConfig } from "@/lib/trending/slideshow-automation-contract";
import {
  loadSlideshowAutomationWorkspaceState,
  getExistingAutomationRecord,
  saveAutomationDraftOrSettings,
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

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    if (new URL(request.url).searchParams.get("statusOnly") === "1") {
      const automation = await getExistingAutomationRecord({ userId: user.uid, dailyAllowance: 5 });
      return json({ ok: true, status: automation?.status ?? null });
    }
    const timezone = new URL(request.url).searchParams.get("timezone");
    const state = await loadSlideshowAutomationWorkspaceState({
      timezone,
      userId: user.uid,
    });
    return json({ ok: true, state });
  } catch (error) {
    return handleRouteError(
      error,
      "Could not load Trending slideshow automation.",
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as {
      config?: TrendingSlideshowAutomationConfig;
    } | null;

    if (!body?.config || typeof body.config !== "object") {
      return json(
        {
          message: "Provide a valid slideshow automation configuration.",
          ok: false,
        },
        400,
      );
    }

    const automation = await saveAutomationDraftOrSettings({
      config: body.config,
      userId: user.uid,
    });

    return json({ automation, ok: true });
  } catch (error) {
    return handleRouteError(
      error,
      "Could not save Trending slideshow automation.",
    );
  }
}

function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before configuring slideshow automation."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  if (error instanceof SlideshowAutomationError) {
    return json({ message: error.message, ok: false }, error.status);
  }

  console.error(fallbackMessage, error);
  return json({ message: fallbackMessage, ok: false }, 500);
}
