import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CarouselAdminStoreError,
  getCarouselAdminDashboard,
  setCarouselAdminStructureMode,
} from "@/lib/carousel/admin-store";
import { requireCarouselAdmin } from "@/lib/carousel/server-admin-access";
import { CAROUSEL_STRUCTURE_MODES } from "@/lib/carousel/structure";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateStructureModeSchema = z
  .object({
    structureMode: z.enum(CAROUSEL_STRUCTURE_MODES),
  })
  .strict();

export async function GET(request: Request) {
  try {
    await requireCarouselAdmin(request);
    const dashboard = await getCarouselAdminDashboard(30);

    return json({ dashboard, ok: true });
  } catch (error) {
    return errorResponse(error, "load");
  }
}
export async function PATCH(request: Request) {
  let adminUserId: string;

  try {
    const admin = await requireCarouselAdmin(request);
    adminUserId = admin.uid;
  } catch (error) {
    return errorResponse(error, "update");
  }

  const body = UpdateStructureModeSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!body.success) {
    return json(
      { message: "Choose a valid Carousel routing mode.", ok: false },
      400,
    );
  }

  try {
    const settings = await setCarouselAdminStructureMode({
      structureMode: body.data.structureMode,
      updatedByUserId: adminUserId,
    });

    return json({ ok: true, settings });
  } catch (error) {
    return errorResponse(error, "update");
  }
}

function errorResponse(error: unknown, operation: "load" | "update") {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before managing Carousel routing."
            : error.status === 503
              ? "Carousel administration is temporarily unavailable."
              : "This account does not have Carousel administration access.",
        ok: false,
      },
      error.status,
    );
  }

  if (error instanceof CarouselAdminStoreError) {
    console.error(`Could not ${operation} Carousel administration data:`, error);
    return json(
      {
        message:
          operation === "load"
            ? "Could not load Carousel administration data. Try again."
            : "Could not update Carousel routing. Try again.",
        ok: false,
      },
      error.status,
    );
  }

  console.error(`Could not ${operation} Carousel administration data:`, error);
  return json(
    {
      message:
        operation === "load"
          ? "Could not load Carousel administration data. Try again."
          : "Could not update Carousel routing. Try again.",
      ok: false,
    },
    500,
  );
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
