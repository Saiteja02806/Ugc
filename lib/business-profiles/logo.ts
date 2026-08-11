import "server-only";

import { createHash, randomUUID } from "node:crypto";

import sharp from "sharp";

import {
  buildPublicStorageUrl,
  getStorageObject,
  headStorageObject,
} from "@/lib/storage/storage";

export const BUSINESS_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const BUSINESS_LOGO_MIN_DIMENSION = 64;
export const BUSINESS_LOGO_MAX_DIMENSION = 4096;
export const BUSINESS_LOGO_UPLOAD_EXPIRES_IN_SECONDS = 10 * 60;

const acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type BusinessLogoMimeType = (typeof acceptedMimeTypes)[number];

export type BusinessLogoAsset = {
  fileSizeBytes: number;
  height: number;
  mimeType: BusinessLogoMimeType;
  storageKey: string;
  url: string;
  width: number;
};

export function isBusinessLogoMimeType(value: unknown): value is BusinessLogoMimeType {
  return acceptedMimeTypes.includes(value as BusinessLogoMimeType);
}

export function createBusinessLogoStorageKey(params: {
  contentType: BusinessLogoMimeType;
  userId: string;
}) {
  const extension =
    params.contentType === "image/png"
      ? "png"
      : params.contentType === "image/webp"
        ? "webp"
        : "jpg";

  return `${getBusinessLogoStoragePrefix(params.userId)}${randomUUID()}.${extension}`;
}

export function isOwnedBusinessLogoStorageKey(params: {
  key: string;
  userId: string;
}) {
  return (
    params.key.startsWith(getBusinessLogoStoragePrefix(params.userId)) &&
    /^business-profile-logos\/[a-f0-9]{64}\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(
      params.key,
    )
  );
}

export async function inspectBusinessLogo(params: {
  key: string;
  userId: string;
}): Promise<BusinessLogoAsset> {
  if (!isOwnedBusinessLogoStorageKey(params)) {
    throw new Error("That logo upload does not belong to this business profile.");
  }

  const head = await headStorageObject({ key: params.key });
  const declaredSize = head.ContentLength ?? 0;

  if (declaredSize < 1 || declaredSize > BUSINESS_LOGO_MAX_BYTES) {
    throw new Error("Choose a logo smaller than 2 MB.");
  }

  const object = await getStorageObject({
    key: params.key,
    range: `bytes=0-${BUSINESS_LOGO_MAX_BYTES}`,
  });

  if (!object.Body) {
    throw new Error("The uploaded logo could not be read.");
  }

  const buffer = Buffer.from(
    await new Response(object.Body.transformToWebStream()).arrayBuffer(),
  );

  if (buffer.length < 1 || buffer.length > BUSINESS_LOGO_MAX_BYTES) {
    throw new Error("Choose a logo smaller than 2 MB.");
  }

  const metadata = await sharp(buffer, { failOn: "error" }).metadata();
  const mimeType = getMimeTypeForFormat(metadata.format);
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!mimeType) {
    throw new Error("Upload a PNG, JPEG, or WebP logo.");
  }

  if (
    width < BUSINESS_LOGO_MIN_DIMENSION ||
    height < BUSINESS_LOGO_MIN_DIMENSION ||
    width > BUSINESS_LOGO_MAX_DIMENSION ||
    height > BUSINESS_LOGO_MAX_DIMENSION
  ) {
    throw new Error("Use a logo between 64 and 4096 pixels on each side.");
  }

  return {
    fileSizeBytes: buffer.length,
    height,
    mimeType,
    storageKey: params.key,
    url: buildPublicStorageUrl(params.key),
    width,
  };
}

function getBusinessLogoStoragePrefix(userId: string) {
  const userHash = createHash("sha256").update(userId).digest("hex");
  return `business-profile-logos/${userHash}/`;
}

function getMimeTypeForFormat(format: string | undefined) {
  if (format === "png") {
    return "image/png" as const;
  }

  if (format === "webp") {
    return "image/webp" as const;
  }

  if (format === "jpeg") {
    return "image/jpeg" as const;
  }

  return null;
}
