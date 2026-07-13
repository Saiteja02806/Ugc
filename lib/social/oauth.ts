import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getProviderForPlatform,
  isProviderPlatformPair,
  type SocialConnection,
  type SocialConnectionStatus,
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
  expires_at: string;
  id: string;
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
  refresh_token_ciphertext: string | null;
  revoked_at: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  token_type: string | null;
  updated_at: string;
  user_id: string;
};

type SocialOAuthDatabase = {
  public: {
    Functions: Record<string, never>;
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
  scopes: string[];
  tokenType?: string | null;
};

type PlatformAccount = {
  id: string;
  metadata?: Json;
  name?: string | null;
  username?: string | null;
};

const STATE_TTL_MINUTES = 10;
let supabaseClient: SupabaseClient<SocialOAuthDatabase> | null = null;

export async function createSocialAuthorization(params: {
  carouselId?: string | null;
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

  const missing = getMissingSocialOAuthEnvVars(params.platform);

  if (missing.length > 0) {
    throw new SocialOAuthError(
      `Social OAuth is missing required configuration: ${missing.join(", ")}.`,
      501,
      "oauth_not_configured",
    );
  }

  const state = createOpaqueToken(32);
  const codeVerifier =
    params.platform === "youtube" ? createPkceCodeVerifier() : null;
  const redirectUri = getPlatformRedirectUri(params.platform);
  const { data, error } = await getClient()
    .from("social_oauth_sessions")
    .insert({
      carousel_id: normalizeOptionalValue(params.carouselId),
      code_verifier: codeVerifier,
      expires_at: new Date(
        Date.now() + STATE_TTL_MINUTES * 60 * 1000,
      ).toISOString(),
      library_item_id: normalizeOptionalValue(params.libraryItemId),
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
      authorizationUrl = buildTikTokAuthorizationUrl({ redirectUri, state });
      break;
    case "youtube":
      authorizationUrl = buildYouTubeAuthorizationUrl({
        codeVerifier: codeVerifier ?? "",
        redirectUri,
        state,
      });
      break;
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    sessionId: data.id,
  };
}

export async function completeSocialOAuthCallback(params: {
  code: string;
  platform: SocialPlatform;
  provider: SocialProvider;
  state: string;
}) {
  const session = await consumeSocialOAuthSession({
    platform: params.platform,
    provider: params.provider,
    state: params.state,
  });
  const redirectUri = getPlatformRedirectUri(params.platform);
  const tokenSet = await exchangeCodeForTokens({
    code: params.code,
    codeVerifier: session.code_verifier,
    platform: params.platform,
    redirectUri,
  });
  const account = await fetchPlatformAccount(
    params.platform,
    tokenSet.accessToken,
    tokenSet.platformAccountId,
  );

  await upsertSocialConnection({
    account,
    platform: params.platform,
    provider: params.provider,
    tokenSet,
    userId: session.user_id,
  });

  return session;
}

export async function consumeDeniedSocialOAuthCallback(params: {
  platform: SocialPlatform;
  provider: SocialProvider;
  state: string;
}) {
  return consumeSocialOAuthSession(params);
}

export async function listSocialConnections(userId: string) {
  const { data, error } = await getClient()
    .from("social_connections")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Could not load social connections.");
  }

  return (data ?? []).map(mapSocialConnection);
}

export async function disconnectSocialConnection(params: {
  connectionId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await getClient()
    .from("social_connections")
    .update({
      revoked_at: now,
      status: "revoked",
      updated_at: now,
    })
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error("Could not disconnect social account.");
  }

  return data ? mapSocialConnection(data) : null;
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
  status: number;

  constructor(message: string, status = 400, code = "oauth_error") {
    super(message);
    this.name = "SocialOAuthError";
    this.code = code;
    this.status = status;
  }
}

async function consumeSocialOAuthSession(params: {
  platform: SocialPlatform;
  provider: SocialProvider;
  state: string;
}) {
  if (!params.state.trim()) {
    throw new SocialOAuthError(
      "OAuth state is missing.",
      400,
      "invalid_or_expired_state",
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await getClient()
    .from("social_oauth_sessions")
    .update({ consumed_at: now })
    .eq("provider", params.provider)
    .eq("platform", params.platform)
    .eq("state_hash", hashState(params.state))
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new SocialOAuthError(
      "Could not validate the account connection.",
      500,
      "state_validation_failed",
    );
  }

  if (!data) {
    throw new SocialOAuthError(
      "This account connection is invalid or has expired. Start again.",
      400,
      "invalid_or_expired_state",
    );
  }

  return data;
}

async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string | null;
  platform: SocialPlatform;
  redirectUri: string;
}): Promise<OAuthTokenSet> {
  switch (params.platform) {
    case "instagram":
      return exchangeInstagramCode(params.code, params.redirectUri);
    case "tiktok":
      return exchangeTikTokCode(params.code, params.redirectUri);
    case "youtube":
      return exchangeYouTubeCode(
        params.code,
        params.redirectUri,
        params.codeVerifier,
      );
  }
}

async function exchangeTikTokCode(code: string, redirectUri: string) {
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
    scope?: string;
    token_type?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      "TikTok did not complete the account connection.",
      502,
      "provider_exchange_failed",
    );
  }

  const scopes = splitScopes(data.scope, ",");

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    refreshToken: data.refresh_token ?? null,
    scopes: scopes.length > 0 ? scopes : getTikTokScopes(),
    tokenType: data.token_type ?? "Bearer",
  };
}

