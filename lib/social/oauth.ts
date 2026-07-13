import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const socialPlatforms = ["instagram", "tiktok", "youtube"] as const;

export type SocialPlatform = (typeof socialPlatforms)[number];

type Json = Record<string, unknown>;

type OAuthStateRow = {
  code_verifier: string | null;
  consumed_at: string | null;
  created_at: string;
  expires_at: string;
  id: string;
  platform: SocialPlatform;
  redirect_to: string;
  state_hash: string;
  user_id: string;
};

type SocialConnectionRow = {
  access_token_ciphertext: string;
  connected_at: string;
  expires_at: string | null;
  id: string;
  metadata: Json;
  platform: SocialPlatform;
  platform_account_id: string;
  platform_account_name: string | null;
  platform_account_username: string | null;
  refresh_token_ciphertext: string | null;
  revoked_at: string | null;
  scopes: string[];
  token_type: string | null;
  updated_at: string;
  user_id: string;
};

type SocialOAuthDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      oauth_states: {
        Insert: Partial<OAuthStateRow> &
          Pick<
            OAuthStateRow,
            "expires_at" | "platform" | "redirect_to" | "state_hash" | "user_id"
          >;
        Relationships: [];
        Row: OAuthStateRow;
        Update: Partial<OAuthStateRow>;
      };
      social_connections: {
        Insert: Partial<SocialConnectionRow> &
          Pick<
            SocialConnectionRow,
            | "access_token_ciphertext"
            | "metadata"
            | "platform"
            | "platform_account_id"
            | "scopes"
            | "user_id"
          >;
        Relationships: [];
        Row: SocialConnectionRow;
        Update: Partial<SocialConnectionRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type SocialConnection = {
  connectedAt: string;
  expiresAt: string | null;
  id: string;
  platform: SocialPlatform;
  platformAccountId: string;
  platformAccountName: string | null;
  platformAccountUsername: string | null;
  scopes: string[];
  updatedAt: string;
};

type OAuthTokenSet = {
  accessToken: string;
  expiresInSeconds?: number | null;
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
const DEFAULT_REDIRECT_TO = "/connected-accounts";
const DEFAULT_META_GRAPH_VERSION = "v20.0";

let supabaseClient: SupabaseClient<SocialOAuthDatabase> | null = null;

export function isSocialPlatform(value: string): value is SocialPlatform {
  return socialPlatforms.includes(value as SocialPlatform);
}

export function getMissingSocialOAuthEnvVars(platform?: SocialPlatform) {
  const missing: string[] = [];

  if (
    !(
      process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    )
  ) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim()) {
    missing.push("OAUTH_TOKEN_ENCRYPTION_KEY");
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
    if (!process.env.META_APP_ID?.trim()) {
      missing.push("META_APP_ID");
    }
    if (!process.env.META_APP_SECRET?.trim()) {
      missing.push("META_APP_SECRET");
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

export async function createAuthorizationUrl(params: {
  platform: SocialPlatform;
  redirectTo?: string | null;
  userId: string;
}) {
  const missing = getMissingSocialOAuthEnvVars(params.platform);

  if (missing.length > 0) {
    throw new SocialOAuthError(
      `Social OAuth is missing required configuration: ${missing.join(", ")}.`,
      501,
    );
  }

  const state = createOpaqueToken(32);
  const codeVerifier =
    params.platform === "youtube" ? createPkceCodeVerifier() : null;
  const redirectUri = getPlatformRedirectUri(params.platform);

  const { error } = await getClient().from("oauth_states").insert({
    code_verifier: codeVerifier,
    expires_at: new Date(
      Date.now() + STATE_TTL_MINUTES * 60 * 1000,
    ).toISOString(),
    platform: params.platform,
    redirect_to: sanitizeRedirectTo(params.redirectTo),
    state_hash: hashState(state),
    user_id: params.userId,
  });

  if (error) {
    throw new SocialOAuthError(
      `Could not prepare the OAuth connection: ${error.message}.`,
      500,
    );
  }

  switch (params.platform) {
    case "instagram":
      return buildInstagramAuthorizationUrl({ redirectUri, state }).toString();
    case "tiktok":
      return buildTikTokAuthorizationUrl({
        redirectUri,
        state,
      }).toString();
    case "youtube":
      return buildYouTubeAuthorizationUrl({
        codeVerifier: codeVerifier ?? "",
        redirectUri,
        state,
      }).toString();
  }
}

export async function completeOAuthCallback(params: {
  code: string;
  platform: SocialPlatform;
  state: string;
}) {
  const stateRow = await consumeOAuthState(params.platform, params.state);
  const redirectUri = getPlatformRedirectUri(params.platform);
  const tokenSet = await exchangeCodeForTokens({
    code: params.code,
    codeVerifier: stateRow.code_verifier,
    platform: params.platform,
    redirectUri,
  });
  const account = await fetchPlatformAccount(params.platform, tokenSet.accessToken);

  await upsertSocialConnection({
    account,
    platform: params.platform,
    tokenSet,
    userId: stateRow.user_id,
  });

  return {
    platform: params.platform,
    redirectTo: buildCompletionRedirect({
      platform: params.platform,
      redirectTo: stateRow.redirect_to,
    }),
  };
}

export async function listSocialConnections(userId: string) {
  const { data, error } = await getClient()
    .from("social_connections")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load social connections: ${error.message}`);
  }

  return (data ?? []).map(mapSocialConnection);
}

export async function disconnectSocialConnection(params: {
  connectionId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("social_connections")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not disconnect social account: ${error.message}`);
  }

  return data ? mapSocialConnection(data) : null;
}

export class SocialOAuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SocialOAuthError";
    this.status = status;
  }
}

