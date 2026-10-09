const MCP_HOSTNAME = "mcp.getugcpilot.com";

export function isMcpExclusivePath(pathname: string) {
  return pathname === "/mcp" || pathname.startsWith("/mcp/") ||
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
}) {
  const hostname = input.hostname.toLowerCase().replace(/\.$/u, "");
  const isMcpDeployment = input.isMcpOnlyDeployment || hostname === MCP_HOSTNAME;

  if (isMcpDeployment) {
    return !isMcpDeploymentPath(input.pathname);
  }

  return input.isProduction && isMcpExclusivePath(input.pathname);
}
