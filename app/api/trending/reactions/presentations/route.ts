import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { recordReactionPresentation } from "@/lib/trending/reaction-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReactionPresentationSchema = z
  .object({
    assignmentId: z.string().uuid(),
    clipAssetId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authError(error);
  }

  const parsed = ReactionPresentationSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json({ message: "Invalid Reaction presentation.", ok: false }, 400);
  }

  try {
    await recordReactionPresentation({ ...parsed.data, userId });
    return json({ ok: true });
  } catch (error) {
    console.error("Could not record Reaction presentation:", error);
    return json({ message: "Could not record this Reaction view.", ok: false }, 500);
  }
}

function authError(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before viewing Reaction content."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error("Failed to verify Reaction presentation requester:", error);
  return json({ message: "Could not verify your sign-in session.", ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
