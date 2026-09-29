const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type RedirectDestination = "chatgpt" | "claude" | "loopback" | "hosted";

export function validRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function redirectUriMatches(registeredValue: string, requestedValue: string): boolean {
  if (registeredValue === requestedValue) return validRedirectUri(registeredValue);

  try {
    const registered = new URL(registeredValue);
    const requested = new URL(requestedValue);
    if (!validRedirectUri(registeredValue) || !validRedirectUri(requestedValue)) return false;

    return registered.protocol === "http:" &&
      requested.protocol === "http:" &&
      LOOPBACK_HOSTS.has(registered.hostname) &&
      registered.hostname === requested.hostname &&
      registered.port === "" &&
      registered.pathname === requested.pathname &&
      registered.search === requested.search;
  } catch {
    return false;
  }
}

export function supportsPublicClientTokenExchange(metadata: Record<string, unknown>): boolean {
  const supported = metadata.token_endpoint_auth_methods_supported;
  if (supported !== undefined) {
    return Array.isArray(supported) &&
      supported.length > 0 &&
      supported.length <= 10 &&
      supported.every((method) => typeof method === "string") &&
      supported.includes("none");
  }

  const legacy = metadata.token_endpoint_auth_method;
  return legacy === undefined || legacy === "none";
}

export function classifyRedirectDestination(value: string): RedirectDestination {
  const url = new URL(value);
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return "loopback";
  if (url.origin === "https://chatgpt.com" &&
      (url.pathname === "/connector_platform_oauth_redirect" ||
        /^\/connector\/oauth\/[^/]+$/.test(url.pathname))) return "chatgpt";
  if (url.origin === "https://claude.ai" && url.pathname === "/api/mcp/auth_callback") return "claude";
  return "hosted";
}
