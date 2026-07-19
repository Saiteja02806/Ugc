import { createHmac } from "node:crypto";

import {
  createScheduleFinalizationSignature,
  verifyScheduleFinalizationSignature,
} from "../scheduling/finalization-signature.ts";

export const GCP_CUTOVER_AUDIT_SIGNATURE_HEADER =
  "x-ugc-gcp-cutover-audit-signature";
export const GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER =
  "x-ugc-gcp-cutover-audit-timestamp";

const DERIVATION_CONTEXT = "ugc-production-gcp-cutover-audit-v1";
export const GCP_CUTOVER_AUDIT_SECRET_MIN_BYTES = 32;

export function deriveGcpCutoverAuditSecret(sourceSecret: string) {
  return createHmac("sha256", sourceSecret)
    .update(DERIVATION_CONTEXT, "utf8")
    .digest("hex");
}

export function createGcpCutoverAuditSignature(params: {
  body: string;
  secret: string;
  timestamp: string;
}) {
  return createScheduleFinalizationSignature(params);
}

export function verifyGcpCutoverAuditSignature(params: {
  body: string;
  now?: number;
  secret: string;
  signature: string | null;
  timestamp: string | null;
}) {
  return verifyScheduleFinalizationSignature(params);
}

export function isValidGcpCutoverAuditSecret(value: string) {
  return (
    Buffer.byteLength(value, "utf8") >= GCP_CUTOVER_AUDIT_SECRET_MIN_BYTES
  );
}
