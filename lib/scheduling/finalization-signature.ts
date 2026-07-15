import { createHmac, timingSafeEqual } from "node:crypto";

export const INTERNAL_FINALIZATION_SIGNATURE_HEADER =
  "x-ugc-finalization-signature";
export const INTERNAL_FINALIZATION_TIMESTAMP_HEADER =
  "x-ugc-finalization-timestamp";
export const INTERNAL_FINALIZATION_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

const SIGNATURE_PREFIX = "v1=";
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const DERIVATION_CONTEXT = "ugc-schedule-finalization-v1";

export function deriveScheduleFinalizationSecret(sourceSecret: string) {
  return createHmac("sha256", sourceSecret)
    .update(DERIVATION_CONTEXT, "utf8")
    .digest("hex");
}

export function createScheduleFinalizationSignature(params: {
  body: string;
  secret: string;
  timestamp: string;
}) {
  const digest = createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.body}`, "utf8")
    .digest("hex");

  return `${SIGNATURE_PREFIX}${digest}`;
}

export function verifyScheduleFinalizationSignature(params: {
  body: string;
  maxAgeMs?: number;
  now?: number;
  secret: string;
  signature: string | null;
  timestamp: string | null;
}) {
  if (!params.signature || !params.timestamp) {
    return false;
  }

  const timestampMs = Number(params.timestamp);
  const now = params.now ?? Date.now();
  const maxAgeMs =
    params.maxAgeMs ?? INTERNAL_FINALIZATION_SIGNATURE_MAX_AGE_MS;

  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > maxAgeMs
  ) {
    return false;
  }

  const suppliedHex = params.signature.startsWith(SIGNATURE_PREFIX)
    ? params.signature.slice(SIGNATURE_PREFIX.length)
    : "";

  if (!SHA256_HEX_PATTERN.test(suppliedHex)) {
    return false;
  }

  const expectedSignature = createScheduleFinalizationSignature({
    body: params.body,
    secret: params.secret,
    timestamp: params.timestamp,
  }).slice(SIGNATURE_PREFIX.length);
  const suppliedBuffer = Buffer.from(suppliedHex, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}
