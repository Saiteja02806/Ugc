import { NextResponse } from "next/server";

import { readOrRefreshSocialAnalytics } from "@/lib/analytics/social-snapshot";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { hasTikTokBetaAccess } from "@/lib/social/tiktok-beta-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let userId: string;
  let user: Awaited<ReturnType<typeof requireFirebaseUser>>;

  try {
    user = await requireFirebaseUser(request);
    userId = user.uid;
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return json({
      message:
        status === 401
          ? "Sign in before viewing TikTok analytics."
          : "Could not verify your sign-in session.",
      ok: false,
    }, status);
  }

  if (!hasTikTokBetaAccess(user)) {
    return json(
      {
        code: "tiktok_beta_access_required",
        message: "TikTok analytics are not enabled for this account.",
        ok: false,
      },
      403,
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await readOrRefreshSocialAnalytics({
      force: body?.force === true,
      operation: "tiktok_videos",
      userId,
    });
    return json(result, 200);
  } catch (error) {
    console.error("Could not queue TikTok analytics synchronization:", error);
    return json({ message: "Could not start TikTok analytics synchronization.", ok: false }, 502);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" }, status });
}
