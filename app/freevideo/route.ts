import { NextResponse } from "next/server";

import {
  FREE_VIDEO_PASS_COOKIE_NAME,
  normalizeFreeVideoPassCode,
} from "@/lib/billing/free-video-pass";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawCode =
    url.searchParams.get("code") ??
    url.searchParams.get("pass") ??
    url.searchParams.get("token");
  const code = normalizeFreeVideoPassCode(rawCode);

  const response = NextResponse.redirect(new URL("/explore", request.url), {
    status: 307,
  });
  response.headers.set("Cache-Control", "private, no-store");

  if (code) {
    response.cookies.set(FREE_VIDEO_PASS_COOKIE_NAME, code, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
