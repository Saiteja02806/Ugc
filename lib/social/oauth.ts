import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getConnectionPublishingBlock } from "@/lib/scheduling/social-connection-policy";
import { getEffectiveSocialConnectionStatus } from "@/lib/social/connection-status";
import { buildInstagramOAuthAuthorizationUrl } from "@/lib/social/instagram-oauth-config";
import {
  assertSocialOAuthReconnectTarget,
  SocialOAuthReconnectPolicyError,
  type SocialOAuthReconnectTarget,
} from "@/lib/social/oauth-reconnect-policy";
import { splitScopes } from "@/lib/social/split-scopes";
import {
  buildTikTokOAuthAuthorizationUrl,
  hasTikTokPublishScope,
} from "@/lib/social/tiktok-oauth-config";
import {
  buildSafeYouTubeOAuthDiagnostic,
  buildYouTubeOAuthAuthorizationUrl,
  type YouTubeOAuthDiagnostic,
} from "@/lib/social/youtube-oauth-config";
import {
  getProviderForPlatform,
  isProviderPlatformPair,
  type SocialConnection,
  type SocialConnectionStatus,
  type SocialOAuthIntent,
  type SocialOAuthReturnTo,
  type SocialPlatform,
  type SocialProvider,
} from "@/lib/social/types";

type Json = Record<string, unknown>;

type SocialOAuthSessionRow = {
  carousel_id: string | null;
  code_verifier: string | null;
  consumed_at: string | null;
  created_at: string;
  expected_connection_id: string | null;
  expires_at: string;
  id: string;
  intent: SocialOAuthIntent;
  library_item_id: string | null;
  platform: SocialPlatform;
  provider: SocialProvider;
  return_to: SocialOAuthReturnTo;
  state_hash: string;
  user_id: string;
};

type SocialConnectionRow = {
  access_token_ciphertext: string;
  connected_at: string;
  expires_at: string | null;
  id: string;
  last_error_code: string | null;
  metadata: Json;
  platform: SocialPlatform;
  platform_account_id: string;
  platform_account_name: string | null;
  platform_account_username: string | null;
  provider: SocialProvider;
  refresh_expires_at: string | null;
  refresh_token_ciphertext: string | null;
  revoked_at: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  token_type: string | null;
  token_refreshed_at: string | null;
  token_refresh_claim_token: string | null;
  token_refresh_claimed_at: string | null;
  updated_at: string;
  user_id: string;
};

