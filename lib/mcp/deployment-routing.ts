const MCP_HOSTNAME = "mcp.getugcpilot.com";

export function isMcpExclusivePath(pathname: string) {
  // /mcp and /mcp/health are the protocol endpoints. Marketing pages such as
  // /mcp/claude stay on the website deployment.
  return pathname === "/mcp" || pathname === "/mcp/health" || pathname.startsWith("/mcp/health/") ||
    pathname === "/oauth" || pathname.startsWith("/oauth/") ||
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname.startsWith("/.well-known/oauth-protected-resource/");
}

export function isMcpDeploymentPath(pathname: string) {
  return isMcpExclusivePath(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/__/auth/") || pathname.startsWith("/__/firebase/") ||
    pathname === "/icons/google.svg" || pathname === "/favicon.ico";
}

export function shouldBlockDeploymentRoute(input: {
  hostname: string;
  isMcpOnlyDeployment: boolean;
  isProduction: boolean;
  pathname: string;
  /**
   * Optional cutover flag. When true on the website deployment, the MCP protocol
   * routes (/mcp, /oauth/*, /.well-known/oauth-*) are served at vidmake.io so
   * the public endpoint can move off the legacy MCP host. Defaults to false to
   * preserve the isolated-deployment contract for every existing test and host.
   */
  allowMcpProtocolOnWebsite?: boolean;
}) {
  const hostname = input.hostname.toLowerCase().replace(/\.$/u, "");
  const isMcpDeployment = input.isMcpOnlyDeployment || hostname === MCP_HOSTNAME;

  if (isMcpDeployment) {
    return !isMcpDeploymentPath(input.pathname);
  }

  // Website deployment normally 404s MCP-exclusive paths (isolated boundary).
  // The cutover env flag opt-in makes them reachable at vidmake.io.
  if (input.isProduction && isMcpExclusivePath(input.pathname) && input.allowMcpProtocolOnWebsite !== true) {
    return true;
  }

  return false;
}
