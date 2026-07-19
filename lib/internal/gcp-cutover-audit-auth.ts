import "server-only";

import {
  deriveGcpCutoverAuditSecret,
  isValidGcpCutoverAuditSecret,
  verifyGcpCutoverAuditSignature,
} from "./gcp-cutover-audit-signature";

export function getMissingGcpCutoverAuditAuthEnvVars() {
  return getGcpCutoverAuditSecret()
    ? []
    : ["UGC_INTERNAL_CUTOVER_AUDIT_SECRET or SUPABASE_SERVICE_ROLE_KEY"];
}

export function verifyGcpCutoverAuditRequest(params: {
  body: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = getGcpCutoverAuditSecret();

  if (!secret) {
    return false;
  }

  return verifyGcpCutoverAuditSignature({
    ...params,
    secret,
  });
}

function getGcpCutoverAuditSecret() {
  const dedicatedSecret =
    process.env.UGC_INTERNAL_CUTOVER_AUDIT_SECRET?.trim();

  if (dedicatedSecret !== undefined) {
    return isValidGcpCutoverAuditSecret(dedicatedSecret)
      ? dedicatedSecret
      : "";
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return serviceRoleKey ? deriveGcpCutoverAuditSecret(serviceRoleKey) : "";
}
