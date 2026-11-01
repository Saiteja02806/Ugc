export const publicOrigin = "https://vidmake.io";

const legacyHostnames = new Set(["getugcpilot.com", "www.getugcpilot.com"]);

export function isLegacyPublicHostname(hostname: string) {
  return legacyHostnames.has(hostname.toLowerCase().replace(/\.$/u, ""));
}

function configuredOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.username || url.password) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Customer-facing origin. An explicit non-legacy app URL is honored so local
 * and staging hosts keep working. The legacy public host is not reused as the
 * Vidmake destination.
 */
export function resolvePrimaryAppOrigin(env: NodeJS.ProcessEnv = process.env) {
  for (const value of [env.PRIMARY_APP_URL, env.APP_BASE_URL, env.NEXT_PUBLIC_APP_URL]) {
    const origin = configuredOrigin(value);
    if (!origin) continue;
    if (isLegacyPublicHostname(new URL(origin).hostname)) continue;
    return origin;
  }
  return publicOrigin;
}
