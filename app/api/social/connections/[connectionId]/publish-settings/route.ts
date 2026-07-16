import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getTikTokPublishCapabilitiesForOwner,
  TikTokPublishCapabilitiesError,
} from "@/lib/social/tiktok-publish-capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  try {
    const [{ connectionId }, user] = await Promise.all([
      context.params,
      requireFirebaseUser(request),
    ]);
    const capabilities = await getTikTokPublishCapabilitiesForOwner({
      connectionId,
      userId: user.uid,
    });

    return json({ capabilities, ok: true });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          message:
            error.status === 401
              ? "Sign in before loading publishing settings."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    if (error instanceof TikTokPublishCapabilitiesError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    console.error("Failed to load TikTok publishing settings:", error);
    return json(
      {
        message: "Could not load TikTok publishing settings right now.",
        ok: false,
      },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
