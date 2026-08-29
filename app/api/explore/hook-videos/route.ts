import { NextResponse } from "next/server";

import {
  getExploreHookVideos,
  getExplorePreviewVideo,
} from "@/lib/explore/hook-video-library";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getMissingStorageEnvVars } from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  if (getMissingStorageEnvVars().length > 0) {
    return json(
      { message: "Explore video storage is not configured.", ok: false },
      503,
    );
  }

  return json({
    items: getExploreHookVideos(),
    ok: true,
    preview: getExplorePreviewVideo(),
  });
}

function authErrorResponse(error: unknown) {
  const status = error instanceof FirebaseAuthRequestError ? error.status : 500;

  if (!(error instanceof FirebaseAuthRequestError)) {
    console.error("Could not verify Explore access:", error);
  }

  return json(
    {
      message:
        status === 401
          ? "Sign in before opening Explore."
          : "Could not verify your Explore access.",
      ok: false,
    },
    status,
  );
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
