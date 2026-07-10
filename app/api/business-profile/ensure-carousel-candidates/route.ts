import { NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  updateBusinessProfilePreparation,
} from "@/lib/business-profiles/db";
import { prepareBusinessProfileCarousels } from "@/lib/carousel/prepare-business-profile";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    const message =
      error instanceof FirebaseAuthRequestError
        ? error.status === 401
          ? "Sign in before preparing carousel ideas."
          : error.message
        : "Could not verify your sign-in session.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({ ok: false, message }, status);
  }

  try {
    const profile = await getBusinessProfileForUser(userId);

    if (!profile) {
      return json(
        { ok: false, message: "Complete your business profile first." },
        404,
      );
    }

    const preparation = await prepareBusinessProfileCarousels(profile);
    return json({ ok: true, preparation });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not prepare additional carousel ideas.";

    const profile = await getBusinessProfileForUser(userId).catch(() => null);

    if (profile) {
      await updateBusinessProfilePreparation({
        error: message,
        profileId: profile.id,
        status: "failed",
      }).catch(() => undefined);
    }

    return json({ ok: false, message }, 502);
  }
}
