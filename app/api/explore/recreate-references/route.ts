import { NextResponse } from "next/server";

import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    if (!(error instanceof FirebaseAuthRequestError)) {
      console.error("Could not verify Recreate access:", error);
    }
    return json({
      message: status === 401 ? "Sign in before opening Recreate." : "Could not verify your access.",
      ok: false,
    }, status);
  }

  return json({ items: getRecreateReferences(), ok: true });
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
