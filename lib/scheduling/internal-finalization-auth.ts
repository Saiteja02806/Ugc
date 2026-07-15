import "server-only";

import {
  deriveScheduleFinalizationSecret,
  verifyScheduleFinalizationSignature,
} from "@/lib/scheduling/finalization-signature";

const MINIMUM_INTERNAL_SECRET_LENGTH = 32;

export function getMissingInternalFinalizationEnvVars() {
  const secret = getInternalFinalizationSecret();

  return secret
    ? []
    : ["UGC_INTERNAL_SCHEDULING_SECRET or SUPABASE_SERVICE_ROLE_KEY"];
}

export function verifyInternalFinalizationRequest(params: {
  body: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = getInternalFinalizationSecret();

  if (!secret) {
    return false;
  }

  return verifyScheduleFinalizationSignature({
    ...params,
    secret,
  });
}

function getInternalFinalizationSecret() {
  const dedicatedSecret =
    process.env.UGC_INTERNAL_SCHEDULING_SECRET?.trim();

  if (dedicatedSecret) {
    return dedicatedSecret.length >= MINIMUM_INTERNAL_SECRET_LENGTH
      ? dedicatedSecret
      : null;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return serviceRoleKey
    ? deriveScheduleFinalizationSecret(serviceRoleKey)
    : null;
}