async function exchangeInstagramCode(code: string, redirectUri: string) {
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
    expires_in?: number;
    permissions?: string;
    scope?: string;
    token_type?: string;
    user_id?: number | string;
  } | null;

  if (!shortResponse.ok || !shortData?.access_token) {
    throw new SocialOAuthError(
      "Instagram did not complete the account connection.",
      502,
      "provider_exchange_failed",
    );
  }

  const longData = await exchangeInstagramLongLivedToken(
    shortData.access_token,
  ).catch(() => null);
  const tokenData = longData?.access_token ? longData : shortData;
  const scopes = splitScopes(
    shortData.permissions ?? shortData.scope,
    ",",
  );

  return {
    accessToken: tokenData.access_token ?? shortData.access_token,
    expiresInSeconds: tokenData.expires_in ?? shortData.expires_in ?? 3600,
    platformAccountId:
      typeof shortData.user_id === "string" ||
      typeof shortData.user_id === "number"
        ? String(shortData.user_id)
        : null,
    refreshToken: null,
    scopes: scopes.length > 0 ? scopes : getInstagramScopes(),
    tokenType: tokenData.token_type ?? "Bearer",
  };
}

async function exchangeInstagramLongLivedToken(accessToken: string) {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", getEnv("INSTAGRAM_APP_SECRET"));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      "Instagram did not provide a long-lived access token.",
      502,
      "provider_exchange_failed",
    );
  }

  return data;
}

async function exchangeYouTubeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string | null,
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
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      "YouTube did not complete the account connection.",
      502,
      "provider_exchange_failed",
    );
  }

  const scopes = splitScopes(data.scope, " ");

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    refreshToken: data.refresh_token ?? null,
    scopes: scopes.length > 0 ? scopes : getYouTubeScopes(),
    tokenType: data.token_type ?? "Bearer",
  };
}

async function fetchPlatformAccount(
  platform: SocialPlatform,
  accessToken: string,
  platformAccountId?: string | null,
): Promise<PlatformAccount> {
  switch (platform) {
    case "instagram":
      return fetchInstagramAccount(accessToken, platformAccountId);
    case "tiktok":
      return fetchTikTokAccount(accessToken);
    case "youtube":
      return fetchYouTubeAccount(accessToken);
  }
}