type SocialOAuthDatabase = {
  public: {
    Functions: {
      claim_social_connection_token_refresh: {
        Args: {
          p_claim_token: string;
          p_connection_id: string;
          p_stale_after_seconds: number;
          p_user_id: string;
        };
        Returns: SocialConnectionRow[];
      };
      complete_social_connection_token_refresh: {
        Args: {
          p_access_token_ciphertext: string;
          p_claim_token: string;
          p_connection_id: string;
          p_expires_at: string | null;
          p_refresh_expires_at: string | null;
          p_refresh_token_ciphertext: string | null;
          p_scopes: string[];
          p_status: "connected" | "permission_missing";
          p_token_type: string;
          p_user_id: string;
        };
        Returns: SocialConnectionRow[];
      };
      release_social_connection_token_refresh: {
        Args: {
          p_claim_token: string;
          p_connection_id: string;
          p_error_code: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      revoke_social_connection: {
        Args: {
          p_connection_id: string;
          p_revoked_at: string;
          p_user_id: string;
        };
        Returns: SocialConnectionRow[];
      };
    };
    Tables: {
      social_connections: {
        Insert: Partial<SocialConnectionRow> &
          Pick<
            SocialConnectionRow,
            | "access_token_ciphertext"
            | "metadata"
            | "platform"
            | "platform_account_id"
            | "provider"
            | "scopes"
            | "user_id"
          >;
        Relationships: [];
        Row: SocialConnectionRow;
        Update: Partial<SocialConnectionRow>;
      };
      social_oauth_sessions: {
        Insert: Partial<SocialOAuthSessionRow> &
          Pick<
            SocialOAuthSessionRow,
            | "expires_at"
            | "platform"
            | "provider"
            | "return_to"
            | "state_hash"
            | "user_id"
          >;
        Relationships: [];
        Row: SocialOAuthSessionRow;
        Update: Partial<SocialOAuthSessionRow>;
      };
    };
    Views: Record<string, never>;
  };
};

type OAuthTokenSet = {
  accessToken: string;
  expiresInSeconds?: number | null;
  platformAccountId?: string | null;
  refreshToken?: string | null;
  refreshExpiresInSeconds?: number | null;
  scopes: string[];
  tokenType?: string | null;
};

type TikTokTokenResponse = {
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

class TikTokTokenRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly logId: string | null,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TikTokTokenRequestError";
  }
}

type PlatformAccount = {
  id: string;
  metadata?: Json;
  name?: string | null;
  username?: string | null;
};

export type SocialOAuthTraceStage =
  | "callback_received"
  | "connected_accounts_api_response"
  | "completed"
  | "exchange_authorization_code"
  | "fetch_instagram_profile"
  | "fetch_tiktok_profile"
  | "fetch_youtube_profile"
  | "frontend_rendering"
  | "normalize_token_permissions"
  | "provider_authorization"
  | "read_oauth_state"
  | "resolve_application_user"
  | "save_connected_account"
  | "validate_callback_parameters"
  | "validate_instagram_configuration"
  | "validate_oauth_state"
  | "validate_tiktok_configuration"
  | "validate_youtube_configuration"
  | "verify_connected_account"
  | "verify_reconnect_account";

export type SocialOAuthTraceContext = {
  callbackHost: string;
  codeFingerprint?: string | null;
  correlationId: string;
  stage: SocialOAuthTraceStage;
  stateFingerprint?: string | null;
};

const STATE_TTL_MINUTES = 10;
const TIKTOK_TOKEN_REFRESH_SKEW_MS = 15 * 60 * 1000;
const INSTAGRAM_PROFILE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TIKTOK_TOKEN_REFRESH_STALE_SECONDS = 120;
let supabaseClient: SupabaseClient<SocialOAuthDatabase> | null = null;

export async function createSocialAuthorization(params: {
  carouselId?: string | null;
  expectedConnectionId?: string | null;
  forceConsent?: boolean;
  intent?: SocialOAuthIntent;
  libraryItemId?: string | null;
  platform: SocialPlatform;
  provider: SocialProvider;
  returnTo: SocialOAuthReturnTo;
  userId: string;
}) {
  if (!isProviderPlatformPair(params.provider, params.platform)) {
    throw new SocialOAuthError(
      "The selected provider does not support this platform.",
      400,
      "provider_platform_mismatch",
    );
  }

  const intent = params.intent ?? "add";
  const expectedConnectionId = normalizeOptionalValue(
    params.expectedConnectionId,
  );
  const missing = getMissingSocialOAuthEnvVars(params.platform);

  if (missing.length > 0) {
    throw new SocialOAuthError(
      `Social OAuth is missing required configuration: ${missing.join(", ")}.`,
      501,
      "oauth_not_configured",
    );
  }

  const reconnectTarget = await getSocialOAuthReconnectTarget({
    expectedConnectionId,
    platform: params.platform,
    provider: params.provider,
    userId: params.userId,
  });
  enforceSocialOAuthReconnectTarget({
    expectedConnectionId,
    intent,
    platform: params.platform,
    provider: params.provider,
    target: reconnectTarget,
    userId: params.userId,
  });

  const state = createOpaqueToken(32);
  const codeVerifier =
    params.platform === "youtube" ? createPkceCodeVerifier() : null;
  const redirectUri = getPlatformRedirectUri(params.platform);
  const { data, error } = await getClient()
    .from("social_oauth_sessions")
    .insert({
      carousel_id: normalizeOptionalValue(params.carouselId),
      code_verifier: codeVerifier,
      expected_connection_id: expectedConnectionId,
      expires_at: new Date(
        Date.now() + STATE_TTL_MINUTES * 60 * 1000,
      ).toISOString(),
      library_item_id: normalizeOptionalValue(params.libraryItemId),
      intent,
      platform: params.platform,
      provider: params.provider,
      return_to: params.returnTo,
      state_hash: hashState(state),
      user_id: params.userId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new SocialOAuthError(
      "Could not prepare the account connection.",
      500,
      "session_create_failed",
    );
  }

  let authorizationUrl: URL;

  switch (params.platform) {
    case "instagram":
      authorizationUrl = buildInstagramAuthorizationUrl({ redirectUri, state });
      break;
    case "tiktok":
      authorizationUrl = buildTikTokAuthorizationUrl({
        forceConsent: params.forceConsent === true,
        redirectUri,
        state,
      });
      break;
    case "youtube":
      authorizationUrl = buildYouTubeAuthorizationUrl({
        codeVerifier: codeVerifier ?? "",
        forceConsent: params.forceConsent === true,
        redirectUri,
        state,
      });
      break;
  }

  const diagnostic =
    params.platform === "youtube" && isDevelopmentRuntime()
      ? await getYouTubeOAuthDiagnosticForUser({
          redirectUri,
          userId: params.userId,
        })
      : null;

  return {
    authorizationUrl: authorizationUrl.toString(),
    ...(diagnostic ? { diagnostic } : {}),
    sessionId: data.id,
  };
}

export async function completeSocialOAuthCallback(params: {
  code: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  state: string;
  trace: SocialOAuthTraceContext;
}) {
  const session = await consumeSocialOAuthSession({
    platform: params.platform,
    provider: params.provider,
    state: params.state,
    trace: params.trace,
  });

  logSocialOAuthTrace(params.trace, "resolve_application_user", {
    authenticatedUserFound: Boolean(session.user_id),
  });

  if (!session.user_id) {
    throw new SocialOAuthError(
      "The account connection is not associated with a UGC Pilot user.",
      400,
      "oauth_user_missing",
      "resolve_application_user",
    );
  }

  const redirectUri = getPlatformRedirectUri(params.platform);
  const configurationStage = getConfigurationValidationStage(params.platform);

  logSocialOAuthTrace(params.trace, configurationStage, {
    ...getSocialOAuthConfigurationLogFields(params.platform),
    hasRedirectUri: Boolean(redirectUri),
  });

  if (getMissingSocialOAuthEnvVars(params.platform).length > 0 || !redirectUri) {
    throw new SocialOAuthError(
      "Social OAuth is not fully configured.",
      501,
      "oauth_not_configured",
      configurationStage,
    );
  }

  logSocialOAuthTrace(params.trace, "exchange_authorization_code", {
    authorizationCodePresent: Boolean(params.code),
    redirectUriPresent: Boolean(redirectUri),
  });
  const tokenSet = await exchangeCodeForTokens({
    code: params.code,
    codeVerifier: session.code_verifier,
    platform: params.platform,
    redirectUri,
    trace: params.trace,
  });
  const publishingBlock = getConnectionPublishingBlock({
    platform: params.platform,
    scopes: tokenSet.scopes,
    status: "connected",
    supportsBackgroundRefresh:
      params.platform === "instagram" || Boolean(tokenSet.refreshToken),
  });

  if (publishingBlock) {
    throw new SocialOAuthError(
      publishingBlock.message,
      409,
      publishingBlock.code,
      "exchange_authorization_code",
    );
  }

  const profileStage = getProfileRetrievalStage(params.platform);
  logSocialOAuthTrace(params.trace, profileStage, {
    accessTokenPresent: Boolean(tokenSet.accessToken),
    platformAccountIdPresent: Boolean(tokenSet.platformAccountId),
  });
  const account = await fetchPlatformAccount(
    params.platform,
    tokenSet.accessToken,
    tokenSet.platformAccountId,
    params.trace,
  );
  const reconnectTarget = await getSocialOAuthReconnectTarget({
    expectedConnectionId: session.expected_connection_id,
    platform: params.platform,
    provider: params.provider,
    userId: session.user_id,
  });
  enforceSocialOAuthReconnectTarget({
    expectedConnectionId: session.expected_connection_id,
    intent: session.intent,
    platform: params.platform,
    provider: params.provider,
    returnedPlatformAccountId: account.id,
    target: reconnectTarget,
    userId: session.user_id,
  });

  const connection = await upsertSocialConnection({
    account,
    platform: params.platform,
    provider: params.provider,
    tokenSet,
    trace: params.trace,
    userId: session.user_id,
  });

  if (
    params.platform === "tiktok" &&
    !hasTikTokPublishScope(connection.scopes)
  ) {
    throw new SocialOAuthError(
      "Reconnect TikTok to grant publishing permission.",
      409,
      "tiktok_publish_permission_missing",
      "verify_connected_account",
    );
  }

  return { connection, session };
}

export async function consumeDeniedSocialOAuthCallback(params: {
  platform: SocialPlatform;
  provider: SocialProvider;
  state: string;
  trace: SocialOAuthTraceContext;
}) {
  return consumeSocialOAuthSession(params);
}

export async function listSocialConnections(
  userId: string,
  trace?: SocialOAuthTraceContext,
) {
  const { data, error } = await getClient()
    .from("social_connections")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    logSocialOAuthTrace(trace, "connected_accounts_api_response", {
      databaseErrorCode: error.code,
      httpStatus: 500,
    });

    throw new Error("Could not load social connections.");
  }

  const connections = await Promise.all(
    (data ?? []).map((connection) =>
      hydrateInstagramConnectionProfile(connection, trace),
    ),
  );

  return connections.map(mapSocialConnection);
}

async function getSocialOAuthReconnectTarget(params: {
  expectedConnectionId: string | null;
  platform: SocialPlatform;
  provider: SocialProvider;
  userId: string;
}): Promise<SocialOAuthReconnectTarget | null> {
  if (!params.expectedConnectionId) {
    return null;
  }

  const { data, error } = await getClient()
    .from("social_connections")
    .select(
      "id,platform,platform_account_id,provider,revoked_at,user_id",
    )
    .eq("id", params.expectedConnectionId)
    .eq("user_id", params.userId)
    .eq("platform", params.platform)
    .eq("provider", params.provider)
    .maybeSingle();

  if (error) {
    throw new SocialOAuthError(
      "Could not verify the account selected for reconnection.",
      500,
      "reconnect_connection_lookup_failed",
      "verify_reconnect_account",
    );
  }

  return data
    ? {
        connectionId: data.id,
        platform: data.platform,
        platformAccountId: data.platform_account_id,
        provider: data.provider,
        revokedAt: data.revoked_at,
        userId: data.user_id,
      }
    : null;
}

function enforceSocialOAuthReconnectTarget(params: {
  expectedConnectionId: string | null;
  intent: SocialOAuthIntent;
  platform: SocialPlatform;
  provider: SocialProvider;
  returnedPlatformAccountId?: string | null;
  target: SocialOAuthReconnectTarget | null;
  userId: string;
}) {
  try {
    assertSocialOAuthReconnectTarget(params);
  } catch (error) {
    if (error instanceof SocialOAuthReconnectPolicyError) {
      throw new SocialOAuthError(
        error.message,
        error.status,
        error.code,
        "verify_reconnect_account",
      );
    }

    throw error;
  }
}

async function getYouTubeOAuthDiagnosticForUser(params: {
  redirectUri: string;
  userId: string;
}): Promise<YouTubeOAuthDiagnostic> {
  const { data } = await getClient()
    .from("social_connections")
    .select("refresh_token_ciphertext,scopes")
    .eq("user_id", params.userId)
    .eq("provider", "google")
    .eq("platform", "youtube")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return buildSafeYouTubeOAuthDiagnostic({
    clientId: getEnv("GOOGLE_CLIENT_ID"),
    grantedScopes: Array.isArray(data?.scopes) ? data.scopes : [],
    redirectUri: params.redirectUri,
    refreshTokenExists: Boolean(data?.refresh_token_ciphertext),
  });
}

export async function getSocialConnectionCredentialForOwner(params: {
  connectionId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("social_connections")
    .select("*")
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the connected account credential.");
  }

  if (!data) {
    return null;
  }

  const connection =
    data.platform === "tiktok" &&
    hasTikTokPublishScope(data.scopes) &&
    isTokenExpiring(data.expires_at, TIKTOK_TOKEN_REFRESH_SKEW_MS)
      ? await refreshTikTokConnection({ connection: data, ...params })
      : data;

  return {
    accessToken: decryptSecret(connection.access_token_ciphertext),
    connection: mapSocialConnection(connection),
  };
}

export async function disconnectSocialConnection(params: {
  connectionId: string;
  userId: string;
}) {
  const existing = await getClient()
    .from("social_connections")
    .select("*")
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing.error) {
    throw new Error("Could not load social account before disconnecting.");
  }

  if (!existing.data) {
    return null;
  }

  if (existing.data.platform === "tiktok") {
    await revokeTikTokAccessToken(
      decryptSecret(existing.data.access_token_ciphertext),
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await getClient().rpc("revoke_social_connection", {
    p_connection_id: params.connectionId,
    p_revoked_at: now,
    p_user_id: params.userId,
  });

  if (error) {
    throw new Error("Could not disconnect social account.");
  }

  return data?.[0] ? mapSocialConnection(data[0]) : null;
}

async function refreshTikTokConnection(params: {
  connection: SocialConnectionRow;
  connectionId: string;
  userId: string;
}) {
  if (!params.connection.refresh_token_ciphertext) {
    throw new SocialOAuthError(
      "Reconnect TikTok before loading publishing settings.",
      409,
      "tiktok_refresh_required",
    );
  }

  if (isExpired(params.connection.refresh_expires_at)) {
    throw new SocialOAuthError(
      "Reconnect TikTok before loading publishing settings.",
      409,
      "tiktok_refresh_required",
    );
  }

  const claimToken = randomUUID();
  let claimedConnection: SocialConnectionRow | null = null;

  for (let attempt = 0; attempt < 3 && !claimedConnection; attempt += 1) {
    const claim = await getClient().rpc(
      "claim_social_connection_token_refresh",
      {
        p_claim_token: claimToken,
        p_connection_id: params.connectionId,
        p_stale_after_seconds: TIKTOK_TOKEN_REFRESH_STALE_SECONDS,
        p_user_id: params.userId,
      },
    );

    if (claim.error) {
      throw new SocialOAuthError(
        "Could not safely refresh TikTok right now.",
        502,
        "tiktok_refresh_claim_failed",
      );
    }

    claimedConnection = claim.data?.[0] ?? null;

    if (!claimedConnection && attempt < 2) {
      await delay(300 * (attempt + 1));
      const latest = await getClient()
        .from("social_connections")
        .select("*")
        .eq("id", params.connectionId)
        .eq("user_id", params.userId)
        .maybeSingle();

      if (latest.error) {
        throw new SocialOAuthError(
          "Could not reload the TikTok connection.",
          502,
          "tiktok_refresh_read_failed",
        );
      }

      if (
        latest.data &&
        !isTokenExpiring(
          latest.data.expires_at,
          TIKTOK_TOKEN_REFRESH_SKEW_MS,
        )
      ) {
        return latest.data;
      }
    }
  }

  if (!claimedConnection) {
    throw new SocialOAuthError(
      "TikTok is already refreshing. Try again in a moment.",
      409,
      "tiktok_refresh_in_progress",
    );
  }

  try {
    const refreshToken = decryptSecret(
      claimedConnection.refresh_token_ciphertext ?? "",
    );
    const refreshed = await requestTikTokTokenRefresh(refreshToken);

    if (
      !refreshed.openId ||
      refreshed.openId !== claimedConnection.platform_account_id
    ) {
      throw new TikTokTokenRequestError(
        "TikTok refreshed a different account.",
        "account_mismatch",
        refreshed.logId,
        409,
      );
    }

    const status = hasTikTokPublishScope(refreshed.scopes)
      ? ("connected" as const)
      : ("permission_missing" as const);
    const completed = await getClient().rpc(
      "complete_social_connection_token_refresh",
      {
        p_access_token_ciphertext: encryptSecret(refreshed.accessToken),
        p_claim_token: claimToken,
        p_connection_id: params.connectionId,
        p_expires_at: refreshed.expiresAt,
        p_refresh_expires_at: refreshed.refreshExpiresAt,
        p_refresh_token_ciphertext: encryptSecret(refreshed.refreshToken),
        p_scopes: refreshed.scopes,
        p_status: status,
        p_token_type: refreshed.tokenType,
        p_user_id: params.userId,
      },
    );

    if (completed.error || !completed.data?.[0]) {
      throw new SocialOAuthError(
        "Could not save the refreshed TikTok connection.",
        502,
        "tiktok_refresh_save_failed",
      );
    }

    return completed.data[0];
  } catch (error) {
    const errorCode =
      error instanceof TikTokTokenRequestError
        ? error.code
        : error instanceof SocialOAuthError
          ? error.code
          : "tiktok_refresh_failed";

    try {
      await getClient().rpc("release_social_connection_token_refresh", {
        p_claim_token: claimToken,
        p_connection_id: params.connectionId,
        p_error_code: errorCode,
        p_user_id: params.userId,
      });
    } catch {
      // The stale refresh lease expires automatically if release cannot persist.
    }

    if (
      error instanceof TikTokTokenRequestError &&
      [
        "access_token_invalid",
        "account_mismatch",
        "invalid_grant",
        "invalid_refresh_token",
        "refresh_token_expired",
      ].includes(error.code)
    ) {
      throw new SocialOAuthError(
        "Reconnect TikTok before loading publishing settings.",
        409,
        "tiktok_refresh_required",
      );
    }

    if (error instanceof SocialOAuthError) {
      throw error;
    }

    throw new SocialOAuthError(
      "TikTok could not refresh this connection right now.",
      502,
      "tiktok_refresh_failed",
    );
  }
}

async function requestTikTokTokenRefresh(refreshToken: string) {
  const body = new URLSearchParams({
    client_key: getEnv("TIKTOK_CLIENT_KEY"),
    client_secret: getEnv("TIKTOK_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | TikTokTokenResponse
    | null;

  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    throw new TikTokTokenRequestError(
      payload?.error_description || "TikTok token refresh failed.",
      payload?.error || "tiktok_refresh_failed",
      payload?.log_id ?? null,
      response.status,
    );
  }

  const expiresIn = getPositiveInteger(payload.expires_in);
  const refreshExpiresIn = getPositiveInteger(payload.refresh_expires_in);
  const scopes = splitScopes(payload.scope);

  if (
    !expiresIn ||
    !refreshExpiresIn ||
    !payload.open_id ||
    scopes.length === 0
  ) {
    throw new TikTokTokenRequestError(
      "TikTok returned an incomplete token refresh response.",
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

async function revokeTikTokAccessToken(accessToken: string) {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/oauth/revoke/",
    {
      body: new URLSearchParams({
        client_key: getEnv("TIKTOK_CLIENT_KEY"),
        client_secret: getEnv("TIKTOK_CLIENT_SECRET"),
        token: accessToken,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );

  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as
    | TikTokTokenResponse
    | null;

  if (
    payload?.error === "access_token_invalid" ||
    payload?.error === "invalid_grant"
  ) {
    return;
  }

  throw new SocialOAuthError(
    "TikTok could not revoke this connection. Try disconnecting again.",
    502,
    "tiktok_revoke_failed",
  );
}

export function getMissingSocialOAuthEnvVars(platform?: SocialPlatform) {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!getEncryptionSecret()) {
    missing.push(
      "SOCIAL_TOKEN_ENCRYPTION_KEY or OAUTH_TOKEN_ENCRYPTION_KEY",
    );
  }

  if (!platform || platform === "tiktok") {
    if (!process.env.TIKTOK_CLIENT_KEY?.trim()) {
      missing.push("TIKTOK_CLIENT_KEY");
    }
    if (!process.env.TIKTOK_CLIENT_SECRET?.trim()) {
      missing.push("TIKTOK_CLIENT_SECRET");
    }
  }

  if (!platform || platform === "instagram") {
    if (!process.env.INSTAGRAM_APP_ID?.trim()) {
      missing.push("INSTAGRAM_APP_ID");
    }
    if (!process.env.INSTAGRAM_APP_SECRET?.trim()) {
      missing.push("INSTAGRAM_APP_SECRET");
    }
  }

  if (!platform || platform === "youtube") {
    if (!process.env.GOOGLE_CLIENT_ID?.trim()) {
      missing.push("GOOGLE_CLIENT_ID");
    }
    if (!process.env.GOOGLE_CLIENT_SECRET?.trim()) {
      missing.push("GOOGLE_CLIENT_SECRET");
    }
  }

  return missing;
}

export function getSocialAppBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://getugcpilot.com"
  );
}

export class SocialOAuthError extends Error {
  code: string;
  stage: SocialOAuthTraceStage | null;
  status: number;

  constructor(
    message: string,
    status = 400,
    code = "oauth_error",
    stage: SocialOAuthTraceStage | null = null,
  ) {
    super(message);
    this.name = "SocialOAuthError";
    this.code = code;
    this.stage = stage;
    this.status = status;
  }
}

async function consumeSocialOAuthSession(params: {
  platform: SocialPlatform;
  provider: SocialProvider;
  state: string;
  trace: SocialOAuthTraceContext;
}) {
  if (!params.state.trim()) {
    throw new SocialOAuthError(
      "OAuth state is missing.",
      400,
      "invalid_or_expired_state",
      "validate_callback_parameters",
    );
  }

  const now = new Date().toISOString();
  logSocialOAuthTrace(params.trace, "read_oauth_state", {
    hasReturnedState: Boolean(params.state),
  });
  const attempt = await getClient()
    .from("social_oauth_sessions")
    .select("*")
    .eq("provider", params.provider)
    .eq("platform", params.platform)
    .eq("state_hash", hashState(params.state))
    .maybeSingle();

  logSocialOAuthTrace(params.trace, "read_oauth_state", {
    databaseErrorCode: attempt.error?.code ?? null,
    oauthAttemptFound: Boolean(attempt.data),
  });

  if (attempt.error) {
    throw new SocialOAuthError(
      "Could not validate the account connection.",
      500,
      "state_validation_failed",
      "read_oauth_state",
    );
  }

  if (!attempt.data) {
    throw new SocialOAuthError(
      "This account connection is invalid or has expired. Start again.",
      400,
      "invalid_or_expired_state",
      "read_oauth_state",
    );
  }

  logSocialOAuthTrace(params.trace, "validate_oauth_state", {
    hasReturnedState: Boolean(params.state),
    hasStoredState: Boolean(attempt.data.state_hash),
    stateAlreadyConsumed: Boolean(attempt.data.consumed_at),
    stateExpired: Date.parse(attempt.data.expires_at) <= Date.now(),
    stateMatches: true,
  });
  const { data, error } = await getClient()
    .from("social_oauth_sessions")
    .update({ consumed_at: now })
    .eq("id", attempt.data.id)
    .eq("provider", params.provider)
    .eq("platform", params.platform)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("*")
    .maybeSingle();

  logSocialOAuthTrace(params.trace, "validate_oauth_state", {
    databaseErrorCode: error?.code ?? null,
    stateValidated: Boolean(data),
  });

  if (error) {
    throw new SocialOAuthError(
      "Could not validate the account connection.",
      500,
      "state_validation_failed",
      "validate_oauth_state",
    );
  }

  if (!data) {
    throw new SocialOAuthError(
      "This account connection is invalid or has expired. Start again.",
      400,
      "invalid_or_expired_state",
      "validate_oauth_state",
    );
  }

  return data;
}

async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string | null;
  platform: SocialPlatform;
  redirectUri: string;
  trace: SocialOAuthTraceContext;
}): Promise<OAuthTokenSet> {
  switch (params.platform) {
    case "instagram":
      return exchangeInstagramCode(params.code, params.redirectUri, params.trace);
    case "tiktok":
      return exchangeTikTokCode(params.code, params.redirectUri, params.trace);
    case "youtube":
      return exchangeYouTubeCode(
        params.code,
        params.redirectUri,
        params.codeVerifier,
        params.trace,
      );
  }
}

async function exchangeTikTokCode(
  code: string,
  redirectUri: string,
  trace: SocialOAuthTraceContext,
) {
  const body = new URLSearchParams({
    client_key: getEnv("TIKTOK_CLIENT_KEY"),
    client_secret: getEnv("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_expires_in?: number;
    scope?: string;
    token_type?: string;
  } | null;
  logSocialOAuthTrace(trace, "exchange_authorization_code", {
    accessTokenReceived: Boolean(data?.access_token),
    httpStatus: response.status,
    ...getSafeProviderErrorFields(data),
  });

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      "TikTok did not complete the account connection.",
      502,
      "provider_exchange_failed",
      "exchange_authorization_code",
    );
  }

  const scopes = splitScopes(data.scope);

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    refreshToken: data.refresh_token ?? null,
    refreshExpiresInSeconds: data.refresh_expires_in,
    scopes,
    tokenType: data.token_type ?? "Bearer",
  };
}

async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
  trace: SocialOAuthTraceContext,
) {
  const body = new URLSearchParams({
    client_id: getEnv("INSTAGRAM_APP_ID"),
    client_secret: getEnv("INSTAGRAM_APP_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const shortResponse = await fetch(
    "https://api.instagram.com/oauth/access_token",
    {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );
  const shortData = (await shortResponse.json().catch(() => null)) as {
    access_token?: string;
    error?: unknown;
    error_code?: number | string;
    error_message?: string;
    error_type?: string;
    expires_in?: number;
    permissions?: unknown;
    scope?: unknown;
    token_type?: string;
    user_id?: number | string;
  } | null;
  logSocialOAuthTrace(trace, "exchange_authorization_code", {
    httpStatus: shortResponse.status,
    ...getSafeProviderErrorFields(shortData),
    tokenReceived: Boolean(shortData?.access_token),
    userIdReceived: Boolean(shortData?.user_id),
  });

  if (!shortResponse.ok || !shortData?.access_token) {
    throw new SocialOAuthError(
      "Instagram did not complete the account connection.",
      502,
      "provider_exchange_failed",
      "exchange_authorization_code",
    );
  }

  const longData = await exchangeInstagramLongLivedToken(
    shortData.access_token,
    trace,
  ).catch(() => null);
  const tokenData = longData?.access_token ? longData : shortData;
  logSocialOAuthTrace(trace, "normalize_token_permissions", {
    permissionsShape: getSafeValueShape(shortData.permissions),
    scopeShape: getSafeValueShape(shortData.scope),
  });
  const scopes = splitScopes(shortData.permissions ?? shortData.scope);

  return {
    accessToken: tokenData.access_token ?? shortData.access_token,
    expiresInSeconds: tokenData.expires_in ?? shortData.expires_in ?? 3600,
    platformAccountId:
      typeof shortData.user_id === "string" ||
      typeof shortData.user_id === "number"
        ? String(shortData.user_id)
        : null,
    refreshToken: null,
    scopes,
    tokenType: tokenData.token_type ?? "Bearer",
  };
}

async function exchangeInstagramLongLivedToken(
  accessToken: string,
  trace: SocialOAuthTraceContext,
) {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", getEnv("INSTAGRAM_APP_SECRET"));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: unknown;
    error_code?: number | string;
    error_message?: string;
    error_type?: string;
    expires_in?: number;
    token_type?: string;
  } | null;
  logSocialOAuthTrace(trace, "exchange_authorization_code", {
    httpStatus: response.status,
    longLivedTokenReceived: Boolean(data?.access_token),
    ...getSafeProviderErrorFields(data),
  });

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      "Instagram did not provide a long-lived access token.",
      502,
      "provider_exchange_failed",
      "exchange_authorization_code",
    );
  }

  return data;
}

async function exchangeYouTubeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string | null,
  trace: SocialOAuthTraceContext,
) {
  const body = new URLSearchParams({
    client_id: getEnv("GOOGLE_CLIENT_ID"),
    client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  } | null;
  logSocialOAuthTrace(trace, "exchange_authorization_code", {
    accessTokenReceived: Boolean(data?.access_token),
    httpStatus: response.status,
    ...getSafeProviderErrorFields(data),
  });

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      "YouTube did not complete the account connection.",
      502,
      "provider_exchange_failed",
      "exchange_authorization_code",
    );
  }

  const scopes = splitScopes(data.scope);

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    refreshToken: data.refresh_token ?? null,
    scopes,
    tokenType: data.token_type ?? "Bearer",
  };
}

