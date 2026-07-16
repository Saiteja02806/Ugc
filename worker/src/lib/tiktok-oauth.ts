type TikTokTokenPayload = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  log_id?: string;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export class TikTokOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly logId: string | null,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TikTokOAuthError";
  }
}

export async function refreshTikTokAccessToken(refreshToken: string) {
  const response = await fetch(buildTikTokOAuthUrl("/v2/oauth/token/"), {
    body: new URLSearchParams({
      client_key: getRequiredEnv("TIKTOK_CLIENT_KEY"),
      client_secret: getRequiredEnv("TIKTOK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | TikTokTokenPayload
    | null;

  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    throw new TikTokOAuthError(
      payload?.error_description || `TikTok OAuth refresh failed: HTTP ${response.status}.`,
      payload?.error || "tiktok_refresh_failed",
      payload?.log_id ?? null,
      response.status,
    );
  }

  const expiresIn = getPositiveInteger(payload.expires_in);
  const refreshExpiresIn = getPositiveInteger(payload.refresh_expires_in);
  const scopes = splitTikTokScopes(payload.scope);

  if (
    !expiresIn ||
    !refreshExpiresIn ||
    !payload.open_id ||
    scopes.length === 0
  ) {
    throw new TikTokOAuthError(
      "TikTok OAuth refresh returned an incomplete token response.",
      "incomplete_token_response",
      payload.log_id ?? null,
      response.status,
    );
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    logId: payload.log_id ?? null,
    openId: payload.open_id ?? null,
    refreshExpiresAt: new Date(
      Date.now() + refreshExpiresIn * 1000,
    ).toISOString(),
    refreshToken: payload.refresh_token,
    scopes,
    tokenType: payload.token_type ?? "Bearer",
  };
}

export function isTikTokReconnectErrorCode(code: string) {
  return [
    "access_token_invalid",
    "invalid_grant",
    "invalid_refresh_token",
    "scope_not_authorized",
  ].includes(code);
}

function buildTikTokOAuthUrl(path: string) {
  const baseUrl =
    process.env.TIKTOK_API_BASE_URL?.trim() ||
    "https://open.tiktokapis.com";

  return new URL(path, baseUrl);
}

function splitTikTokScopes(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  );
}

function getPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for TikTok token refresh.`);
  }

  return value;
}
