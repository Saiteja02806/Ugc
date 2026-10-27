import { NextResponse } from "next/server";

import type { CarouselManualTextStyle } from "@/lib/carousel/manual-text";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  deleteCarouselVisualStylePreset,
  saveCarouselVisualStylePreset,
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
      id?: string;
      name?: string;
      style?: CarouselManualTextStyle;
      textPosition?: { x: number; y: number };
    } | null;

    if (!body?.name || !body.style) {
      return json(
        {
          message: "Provide a style name and valid visual appearance settings.",
          ok: false,
        },
        400,
      );
    }

    const preset = await saveCarouselVisualStylePreset({
      id: body.id,
      name: body.name,
      style: body.style,
      textPosition: body.textPosition,
      userId: user.uid,
    });

    return json({ ok: true, preset }, 201);
  } catch (error) {
    return handleRouteError(error, "Could not save visual style preset.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as {
      styleId?: string;
    } | null;

    if (!body?.styleId) {
      return json(
        { message: "Provide a visual style ID to remove.", ok: false },
        400,
      );
    }

    await deleteCarouselVisualStylePreset({
      styleId: body.styleId,
      userId: user.uid,
    });

    return json({ deleted: true, ok: true });
  } catch (error) {
    return handleRouteError(error, "Could not remove visual style preset.");
  }
}

function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before managing visual styles."
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
