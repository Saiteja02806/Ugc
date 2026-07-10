import { NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  retryBusinessProfile,
  updateBusinessProfilePreparation,
} from "@/lib/business-profiles/db";
import { prepareBusinessProfileCarousels } from "@/lib/carousel/prepare-business-profile";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = (await requireFirebaseUser(request)).uid;
    const profile = await getBusinessProfileForUser(userId);
    if (!profile) return NextResponse.json({ ok: false, message: "Complete your business profile first." }, { status: 404 });

    const retriedProfile = await retryBusinessProfile(profile);
    try {
      const preparation = await prepareBusinessProfileCarousels(retriedProfile);
      return NextResponse.json({ ok: true, preparation }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not retry carousel preparation.";
      await updateBusinessProfilePreparation({ error: message, profileId: retriedProfile.id, status: "failed" });
      return NextResponse.json({ ok: false, message }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not retry carousel preparation.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
