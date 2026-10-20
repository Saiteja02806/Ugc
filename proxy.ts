import { NextResponse, type NextRequest } from "next/server";

import { shouldBlockDeploymentRoute } from "@/lib/mcp/deployment-routing";

const privateRoutePrefixes = [
  "/ai-studio", "/analytics", "/avatars", "/connected-accounts",
  "/audio-generation", "/explore",
  "/create-content", "/dashboard", "/demos", "/e2e", "/edit",
  "/image-gen", "/image-test", "/library", "/onboarding",
  "/oauth/authorize", "/projects", "/scheduling", "/settings",
  "/sign-in", "/auth/action", "/updates", "/verify-email",
  "/video-gen", "/viral",
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (shouldBlockDeploymentRoute({
    hostname: request.nextUrl.hostname,
    isMcpOnlyDeployment: process.env.MCP_ONLY_DEPLOYMENT === "true",
    isProduction: process.env.NODE_ENV === "production",
    pathname,
  })) {
    return new NextResponse(null, { status: 404 });
  }

  // Authenticated pages/API rollout guards own Explore/Audio availability.
  // Keep the separate MCP deployment boundary above, not a blanket UI 404.
  const response = NextResponse.next();
  if (privateRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  if (pathname === "/auth/action" || pathname.startsWith("/auth/action/")) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: "/:path*",
};