async function fetchTikTokAccount(accessToken: string) {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");

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
  } | null;
  const user = payload?.data?.user;

  if (!response.ok || !user?.open_id) {
    throw new SocialOAuthError(
      "Could not load the authorized TikTok account.",
      502,
      "account_lookup_failed",
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
) {
  const profileUrl = new URL("https://graph.instagram.com/me");
  profileUrl.searchParams.set(
    "fields",
    "id,username,account_type,profile_picture_url",
  );
  profileUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(profileUrl);
  const payload = (await response.json().catch(() => null)) as {
    account_type?: string;
    id?: string;
    name?: string;
    profile_picture_url?: string;
    username?: string;
  } | null;

  if (!response.ok || !payload?.id) {
    if (fallbackAccountId) {
      return {
        id: fallbackAccountId,
        metadata: { profileLookupFailed: true },
        name: "Instagram account",
        username: null,
      };
    }

    throw new SocialOAuthError(
      "Could not load the authorized Instagram account.",
      502,
      "account_lookup_failed",
    );
  }

  return {
    id: payload.id,
    metadata: {
      accountType: payload.account_type ?? null,
      profilePictureUrl: payload.profile_picture_url ?? null,
    },
    name: payload.name ?? payload.username ?? "Instagram account",
    username: payload.username ?? null,
  };
}

async function fetchYouTubeAccount(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("mine", "true");
  url.searchParams.set("part", "snippet");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as {
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

  if (!response.ok || !channel?.id) {
    throw new SocialOAuthError(
      "No YouTube channel was found for this Google account.",
      422,
      "youtube_channel_missing",
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
  userId: string;
}) {
  const existing = await getClient()
    .from("social_connections")
    .select("id,refresh_token_ciphertext")
    .eq("user_id", params.userId)
    .eq("provider", params.provider)
    .eq("platform_account_id", params.account.id)
    .maybeSingle();

  if (existing.error) {
    throw new SocialOAuthError(
      "Could not check the existing account connection.",
      500,
      "connection_lookup_failed",
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
  const patch = {
    access_token_ciphertext: encryptSecret(params.tokenSet.accessToken),
    expires_at: expiresAt,
    last_error_code: null,
    metadata: params.account.metadata ?? {},
    platform: params.platform,
    platform_account_name: params.account.name ?? null,
    platform_account_username: params.account.username ?? null,
    provider: params.provider,
    refresh_token_ciphertext: refreshTokenCiphertext,
    revoked_at: null,
    scopes: params.tokenSet.scopes,
    status: "connected" as const,
    token_type: params.tokenSet.tokenType ?? null,
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
    throw new SocialOAuthError(
      "Could not save the account connection.",
      500,
      "connection_save_failed",
    );
  }
}

function buildTikTokAuthorizationUrl(params: {
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", getEnv("TIKTOK_CLIENT_KEY"));
  url.searchParams.set("scope", getTikTokScopes().join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url;
}

function buildInstagramAuthorizationUrl(params: {
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", getEnv("INSTAGRAM_APP_ID"));
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getInstagramScopes().join(","));
  url.searchParams.set("state", params.state);
  return url;
}

function buildYouTubeAuthorizationUrl(params: {
  codeVerifier: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getYouTubeScopes().join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set(
    "code_challenge",
    createPkceCodeChallenge(params.codeVerifier),
  );
  url.searchParams.set("code_challenge_method", "S256");
  return url;
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

function mapSocialConnection(row: SocialConnectionRow): SocialConnection {
  return {
    connectedAt: row.connected_at,
    expiresAt: row.expires_at,
    id: row.id,
    platform: row.platform,
    platformAccountId: row.platform_account_id,
    platformAccountName: row.platform_account_name,
    platformAccountUsername: row.platform_account_username,
    provider: row.provider,
    scopes: row.scopes,
    status: getEffectiveConnectionStatus(row),
    updatedAt: row.updated_at,
  };
}

function getEffectiveConnectionStatus(row: SocialConnectionRow) {
  if (row.revoked_at || row.status === "revoked") {
    return "revoked" as const;
  }

  if (
    row.status === "connected" &&
    row.expires_at &&
    Date.parse(row.expires_at) <= Date.now() &&
    !row.refresh_token_ciphertext
  ) {
    return "expired" as const;
  }

  return row.status;
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

function getTikTokScopes() {
  return splitScopes(
    process.env.TIKTOK_SCOPES || "user.info.basic,video.upload,video.publish",
    ",",
  );
}

function getInstagramScopes() {
  return splitScopes(
    process.env.INSTAGRAM_SCOPES ||
      "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
    ",",
  );
}

function getYouTubeScopes() {
  return splitScopes(
    process.env.YOUTUBE_SCOPES ||
      "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    " ",
  );
}

function splitScopes(value: string | undefined, separator: "," | " ") {
  if (!value) {
    return [];
  }

  return value
    .split(separator)
    .map((scope) => scope.trim())
    .filter(Boolean);
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

export { getProviderForPlatform };
export type {
  SocialConnection,
  SocialOAuthReturnTo,
  SocialPlatform,
  SocialProvider,
};
