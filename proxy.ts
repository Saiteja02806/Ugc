import { NextResponse, type NextRequest } from "next/server";

import { shouldBlockDeploymentRoute } from "@/lib/mcp/deployment-routing";
import { isLegacyPublicHostname, resolvePrimaryAppOrigin } from "@/lib/marketing/public-origin";

const privateRoutePrefixes = [
  "/ai-studio", "/analytics", "/avatars", "/connected-accounts",
  "/audio-generation", "/explore",
  "/create-content", "/dashboard", "/demos", "/e2e", "/edit",
  "/image-gen", "/image-test", "/library", "/onboarding",
  "/oauth/authorize", "/projects", "/scheduling", "/settings",
  "/sign-in", "/auth/action", "/updates", "/verify-email",
  "/video-gen", "/viral",
];

const protectedLegacyPrefixes = [
  "/api/",
  "/__/auth/",
  "/__/firebase/",
  "/_next/",
  "/brand/",
];

const protectedLegacyExactPaths = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isProtectedLegacyRoute(pathname: string): boolean {
  if (protectedLegacyExactPaths.has(pathname)) {
    return true;
  }
  return protectedLegacyPrefixes.some(
    (prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix),
  );
}

function isBrowserDocument(request: NextRequest) {
  return request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = request.nextUrl.hostname.toLowerCase().replace(/\.$/u, "");
  const mcpHost = process.env.MCP_ONLY_DEPLOYMENT === "true" || hostname === "mcp.getugcpilot.com";

  // The protocol handler owns /mcp on the MCP host. The website serves the
  // landing page for every GET, and for browser requests during local dev.
  const serveMarketingPage = process.env.NODE_ENV === "production" || isBrowserDocument(request);
  if (!mcpHost && pathname === "/mcp" && request.method === "GET" && serveMarketingPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/mcp-server";
    return NextResponse.rewrite(url);
  }
  if (shouldBlockDeploymentRoute({
    hostname: request.nextUrl.hostname,
    isMcpOnlyDeployment: process.env.MCP_ONLY_DEPLOYMENT === "true",
    isProduction: process.env.NODE_ENV === "production",
    pathname,
  })) {
    return new NextResponse(null, { status: 404 });
  }

  // When a visitor requests a normal page on the legacy domain, redirect to vidmake.io.
  // Legacy OAuth callbacks, webhooks, and internal Cloud Tasks endpoints remain on the old domain without redirect.
  if (isLegacyPublicHostname(hostname) && !isProtectedLegacyRoute(pathname)) {
    const primaryDomain = resolvePrimaryAppOrigin();
    let targetHostname = "";
    try {
      targetHostname = new URL(primaryDomain).hostname.toLowerCase();
    } catch {}

    if (targetHostname && targetHostname !== hostname) {
      const search = request.nextUrl.search || "";
      const targetUrl = new URL(pathname + search, primaryDomain);
      targetUrl.searchParams.set("moved", "1");
      // This is a permanent public-domain migration. A 308 keeps the method
      // intact while telling crawlers and browsers to consolidate signals on
      // Vidmake rather than treating the move as temporary.
      return NextResponse.redirect(targetUrl, 308);
    }
  }

  if (!mcpHost && pathname === "/" && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = "/explore";
    return NextResponse.redirect(url, 307);
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
