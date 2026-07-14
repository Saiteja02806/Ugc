import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { disconnectSocialConnection } from "@/lib/social/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params;

  try {
    const user = await requireFirebaseUser(request);
    const connection = await disconnectSocialConnection({
      connectionId,
      userId: user.uid,
    });

    if (!connection) {
      return json({ ok: false, message: "Connection was not found." }, 404);
    }

    return json({ ok: true, connection });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not disconnect social account.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({ ok: false, message }, status);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
