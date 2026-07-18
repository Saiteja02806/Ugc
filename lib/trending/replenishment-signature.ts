import { createHmac } from "node:crypto";

import {
  createScheduleFinalizationSignature,
  verifyScheduleFinalizationSignature,
} from "../scheduling/finalization-signature.ts";

export const CAROUSEL_REPLENISHMENT_SIGNATURE_HEADER =
  "x-ugc-carousel-replenishment-signature";
export const CAROUSEL_REPLENISHMENT_TIMESTAMP_HEADER =
  "x-ugc-carousel-replenishment-timestamp";

const DERIVATION_CONTEXT = "ugc-carousel-daily-replenishment-v1";
export const CAROUSEL_REPLENISHMENT_SECRET_MIN_BYTES = 32;

export function deriveCarouselReplenishmentSecret(sourceSecret: string) {
  return createHmac("sha256", sourceSecret)
    .update(DERIVATION_CONTEXT, "utf8")
    .digest("hex");
}

export function createCarouselReplenishmentSignature(params: {
  body: string;
  secret: string;
  timestamp: string;
}) {
  return createScheduleFinalizationSignature(params);
}

export function verifyCarouselReplenishmentSignature(params: {
  body: string;
  now?: number;
  secret: string;
  signature: string | null;
  timestamp: string | null;
}) {
  return verifyScheduleFinalizationSignature(params);
}

export function getCarouselReplenishmentSecret() {
  const dedicatedSecret = process.env.UGC_INTERNAL_CAROUSEL_SECRET?.trim();

  if (dedicatedSecret !== undefined) {
    return isValidCarouselReplenishmentSecret(dedicatedSecret)
      ? dedicatedSecret
      : "";
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return serviceRoleKey
    ? deriveCarouselReplenishmentSecret(serviceRoleKey)
    : "";
}

export function isValidCarouselReplenishmentSecret(value: string) {
  return Buffer.byteLength(value, "utf8") >=
    CAROUSEL_REPLENISHMENT_SECRET_MIN_BYTES;
}
