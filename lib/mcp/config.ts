import "server-only";

const DEFAULT_RESOURCE = "https://mcp.getugcpilot.com/mcp";
const DEFAULT_ISSUER = "https://getugcpilot.com";

function configuredUrl(value: string | undefined, fallback: string) {
  const parsed = new URL(value?.trim() || fallback);
  if (parsed.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")) {
    throw new Error("MCP public URLs must use HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("MCP public URLs must not contain credentials, query, or fragment.");
  }
  return parsed.href.replace(/\/$/, "");
}

export function getMcpResource() {
  return configuredUrl(process.env.MCP_PUBLIC_URL, DEFAULT_RESOURCE);
}

export function getMcpIssuer() {
  return configuredUrl(process.env.MCP_OAUTH_ISSUER, DEFAULT_ISSUER);
}

export function getProtectedResourceMetadataUrl() {
  const resource = new URL(getMcpResource());
  return `${resource.origin}/.well-known/oauth-protected-resource`;
}
