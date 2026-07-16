export type GoogleAccessTokenRefresh = {
  accessToken: string;
  expiresAt: string | null;
  tokenType: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  token_type?: string;
};

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly actionRequired: boolean,
    public readonly retryable: boolean,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleAccessTokenRefresh> {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | GoogleTokenResponse
    | null;

  if (!response.ok || !payload?.access_token) {
    const code = payload?.error?.trim() || "token_refresh_failed";
    const actionRequired = code === "invalid_grant";
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      ["server_error", "temporarily_unavailable"].includes(code);

    throw new GoogleOAuthError(
      `Google OAuth token refresh failed: ${getGoogleTokenErrorMessage(
        payload,
        response.status,
      )}`,
      code,
      response.status,
      actionRequired,
      retryable,
      actionRequired
        ? "Reconnect YouTube to continue publishing."
        : retryable
          ? "YouTube authorization is temporarily unavailable. We will retry automatically."
          : "YouTube authorization could not be refreshed. Contact support if this continues.",
    );
  }

  return {
    accessToken: payload.access_token,
    expiresAt:
      typeof payload.expires_in === "number" && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
    tokenType: payload.token_type ?? "Bearer",
  };
}

function getGoogleTokenErrorMessage(
  payload: GoogleTokenResponse | null,
  status: number,
) {
  return [
    `HTTP ${status}`,
    payload?.error ? `code ${payload.error}` : null,
    payload?.error_description || "Unknown Google OAuth error",
  ]
    .filter(Boolean)
    .join(" - ");
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for YouTube token refresh.`);
  }

  return value;
}
