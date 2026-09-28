import { NextResponse, type NextRequest } from "next/server";

import { shouldBlockDeploymentRoute } from "@/lib/mcp/deployment-routing";

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

  if (process.env.NODE_ENV === "production" && pathname === "/create-content") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
