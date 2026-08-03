import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { updateTrendingWallTextAssignment } from "@/lib/trending/wall-text-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WallTextFeedActionSchema = z
  .object({
    action: z.enum(["restored", "selected", "skipped"]),
    assignmentId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          error:
            error.status === 401
              ? "Sign in before updating this Wall-of-text idea."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    console.error("Failed to verify Wall-of-text action requester:", error);
    return json(
      { error: "Could not verify your sign-in session.", ok: false },
      500,
    );
  }

  const parsed = WallTextFeedActionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json(
      { error: "Choose a valid Wall-of-text action.", ok: false },
      400,
    );
  }

  try {
    const assignment = await updateTrendingWallTextAssignment({
      action: parsed.data.action,
      assignmentId: parsed.data.assignmentId,
      userId,
    });

    return json({ assignment, ok: true });
  } catch (error) {
    console.error("Could not update Trending Wall-of-text idea:", error);
    return json(
      { error: "Could not update this Wall-of-text idea.", ok: false },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
