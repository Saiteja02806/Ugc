import { NextResponse, type NextRequest } from "next/server";

function isMcpPath(pathname: string) {
  return pathname === "/mcp" || pathname.startsWith("/mcp/") ||
    pathname === "/oauth" || pathname.startsWith("/oauth/") ||
    pathname === "/.well-known" || pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/__/auth/") || pathname.startsWith("/__/firebase/") ||
    pathname === "/icons/google.svg" || pathname === "/favicon.ico";
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (process.env.MCP_ONLY_DEPLOYMENT === "true" ||
      request.nextUrl.hostname.toLowerCase() === "mcp.getugcpilot.com") {
    return isMcpPath(pathname)
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }

  if (process.env.NODE_ENV === "production" && pathname === "/create-content") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
