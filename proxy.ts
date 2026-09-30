import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/create-content" &&
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
    "/ai-studio/:path*",
    "/analytics/:path*",
    "/avatars/:path*",
    "/connected-accounts/:path*",
    "/create-content/:path*",
    "/dashboard/:path*",
    "/demos/:path*",
    "/e2e/:path*",
    "/edit/:path*",
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