async function fetchPlatformAccount(
  platform: SocialPlatform,
  accessToken: string,
  platformAccountId?: string | null,
  trace?: SocialOAuthTraceContext,
): Promise<PlatformAccount> {
  switch (platform) {
    case "instagram":
      return fetchInstagramAccount(accessToken, platformAccountId, trace);
    case "tiktok":
      return fetchTikTokAccount(accessToken, trace);
    case "youtube":
      return fetchYouTubeAccount(accessToken, trace);
  }
}

async function fetchTikTokAccount(
  accessToken: string,
  trace?: SocialOAuthTraceContext,
) {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");

  logSocialOAuthTrace(trace, "fetch_tiktok_profile", {
    profileRequestStarted: true,
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: {
      user?: {
        avatar_url?: string;
        display_name?: string;
        open_id?: string;
        union_id?: string;
      };
    };
    error?: {
      code?: string;
    };
  } | null;
  const user = payload?.data?.user;
  logSocialOAuthTrace(trace, "fetch_tiktok_profile", {
    httpStatus: response.status,
    platformAccountIdPresent: Boolean(user?.open_id),
    ...getSafeProviderErrorFields(payload),
  });

  if (!response.ok || !user?.open_id) {
    throw new SocialOAuthError(
      "Could not load the authorized TikTok account.",
      502,
      "account_lookup_failed",
      "fetch_tiktok_profile",
    );
  }

  return {
    id: user.open_id,
    metadata: {
      avatarUrl: user.avatar_url ?? null,
      unionId: user.union_id ?? null,
    },
    name: user.display_name ?? "TikTok account",
    username: null,
  };
}

async function fetchInstagramAccount(
  accessToken: string,
  fallbackAccountId?: string | null,
  trace?: SocialOAuthTraceContext,
) {
  const profileUrl = new URL("https://graph.instagram.com/me");
  profileUrl.searchParams.set(
    "fields",
    "id,username,name,account_type,profile_picture_url",
  );
  profileUrl.searchParams.set("access_token", accessToken);

  logSocialOAuthTrace(trace, "fetch_instagram_profile", {
    fallbackAccountIdPresent: Boolean(fallbackAccountId),
    profileRequestStarted: true,
  });
  const response = await fetch(profileUrl);
  const payload = (await response.json().catch(() => null)) as {
    account_type?: string;
    error?: unknown;
    error_code?: number | string;
    error_message?: string;
    error_type?: string;
    id?: string;
    name?: string;
    profile_picture_url?: string;
    username?: string;
  } | null;
  logSocialOAuthTrace(trace, "fetch_instagram_profile", {
    fallbackAccountIdPresent: Boolean(fallbackAccountId),
    httpStatus: response.status,
    instagramAccountIdPresent: Boolean(payload?.id),
    ...getSafeProviderErrorFields(payload),
    usernamePresent: Boolean(payload?.username),
  });

  if (!response.ok || !payload?.id) {
    if (fallbackAccountId) {
      return {
        id: fallbackAccountId,
        metadata: {
          profileLookupFailed: true,
          profilePictureSyncedAt: new Date().toISOString(),
        },
        name: "Instagram account",
        username: null,
      };
    }

    throw new SocialOAuthError(
      "Could not load the authorized Instagram account.",
      502,
      "account_lookup_failed",
      "fetch_instagram_profile",
    );
  }

  return {
    id: payload.id,
    metadata: {
      accountType: payload.account_type ?? null,
      profilePictureUrl: payload.profile_picture_url ?? null,
      profilePictureSyncedAt: new Date().toISOString(),
    },
    name: payload.name ?? payload.username ?? "Instagram account",
    username: payload.username ?? null,
  };
}

async function fetchYouTubeAccount(
  accessToken: string,
  trace?: SocialOAuthTraceContext,
) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("mine", "true");
  url.searchParams.set("part", "snippet");

  logSocialOAuthTrace(trace, "fetch_youtube_profile", {
    profileRequestStarted: true,
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: {
      code?: number | string;
      errors?: Array<{
        reason?: string;
      }>;
    };
    items?: Array<{
      id?: string;
      snippet?: {
        customUrl?: string;
        thumbnails?: Json;
        title?: string;
      };
    }>;
  } | null;
  const channel = payload?.items?.[0];
  logSocialOAuthTrace(trace, "fetch_youtube_profile", {
    httpStatus: response.status,
    platformAccountIdPresent: Boolean(channel?.id),
    ...getSafeProviderErrorFields(payload),
  });

  if (!response.ok || !channel?.id) {
    throw new SocialOAuthError(
      "No YouTube channel was found for this Google account.",
      422,
      "youtube_channel_missing",
      "fetch_youtube_profile",
    );
  }

  return {
    id: channel.id,
    metadata: {
      thumbnails: channel.snippet?.thumbnails ?? null,
    },
    name: channel.snippet?.title ?? "YouTube channel",
    username: channel.snippet?.customUrl ?? null,
  };
}

async function upsertSocialConnection(params: {
  account: PlatformAccount;
  platform: SocialPlatform;
  provider: SocialProvider;
  tokenSet: OAuthTokenSet;
  trace: SocialOAuthTraceContext;
  userId: string;
}) {
  logSocialOAuthTrace(params.trace, "save_connected_account", {
    databaseLookupStarted: true,
  });
  const existing = await getClient()
    .from("social_connections")
    .select("id,refresh_expires_at,refresh_token_ciphertext")
    .eq("user_id", params.userId)
    .eq("provider", params.provider)
    .eq("platform_account_id", params.account.id)
    .maybeSingle();

  if (existing.error) {
    logSocialOAuthTrace(params.trace, "save_connected_account", {
      databaseErrorCode: existing.error.code,
      databaseSaved: false,
    });

    throw new SocialOAuthError(
      "Could not check the existing account connection.",
      500,
      "connection_lookup_failed",
      "save_connected_account",
    );
  }

  const expiresAt =
    typeof params.tokenSet.expiresInSeconds === "number"
      ? new Date(
          Date.now() + params.tokenSet.expiresInSeconds * 1000,
        ).toISOString()
      : null;
  const now = new Date().toISOString();
  const refreshTokenCiphertext = params.tokenSet.refreshToken
    ? encryptSecret(params.tokenSet.refreshToken)
    : (existing.data?.refresh_token_ciphertext ?? null);
  const refreshExpiresAt =
    typeof params.tokenSet.refreshExpiresInSeconds === "number"
      ? new Date(
          Date.now() + params.tokenSet.refreshExpiresInSeconds * 1000,
        ).toISOString()
      : (existing.data?.refresh_expires_at ?? null);
  const connectionStatus =
    params.platform === "tiktok" &&
    !hasTikTokPublishScope(params.tokenSet.scopes)
      ? ("permission_missing" as const)
      : ("connected" as const);
  const patch = {
    access_token_ciphertext: encryptSecret(params.tokenSet.accessToken),
    expires_at: expiresAt,
    last_error_code: null,
    metadata: params.account.metadata ?? {},
    platform: params.platform,
    platform_account_name: params.account.name ?? null,
    platform_account_username: params.account.username ?? null,
    provider: params.provider,
    refresh_expires_at: refreshExpiresAt,
    refresh_token_ciphertext: refreshTokenCiphertext,
    revoked_at: null,
    scopes: params.tokenSet.scopes,
    status: connectionStatus,
    token_type: params.tokenSet.tokenType ?? null,
    token_refreshed_at: now,
    updated_at: now,
  };

  const result = existing.data
    ? await getClient()
        .from("social_connections")
        .update(patch)
        .eq("id", existing.data.id)
    : await getClient().from("social_connections").insert({
        ...patch,
        connected_at: now,
        platform_account_id: params.account.id,
        user_id: params.userId,
      });

  if (result.error) {
    logSocialOAuthTrace(params.trace, "save_connected_account", {
      databaseErrorCode: result.error.code,
      databaseSaved: false,
    });

    throw new SocialOAuthError(
      "Could not save the account connection.",
      500,
      "connection_save_failed",
      "save_connected_account",
    );
  }

  logSocialOAuthTrace(params.trace, "save_connected_account", {
    databaseSaved: true,
  });

  logSocialOAuthTrace(params.trace, "verify_connected_account", {
    databaseRereadStarted: true,
  });
  const verified = await getClient()
    .from("social_connections")
    .select("*")
    .eq("user_id", params.userId)
    .eq("provider", params.provider)
    .eq("platform", params.platform)
    .eq("platform_account_id", params.account.id)
    .is("revoked_at", null)
    .maybeSingle();

  logSocialOAuthTrace(params.trace, "verify_connected_account", {
    databaseErrorCode: verified.error?.code ?? null,
    databaseRowVerified: Boolean(verified.data),
  });

  if (verified.error) {
    throw new SocialOAuthError(
      "Could not verify the saved account connection.",
      500,
      "connection_reread_failed",
      "verify_connected_account",
    );
  }

  if (!verified.data) {
    throw new SocialOAuthError(
      "The account connection was not verified after saving.",
      500,
      "connection_verify_failed",
      "verify_connected_account",
    );
  }

  return mapSocialConnection(verified.data);
}

function buildTikTokAuthorizationUrl(params: {
  forceConsent: boolean;
  redirectUri: string;
  state: string;
}) {
  return buildTikTokOAuthAuthorizationUrl({
    clientKey: getEnv("TIKTOK_CLIENT_KEY"),
    forceConsent: params.forceConsent,
    redirectUri: params.redirectUri,
    state: params.state,
  });
}

function buildInstagramAuthorizationUrl(params: {
  redirectUri: string;
  state: string;
}) {
  return buildInstagramOAuthAuthorizationUrl({
    clientId: getEnv("INSTAGRAM_APP_ID"),
    redirectUri: params.redirectUri,
    state: params.state,
  });
}

function buildYouTubeAuthorizationUrl(params: {
  codeVerifier: string;
  forceConsent: boolean;
  redirectUri: string;
  state: string;
}) {
  return buildYouTubeOAuthAuthorizationUrl({
    clientId: getEnv("GOOGLE_CLIENT_ID"),
    codeVerifierChallenge: createPkceCodeChallenge(params.codeVerifier),
    forceConsent: params.forceConsent,
    redirectUri: params.redirectUri,
    state: params.state,
  });
}

function getPlatformRedirectUri(platform: SocialPlatform) {
  switch (platform) {
    case "instagram":
      return (
        process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
        `${getSocialAppBaseUrl()}/api/social/instagram/callback`
      );
    case "tiktok":
      return (
        process.env.TIKTOK_REDIRECT_URI?.trim() ||
        `${getSocialAppBaseUrl()}/api/social/tiktok/callback`
      );
    case "youtube":
      return (
        process.env.GOOGLE_REDIRECT_URI?.trim() ||
        `${getSocialAppBaseUrl()}/api/social/youtube/callback`
      );
  }
}

function getConfigurationValidationStage(
  platform: SocialPlatform,
): SocialOAuthTraceStage {
  switch (platform) {
    case "instagram":
      return "validate_instagram_configuration";
    case "tiktok":
      return "validate_tiktok_configuration";
    case "youtube":
      return "validate_youtube_configuration";
  }
}

function getProfileRetrievalStage(
  platform: SocialPlatform,
): SocialOAuthTraceStage {
  switch (platform) {
    case "instagram":
      return "fetch_instagram_profile";
    case "tiktok":
      return "fetch_tiktok_profile";
    case "youtube":
      return "fetch_youtube_profile";
  }
}

function getSocialOAuthConfigurationLogFields(platform: SocialPlatform) {
  const shared = {
    hasSocialTokenEncryptionKey: Boolean(getEncryptionSecret()),
    hasSupabaseServiceRoleKey: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
    hasSupabaseUrl: Boolean(getSupabaseUrl()),
  };

  switch (platform) {
    case "instagram":
      return {
        ...shared,
        hasInstagramClientId: Boolean(process.env.INSTAGRAM_APP_ID?.trim()),
        hasInstagramClientSecret: Boolean(
          process.env.INSTAGRAM_APP_SECRET?.trim(),
        ),
      };
    case "tiktok":
      return {
        ...shared,
        hasTikTokClientKey: Boolean(process.env.TIKTOK_CLIENT_KEY?.trim()),
        hasTikTokClientSecret: Boolean(
          process.env.TIKTOK_CLIENT_SECRET?.trim(),
        ),
      };
    case "youtube":
      return {
        ...shared,
        hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
        hasGoogleClientSecret: Boolean(
          process.env.GOOGLE_CLIENT_SECRET?.trim(),
        ),
      };
  }
}

export function getSocialPlatformRedirectUri(platform: SocialPlatform) {
  return getPlatformRedirectUri(platform);
}

function mapSocialConnection(row: SocialConnectionRow): SocialConnection {
  const effectiveStatus = getEffectiveSocialConnectionStatus({
    expiresAt: row.expires_at,
    hasRefreshToken: Boolean(row.refresh_token_ciphertext),
    platform: row.platform,
    refreshExpiresAt: row.refresh_expires_at,
    revokedAt: row.revoked_at,
    status: row.status,
  });
  const status =
    row.platform === "tiktok" &&
    effectiveStatus === "connected" &&
    !hasTikTokPublishScope(row.scopes)
      ? "permission_missing"
      : effectiveStatus;

  return {
    connectedAt: row.connected_at,
    expiresAt: row.expires_at,
    id: row.id,
    platform: row.platform,
    platformAccountId: row.platform_account_id,
    platformAccountName: row.platform_account_name,
    platformAccountUsername: row.platform_account_username,
    profilePictureUrl: getInstagramProfilePictureUrl(row.metadata),
    provider: row.provider,
    refreshExpiresAt: row.refresh_expires_at,
    scopes: row.scopes,
    status,
    supportsBackgroundRefresh:
      row.platform === "instagram" ||
      (Boolean(row.refresh_token_ciphertext) &&
        !isExpired(row.refresh_expires_at)),
    tokenRefreshedAt: row.token_refreshed_at,
    updatedAt: row.updated_at,
  };
}

async function hydrateInstagramConnectionProfile(
  row: SocialConnectionRow,
  trace?: SocialOAuthTraceContext,
): Promise<SocialConnectionRow> {
  if (
    row.platform !== "instagram" ||
    isInstagramProfileFresh(row.metadata)
  ) {
    return row;
  }

  try {
    const account = await fetchInstagramAccount(
      decryptSecret(row.access_token_ciphertext),
      row.platform_account_id,
      trace,
    );
    const metadata = {
      ...row.metadata,
      ...account.metadata,
    };
    const patch = {
      metadata,
      platform_account_name:
        account.username && account.name
          ? account.name
          : row.platform_account_name,
      platform_account_username:
        account.username ?? row.platform_account_username,
    };
    const { error } = await getClient()
      .from("social_connections")
      .update(patch)
      .eq("id", row.id)
      .eq("user_id", row.user_id);

    if (error) {
      logSocialOAuthTrace(trace, "connected_accounts_api_response", {
        databaseErrorCode: error.code,
        instagramProfileSaved: false,
      });
    }

    return {
      ...row,
      ...patch,
    };
  } catch {
    logSocialOAuthTrace(trace, "connected_accounts_api_response", {
      instagramProfileHydrated: false,
    });
    return row;
  }
}

function isInstagramProfileFresh(metadata: Json) {
  const syncedAt = getMetadataString(metadata, "profilePictureSyncedAt");

  if (!syncedAt) {
    return false;
  }

  const syncedAtMs = Date.parse(syncedAt);

  return (
    Number.isFinite(syncedAtMs) &&
    Date.now() - syncedAtMs < INSTAGRAM_PROFILE_REFRESH_INTERVAL_MS
  );
}

function getInstagramProfilePictureUrl(metadata: Json) {
  const value = getMetadataString(metadata, "profilePictureUrl");

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getMetadataString(metadata: Json, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Social OAuth storage is not configured.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient<SocialOAuthDatabase>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return supabaseClient;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function isDevelopmentRuntime() {
  return process.env.NODE_ENV !== "production";
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(encryptedSecret: string) {
  if (typeof encryptedSecret !== "string") {
    throw new Error("Unsupported encrypted secret format.");
  }

  const [version, iv, tag, ciphertext] = encryptedSecret.split(".");

  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey() {
  const raw = getEncryptionSecret();

  if (!raw) {
    throw new SocialOAuthError(
      "Social token encryption is not configured.",
      501,
      "oauth_not_configured",
    );
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Key = Buffer.from(raw, "base64");

  if (base64Key.length === 32) {
    return base64Key;
  }

  return createHash("sha256").update(raw).digest();
}

function getEncryptionSecret() {
  return (
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim() ||
    ""
  );
}

function createOpaqueToken(byteLength: number) {
  return randomBytes(byteLength).toString("base64url");
}

function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

function createPkceCodeVerifier() {
  return createOpaqueToken(64);
}

function createPkceCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function normalizeOptionalValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function getPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function isTokenExpiring(value: string | null, skewMs: number) {
  if (!value) {
    return false;
  }

  const expiresAt = Date.parse(value);

  return Number.isFinite(expiresAt) && expiresAt - skewMs <= Date.now();
}

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }

  const expiresAt = Date.parse(value);

  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new SocialOAuthError(
      `${key} is not configured.`,
      501,
      "oauth_not_configured",
    );
  }

  return value;
}

export function createSocialOAuthCorrelationId() {
  return randomUUID();
}

export function createSocialOAuthFingerprint(value: string) {
  return value
    ? createHash("sha256").update(value).digest("hex").slice(0, 12)
    : null;
}

export function logSocialOAuthTrace(
  trace: SocialOAuthTraceContext | undefined,
  stage: SocialOAuthTraceStage,
  fields: Record<string, unknown> = {},
) {
  if (!trace) {
    return;
  }

  trace.stage = stage;

  console.info("social_oauth_trace", {
    callbackHost: trace.callbackHost,
    codeFingerprint: trace.codeFingerprint ?? null,
    correlationId: trace.correlationId,
    stage,
    stateFingerprint: trace.stateFingerprint ?? null,
    ...fields,
  });
}

function getSafeValueShape(value: unknown) {
  if (value === null || value === undefined) {
    return "missing";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function getSafeProviderErrorFields(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      providerErrorCode: null,
      providerErrorSubcode: null,
    };
  }

  const record = payload as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;
  const nestedErrors = Array.isArray(nestedError?.errors)
    ? (nestedError.errors as Array<Record<string, unknown>>)
    : [];

  return {
    providerErrorCode: normalizeLogValue(
      record.error_code ??
        record.error ??
        nestedError?.code ??
        nestedErrors[0]?.reason,
    ),
    providerErrorSubcode: normalizeLogValue(nestedError?.error_subcode),
  };
}

function normalizeLogValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value.slice(0, 160);
}

export { getProviderForPlatform };
export type {
  SocialConnection,
  SocialOAuthReturnTo,
  SocialPlatform,
  SocialProvider,
};
