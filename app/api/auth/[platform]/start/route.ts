import { NextResponse } from "next/server";

import {
  createAuthorizationUrl,
  isSocialPlatform,
  SocialOAuthError,
} from "@/lib/social/oauth";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

type StartBody = {
  redirectTo?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ platform: string }> },
) {
  const { platform } = await context.params;

  if (!isSocialPlatform(platform)) {
    return json({ ok: false, message: "Unsupported social platform." }, 404);
  }

  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not verify your sign-in session.";
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({ ok: false, message }, status);
  }

  const body = await readJsonBody<StartBody>(request);
  const redirectTo =
    typeof body?.redirectTo === "string" ? body.redirectTo : undefined;

  try {
    const url = await createAuthorizationUrl({
      platform,
      redirectTo,
      userId,
    });

    return json({ ok: true, url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not start account connection.";
    const status = error instanceof SocialOAuthError ? error.status : 500;
    return json({ ok: false, message }, status);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

async function readJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
