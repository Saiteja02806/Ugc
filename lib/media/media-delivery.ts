import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";


type MediaDeliveryRow = {
  id: string;
  metadata: unknown;
};

export type ProtectedMediaVariant = "original" | "thumbnail";

const MEDIA_DELIVERY_TOKEN_TTL_SECONDS = 5 * 60;
const MAX_MEDIA_DELIVERY_TOKEN_WINDOW_SECONDS = 10 * 60;
const STORAGE_LOCATION_KEY = "storageLocation";
const PRIVATE_USER_MEDIA_LOCATION = "private_user_media";

/** Marks rows stored in the private user-media bucket without a schema migration. */
export function withPrivateUserMediaMetadata<T extends Record<string, unknown>>(
  metadata: T,
) {
  return {
    ...metadata,
    [STORAGE_LOCATION_KEY]: PRIVATE_USER_MEDIA_LOCATION,
  };
}

export function isPrivateUserMedia(row: MediaDeliveryRow) {
  return isRecord(row.metadata) && row.metadata[STORAGE_LOCATION_KEY] === PRIVATE_USER_MEDIA_LOCATION;
}

/**
 * Returns a five-minute, signed application URL. The delivery route rechecks
 * that the asset is ready and undeleted before streaming it from its recorded
 * storage location, so soft-deleting an asset revokes already-issued links.
 */
export function getProtectedMediaDeliveryUrl(
  assetId: string,
  now = Date.now(),
  variant: ProtectedMediaVariant = "original",
) {
  const expiresAt = Math.floor(now / 1000) + MEDIA_DELIVERY_TOKEN_TTL_SECONDS;
  const signature = sign(assetId, expiresAt, variant);
  const url = new URL(`/api/media/delivery/${encodeURIComponent(assetId)}`, `${getAppBaseUrl()}/`);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", signature);
  if (variant === "thumbnail") {
    url.searchParams.set("variant", variant);
  }
  return url.toString();
}

export function verifyProtectedMediaDeliveryToken(params: {
  assetId: string;
  expires: string | null;
  signature: string | null;
  variant?: string | null;
  now?: number;
}) {
  const expiresAt = Number(params.expires);
  const now = Math.floor((params.now ?? Date.now()) / 1000);
  const variant = params.variant ?? "original";

  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + MAX_MEDIA_DELIVERY_TOKEN_WINDOW_SECONDS ||
    !params.signature ||
    !/^[a-f0-9]{64}$/i.test(params.signature) ||
    (variant !== "original" && variant !== "thumbnail")
  ) {
    return false;
  }

  const expected = Buffer.from(sign(params.assetId, expiresAt, variant), "hex");
  const received = Buffer.from(params.signature, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
}

function sign(assetId: string, expiresAt: number, variant: string) {
  return createHmac("sha256", getSigningSecret())
    .update(`ugc-media-delivery:v1:${assetId}:${expiresAt}:${variant}`)
    .digest("hex");
}

function getSigningSecret() {
  const secret = process.env.MEDIA_DELIVERY_SIGNING_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("MEDIA_DELIVERY_SIGNING_SECRET must be at least 32 characters.");
  }

  return secret;
}

function getAppBaseUrl() {
  const configured =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://getugcpilot.com";
  const url = new URL(configured);

  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must use HTTPS for protected media delivery.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
