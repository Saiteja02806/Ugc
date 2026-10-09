import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (
    (request.nextUrl.pathname === "/explore" || request.nextUrl.pathname.startsWith("/explore/")) &&
    process.env.NODE_ENV === "production"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex");
  if (request.nextUrl.pathname.startsWith("/auth/action")) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/audio-generation/:path*",
    "/ai-studio/:path*",
    "/analytics/:path*",
    "/avatars/:path*",
    "/connected-accounts/:path*",
    "/dashboard/:path*",
    "/demos/:path*",
    "/e2e/:path*",
    "/edit/:path*",
    "/explore/:path*",
    "/image-gen/:path*",
    "/image-test/:path*",
    "/library/:path*",
    "/onboarding/:path*",
    "/oauth/authorize/:path*",
    "/projects/:path*",
    "/scheduling/:path*",
    "/settings/:path*",
    "/sign-in/:path*",
    "/auth/action/:path*",
    "/updates/:path*",
    "/verify-email/:path*",
    "/video-gen/:path*",
    "/viral/:path*",
  ],
};
