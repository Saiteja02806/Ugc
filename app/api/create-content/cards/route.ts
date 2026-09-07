import { NextResponse } from "next/server";

import {
  CreateContentCardStorageError,
  getMissingCreateContentCardEnvVars,
  listCreateContentCards,
} from "@/lib/create-content/card-storage";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    if (getMissingCreateContentCardEnvVars().length > 0) {
      return json(
        { error: "Create Content is temporarily unavailable.", ok: false },
        501,
      );
    }

    const cards = await listCreateContentCards({ userId: user.uid });
    return json({ cards, ok: true });
  } catch (error) {
    return errorResponse(error, "Could not load your Create Content cards.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (
    error instanceof FirebaseAuthRequestError ||
    error instanceof CreateContentCardStorageError
  ) {
    return json({ error: error.message, ok: false }, error.status);
  }

  console.error(fallback, error);
  return json({ error: fallback, ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
