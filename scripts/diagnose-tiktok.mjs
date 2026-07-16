import {
  createDecipheriv,
  createHash,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

loadEnvFile(resolve(".env.local"));

main().catch((error) => {
  console.error(
    `TikTok diagnostic failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exitCode = 1;
});

async function main() {
  const connectionId = getArgument("connection");

  if (!connectionId || !isUuid(connectionId)) {
    throw new Error(
      "Use npm run diagnose:tiktok -- --connection=<connection-id>.",
    );
  }

  const client = createClient(
    getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: connection, error } = await client
    .from("social_connections")
    .select(
      "id,platform,platform_account_id,platform_account_name,platform_account_username,status,scopes,expires_at,refresh_expires_at,token_refreshed_at,revoked_at,access_token_ciphertext",
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the connection: ${error.message}`);
  }

  if (!connection || connection.platform !== "tiktok") {
    throw new Error("The requested TikTok connection was not found.");
  }

  const accessToken = decryptSocialToken(connection.access_token_ciphertext);
  const creatorInfo = await inspectCreatorInfo(accessToken);
  const media = await inspectLatestMedia(client, connectionId);
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || "";
  const transferMode = getTransferMode();
  const verifiedHosts = getConfiguredVerifiedHosts();
  const mediaHost = getMediaHost(getArgument("media-url")) || media.host;

  const report = {
    connection: {
      accessToken: getExpiryState(connection.expires_at),
      displayName: connection.platform_account_name,
      grantedScopes: connection.scopes,
      hasVideoPublish: connection.scopes.includes("video.publish"),
      id: connection.id,
      openId: connection.platform_account_id,
      refreshToken: getExpiryState(connection.refresh_expires_at),
      revoked: Boolean(connection.revoked_at),
      status: connection.status,
      tokenRefreshedAt: connection.token_refreshed_at,
      username: connection.platform_account_username,
    },
    creatorInfo,
    oauth: {
      authorizationEndpoint: "https://www.tiktok.com/v2/auth/authorize/",
      clientKeyFingerprint: clientKey ? clientKey.slice(-6) : "missing",
      environment: process.env.TIKTOK_ENV?.trim() || "production",
      redirectUri:
        process.env.TIKTOK_REDIRECT_URI?.trim() ||
        "https://getugcpilot.com/api/social/tiktok/callback",
      requestedScopes: ["user.info.basic", "video.publish"],
      tokenEndpoint: "https://open.tiktokapis.com/v2/oauth/token/",
    },
    mediaTransfer: {
      configuredVerifiedHosts: verifiedHosts,
      host: mediaHost,
      hostVerification:
        transferMode === "FILE_UPLOAD"
          ? "not_required_for_file_upload"
          : mediaHost && verifiedHosts.includes(mediaHost)
            ? "configured"
            : "not_configured",
      latestTargetId: media.targetId,
      mode: transferMode,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

async function inspectCreatorInfo(accessToken) {
  try {
    const response = await fetch(
      new URL(
        "/v2/post/publish/creator_info/query/",
        process.env.TIKTOK_API_BASE_URL?.trim() ||
          "https://open.tiktokapis.com",
      ),
      {
        body: "{}",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        method: "POST",
      },
    );
    const payload = await response.json().catch(() => null);

    return {
      creatorNickname: getString(payload?.data?.creator_nickname),
      creatorUsername: getString(payload?.data?.creator_username),
      errorCode: getString(payload?.error?.code) || `http_${response.status}`,
      httpStatus: response.status,
      logId: getString(payload?.error?.log_id),
      ok: response.ok && payload?.error?.code === "ok",
      privacyOptions: Array.isArray(payload?.data?.privacy_level_options)
        ? payload.data.privacy_level_options.filter(
            (value) => typeof value === "string",
          )
        : [],
    };
  } catch {
    return {
      creatorNickname: null,
      creatorUsername: null,
      errorCode: "network_error",
      httpStatus: null,
      logId: null,
      ok: false,
      privacyOptions: [],
    };
  }
}

async function inspectLatestMedia(client, connectionId) {
  const { data: target } = await client
    .from("scheduled_post_targets")
    .select("id,scheduled_post_id")
    .eq("social_connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!target) {
    return { host: null, targetId: null };
  }

  const { data: post } = await client
    .from("scheduled_posts")
    .select("media_asset_id")
    .eq("id", target.scheduled_post_id)
    .maybeSingle();

  if (!post?.media_asset_id) {
    return { host: null, targetId: target.id };
  }

  const { data: asset } = await client
    .from("media_assets")
    .select("url")
    .eq("id", post.media_asset_id)
    .maybeSingle();

  return {
    host: getMediaHost(asset?.url),
    targetId: target.id,
  };
}

function decryptSocialToken(encryptedSecret) {
  const [version, iv, tag, ciphertext] = encryptedSecret.split(".");

  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("The connection uses an unsupported token format.");
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
  const raw =
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim() ||
    "";

  if (!raw) {
    throw new Error("The social token encryption key is not configured.");
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Key = Buffer.from(raw, "base64");

  return base64Key.length === 32
    ? base64Key
    : createHash("sha256").update(raw).digest();
}

function getExpiryState(value) {
  const timestamp = value ? Date.parse(value) : NaN;

  return {
    expiresAt: value || null,
    state: !Number.isFinite(timestamp)
      ? "missing"
      : timestamp <= Date.now()
        ? "expired"
        : timestamp <= Date.now() + 15 * 60 * 1000
          ? "expires_within_15_minutes"
          : "valid",
  };
}

function getTransferMode() {
  return process.env.TIKTOK_MEDIA_TRANSFER_MODE?.trim().toUpperCase() ===
    "PULL_FROM_URL"
    ? "PULL_FROM_URL"
    : "FILE_UPLOAD";
}

function getConfiguredVerifiedHosts() {
  return Array.from(
    new Set(
      (process.env.TIKTOK_VERIFIED_MEDIA_HOSTS ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function getMediaHost(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(
    prefix.length,
  );
}

function getRequiredEnv(...names) {
  const value = names
    .map((name) => process.env[name]?.trim())
    .find(Boolean);

  if (!value) {
    throw new Error(`${names.join(" or ")} is not configured.`);
  }

  return value;
}

function getString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    const rawValue = match[2].trim();
    process.env[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}
