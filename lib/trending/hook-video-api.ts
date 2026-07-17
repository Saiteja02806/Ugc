import "server-only";

import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";
import { HookVideoSourceError } from "@/lib/trending/hook-video-sources";

export type AuthenticatedHookVideoRequest =
  | { ok: true; user: VerifiedFirebaseUser }
  | { ok: false; response: NextResponse };

export async function authenticateHookVideoRequest(
  request: Request,
): Promise<AuthenticatedHookVideoRequest> {
  try {
    return { ok: true, user: await requireFirebaseUser(request) };
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return {
        ok: false,
        response: hookVideoJson(
          {
            error:
              error.status === 401
                ? "Sign in before creating hook videos."
                : error.message,
            ok: false,
          },
          error.status,
        ),
      };
    }

    console.error("Failed to verify Hook videos requester:", error);
    return {
      ok: false,
      response: hookVideoJson(
        {
          error: "Could not verify your sign-in session.",
          ok: false,
        },
        500,
      ),
    };
  }
}

export function hookVideoJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function hookVideoErrorResponse(
  error: unknown,
  fallback: string,
) {
  if (error instanceof HookVideoSourceError) {
    return hookVideoJson({ error: error.message, ok: false }, error.status);
  }

  console.error(fallback, error);
  return hookVideoJson({ error: fallback, ok: false }, 500);
}
