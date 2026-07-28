import { NextResponse } from "next/server";

import { isAIStudioProUser } from "@/lib/ai-studio/server-access";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);

    return NextResponse.json(
      {
        isPro: isAIStudioProUser(user),
        ok: true,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return NextResponse.json(
      {
        isPro: false,
        message:
          error instanceof FirebaseAuthRequestError
            ? error.message
            : "Could not verify AI Studio access.",
        ok: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status,
      },
    );
  }
}
