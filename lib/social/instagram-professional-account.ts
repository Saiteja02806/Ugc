export const INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR =
  "instagram_professional_account_required";

const INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES = new Set([
  "BUSINESS",
  "MEDIA_CREATOR",
]);

export function isInstagramProfessionalAccountType(value: unknown) {
  return (
    typeof value === "string" &&
    INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES.has(value.trim().toUpperCase())
  );
}

export function requiresInstagramProfessionalAccount(input: {
  lastErrorCode?: unknown;
  metadata?: Record<string, unknown> | null;
}) {
  const storedAccountType = input.metadata?.accountType;

  return (
    input.lastErrorCode ===
      INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR ||
    input.metadata?.professionalAccountRequired === true ||
    input.metadata?.profileLookupFailed === true ||
    (typeof storedAccountType === "string" &&
      storedAccountType.trim().length > 0 &&
      !isInstagramProfessionalAccountType(storedAccountType))
  );
}

export function isInstagramProfessionalAccountProviderError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;
  const code = nestedError?.code ?? record.error_code;
  const type = nestedError?.type ?? record.error_type;
  const message = nestedError?.message ?? record.error_message;

  return (
    String(code ?? "") === "100" &&
    (String(type ?? "").toLowerCase().includes("igapiexception") ||
      String(message ?? "").toLowerCase().includes("unsupported request"))
  );
}