async function consumeOAuthState(platform: SocialPlatform, state: string) {
  const stateHash = hashState(state);
  const { data, error } = await getClient()
    .from("oauth_states")
    .select("*")
    .eq("platform", platform)
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (error) {
    throw new SocialOAuthError(`Could not validate OAuth state: ${error.message}.`, 500);
  }

  if (!data) {
    throw new SocialOAuthError("OAuth state was not recognized.", 400);
  }

  if (data.consumed_at) {
    throw new SocialOAuthError("OAuth state has already been used.", 400);
  }

  if (Date.parse(data.expires_at) <= Date.now()) {
    throw new SocialOAuthError("OAuth state has expired. Try connecting again.", 400);
  }

  const { error: updateError } = await getClient()
    .from("oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null);

  if (updateError) {
    throw new SocialOAuthError(`Could not consume OAuth state: ${updateError.message}.`, 500);
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
      return exchangeYouTubeCode(params.code, params.redirectUri, params.codeVerifier);
  }
}

async function exchangeTikTokCode(
  code: string,
  redirectUri: string,
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
    open_id?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      data?.error_description || data?.error || "TikTok token exchange failed.",
      502,
    );
  }

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    refreshToken: data.refresh_token ?? null,
    scopes: splitScopes(data.scope, ","),
    tokenType: data.token_type ?? "Bearer",
  };
}

async function exchangeInstagramCode(code: string, redirectUri: string) {
  const shortTokenUrl = new URL(
    `https://graph.facebook.com/${getMetaGraphVersion()}/oauth/access_token`,
  );
  shortTokenUrl.searchParams.set("client_id", getEnv("META_APP_ID"));
  shortTokenUrl.searchParams.set("client_secret", getEnv("META_APP_SECRET"));
  shortTokenUrl.searchParams.set("code", code);
  shortTokenUrl.searchParams.set("redirect_uri", redirectUri);

  const shortResponse = await fetch(shortTokenUrl);
  const shortData = (await shortResponse.json().catch(() => null)) as {
    access_token?: string;
    error?: { message?: string };
    expires_in?: number;
    token_type?: string;
  } | null;

  if (!shortResponse.ok || !shortData?.access_token) {
    throw new SocialOAuthError(
      shortData?.error?.message || "Instagram token exchange failed.",
      502,
    );
  }

  const longTokenUrl = new URL(
    `https://graph.facebook.com/${getMetaGraphVersion()}/oauth/access_token`,
  );
  longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
  longTokenUrl.searchParams.set("client_id", getEnv("META_APP_ID"));
  longTokenUrl.searchParams.set("client_secret", getEnv("META_APP_SECRET"));
  longTokenUrl.searchParams.set("fb_exchange_token", shortData.access_token);

  const longResponse = await fetch(longTokenUrl);
  const longData = (await longResponse.json().catch(() => null)) as {
    access_token?: string;
    error?: { message?: string };
    expires_in?: number;
    token_type?: string;
  } | null;

  const tokenData =
    longResponse.ok && longData?.access_token ? longData : shortData;
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new SocialOAuthError("Instagram token exchange failed.", 502);
  }

  return {
    accessToken,
    expiresInSeconds: tokenData.expires_in,
    refreshToken: null,
    scopes: getInstagramScopes(),
    tokenType: tokenData.token_type ?? "Bearer",
  };
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
    error?: string;
    error_description?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new SocialOAuthError(
      data?.error_description || data?.error || "YouTube token exchange failed.",
      502,
    );
  }

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    refreshToken: data.refresh_token ?? null,
    scopes: splitScopes(data.scope, " "),
    tokenType: data.token_type ?? "Bearer",
  };
}

async function fetchPlatformAccount(
  platform: SocialPlatform,
  accessToken: string,
): Promise<PlatformAccount> {
  switch (platform) {
    case "instagram":
      return fetchInstagramAccount(accessToken);
    case "tiktok":
      return fetchTikTokAccount(accessToken);
    case "youtube":
      return fetchYouTubeAccount(accessToken);
  }
}

