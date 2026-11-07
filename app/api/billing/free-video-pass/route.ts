import { NextResponse } from "next/server";

import {
  claimFreeVideoPassLink,
  FreeVideoPassError,
  getUserFreeVideoPass,
  inspectFreeVideoPassCode,
} from "@/lib/billing/free-video-pass";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code =
    url.searchParams.get("code") ?? url.searchParams.get("token") ?? "";

  let viewerUserId: string | null = null;
  if (request.headers.get("authorization")) {
    try {
      const user = await requireFirebaseUser(request);
      viewerUserId = user.uid;
    } catch {
      viewerUserId = null;
    }
  }

  try {
    if (!code.trim() && viewerUserId) {
      const pass = await getUserFreeVideoPass(viewerUserId);
      return NextResponse.json(
        { ok: true, pass },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const inspection = await inspectFreeVideoPassCode(code, viewerUserId);
    return NextResponse.json(
      { inspection, ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof FreeVideoPassError) {
      return NextResponse.json(
        { error: error.message, ok: false },
        {
          headers: { "Cache-Control": "private, no-store" },
          status: error.status,
        },
      );
    }
    return NextResponse.json(
      {
        error: "Could not verify this free video link right now.",
        ok: false,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        status: 503,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json().catch(() => null)) as
      | { code?: unknown; token?: unknown }
      | null;
    const code = body?.code ?? body?.token;
    const pass = await claimFreeVideoPassLink({
      code,
      userId: user.uid,
    });

    return NextResponse.json(
      { ok: true, pass },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        { error: error.message, ok: false },
        {
          headers: { "Cache-Control": "private, no-store" },
          status: error.status,
        },
      );
    }
    if (error instanceof FreeVideoPassError) {
      return NextResponse.json(
        { code: error.code, error: error.message, ok: false },
        {
          headers: { "Cache-Control": "private, no-store" },
          status: error.status,
        },
      );
    }

    console.error("Free video pass claim error:", error);
    return NextResponse.json(
      {
        error: "Could not claim this free video link right now. Try again.",
        ok: false,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        status: 500,
      },
    );
  }
}
