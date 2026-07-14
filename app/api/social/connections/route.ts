import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { listSocialConnections } from "@/lib/social/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const connections = await listSocialConnections(user.uid);

    return NextResponse.json(
      { ok: true, connections },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load social connections.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      { ok: false, message },
      { headers: { "Cache-Control": "no-store" }, status },
    );
  }
}