async function fetchTikTokAccount(accessToken: string) {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set(
    "fields",
    "open_id,union_id,avatar_url,display_name",
  );

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
    error?: { message?: string };
  } | null;
  const user = payload?.data?.user;

  if (!response.ok || !user?.open_id) {
    throw new SocialOAuthError(
      payload?.error?.message || "Could not load TikTok account information.",
      502,
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

async function fetchInstagramAccount(accessToken: string) {
  const pagesUrl = new URL(
    `https://graph.facebook.com/${getMetaGraphVersion()}/me/accounts`,
  );
  pagesUrl.searchParams.set(
    "fields",
    "id,name,instagram_business_account{id,name,username,profile_picture_url}",
  );
  pagesUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(pagesUrl);
  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{
      id?: string;
      instagram_business_account?: {
        id?: string;
        name?: string;
        profile_picture_url?: string;
        username?: string;
      };
      name?: string;
    }>;
    error?: { message?: string };
  } | null;
  const page = payload?.data?.find((item) => item.instagram_business_account?.id);
  const instagramAccount = page?.instagram_business_account;

  if (!response.ok || !instagramAccount?.id) {
    throw new SocialOAuthError(
      payload?.error?.message ||
        "Could not find an Instagram business account for this Meta login.",
      502,
    );
  }

  return {
    id: instagramAccount.id,
    metadata: {
      pageId: page?.id ?? null,
      pageName: page?.name ?? null,
      profilePictureUrl: instagramAccount.profile_picture_url ?? null,
    },
    name: instagramAccount.name ?? page?.name ?? "Instagram account",
    username: instagramAccount.username ?? null,
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
    error?: { message?: string };
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
      payload?.error?.message || "Could not load YouTube channel information.",
      502,
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
  tokenSet: OAuthTokenSet;
  userId: string;
}) {
  const expiresAt =
    typeof params.tokenSet.expiresInSeconds === "number"
      ? new Date(Date.now() + params.tokenSet.expiresInSeconds * 1000).toISOString()
      : null;
  const encryptedAccessToken = encryptSecret(params.tokenSet.accessToken);
  const encryptedRefreshToken = params.tokenSet.refreshToken
    ? encryptSecret(params.tokenSet.refreshToken)
    : null;
  const now = new Date().toISOString();
  const patch = {
    access_token_ciphertext: encryptedAccessToken,
    expires_at: expiresAt,
    metadata: params.account.metadata ?? {},
    platform_account_name: params.account.name ?? null,
    platform_account_username: params.account.username ?? null,
    refresh_token_ciphertext: encryptedRefreshToken,
    revoked_at: null,
    scopes: params.tokenSet.scopes,
    token_type: params.tokenSet.tokenType ?? null,
    updated_at: now,
  };

  const existing = await getClient()
    .from("social_connections")
    .select("id")
    .eq("user_id", params.userId)
    .eq("platform", params.platform)
    .eq("platform_account_id", params.account.id)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Could not check existing connection: ${existing.error.message}`);
  }

  const result = existing.data
    ? await getClient()
        .from("social_connections")
        .update(patch)
        .eq("id", existing.data.id)
    : await getClient().from("social_connections").insert({
        ...patch,
        connected_at: now,
        platform: params.platform,
        platform_account_id: params.account.id,
        user_id: params.userId,
      });

  if (result.error) {
    throw new Error(`Could not save social connection: ${result.error.message}`);
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
  const url = new URL(
    `https://www.facebook.com/${getMetaGraphVersion()}/dialog/oauth`,
  );
  url.searchParams.set("client_id", getEnv("META_APP_ID"));
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
  url.searchParams.set("code_challenge", createPkceCodeChallenge(params.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
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

function getPlatformRedirectUri(platform: SocialPlatform) {
  return `${getAppBaseUrl()}/api/auth/${platform}/callback`;
}

function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://getugcpilot.com"
  );
}

function getMetaGraphVersion() {
  return process.env.META_GRAPH_VERSION?.trim() || DEFAULT_META_GRAPH_VERSION;
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
      "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
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

function sanitizeRedirectTo(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_REDIRECT_TO;
  }

  return value.slice(0, 400);
}

function buildCompletionRedirect(params: {
  platform: SocialPlatform;
  redirectTo: string;
}) {
  const redirectUrl = new URL(params.redirectTo, getAppBaseUrl());
  redirectUrl.searchParams.set("connected", params.platform);
  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
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
    scopes: row.scopes,
    updatedAt: row.updated_at,
  };
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
  const raw = getEnv("OAUTH_TOKEN_ENCRYPTION_KEY");

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Key = Buffer.from(raw, "base64");

  if (base64Key.length === 32) {
    return base64Key;
  }

  return createHash("sha256").update(raw).digest();
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
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

function getEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new SocialOAuthError(`${key} is not configured.`, 501);
  }

  return value;
}
