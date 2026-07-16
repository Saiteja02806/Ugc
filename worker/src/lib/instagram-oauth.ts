export type InstagramAccessTokenRefresh = {
  accessToken: string;
  expiresAt: string;
  tokenType: string;
};

type InstagramTokenResponse = {
  access_token?: string;
  error?: {
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    is_transient?: boolean;
    message?: string;
    type?: string;
  };
  expires_in?: number;
  token_type?: string;
};

export class InstagramOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly actionRequired: boolean,
    public readonly retryable: boolean,
    public readonly userMessage: string,
    public readonly providerCode: number | null = null,
    public readonly providerSubcode: number | null = null,
    public readonly traceId: string | null = null,
  ) {
    super(message);
    this.name = "InstagramOAuthError";
  }
}

export async function refreshInstagramAccessToken(
  accessToken: string,
): Promise<InstagramAccessTokenRefresh> {
  const url = buildInstagramRefreshUrl(accessToken);
  const response = await fetch(url);
  const payload = (await response.json().catch(() => null)) as
    | InstagramTokenResponse
    | null;

  if (
    !response.ok ||
    !payload?.access_token ||
    !Number.isFinite(payload.expires_in) ||
    (payload.expires_in ?? 0) <= 0
  ) {
    throw getInstagramOAuthError(payload, response.status);
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(
      Date.now() + (payload.expires_in ?? 0) * 1_000,
    ).toISOString(),
    tokenType: payload.token_type ?? "Bearer",
  };
}

function buildInstagramRefreshUrl(accessToken: string) {
  const baseUrl =
    process.env.INSTAGRAM_GRAPH_API_BASE_URL?.trim() ||
    "https://graph.instagram.com";
  const url = new URL("/refresh_access_token", baseUrl);

  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  return url;
}

function getInstagramOAuthError(
  payload: InstagramTokenResponse | null,
  status: number,
) {
  const providerError = payload?.error;
  const providerCode = providerError?.code ?? null;
  const providerSubcode = providerError?.error_subcode ?? null;
  const providerMessage =
    providerError?.message || "Instagram returned an invalid token response.";
  const normalizedMessage = providerMessage.toLowerCase();
  const accessTokenInvalid =
    status === 401 ||
    providerCode === 190 ||
    normalizedMessage.includes("access token") &&
      (normalizedMessage.includes("invalid") ||
        normalizedMessage.includes("expired"));
  const rateLimited =
    status === 429 || [4, 17, 32, 613].includes(providerCode ?? -1);
  const retryable =
    rateLimited ||
    providerError?.is_transient === true ||
    [408, 409, 425].includes(status) ||
    status >= 500;
  const code = accessTokenInvalid
    ? "access_token_invalid"
    : rateLimited
      ? "rate_limited"
      : retryable
        ? "provider_unavailable"
        : "token_refresh_failed";

  return new InstagramOAuthError(
    [
      `Instagram token refresh failed: HTTP ${status}`,
      providerError?.type ? `type ${providerError.type}` : null,
      providerCode !== null ? `code ${providerCode}` : null,
      providerSubcode !== null ? `subcode ${providerSubcode}` : null,
      providerMessage,
    ]
      .filter(Boolean)
      .join(" - "),
    code,
    status,
    accessTokenInvalid,
    !accessTokenInvalid && retryable,
    accessTokenInvalid
      ? "Reconnect Instagram to continue publishing."
      : retryable
        ? "Instagram authorization is temporarily unavailable. We will retry automatically."
        : "Instagram authorization could not be renewed. Reconnect Instagram and try again.",
    providerCode,
    providerSubcode,
    providerError?.fbtrace_id ?? null,
  );
}
