export const HOOK_PREVIEW_RENEW_EARLY_MS = 60_000;
export const HOOK_PREVIEW_RENEW_FALLBACK_MS = 4 * 60_000;
export const HOOK_PREVIEW_RENEW_MINIMUM_MS = 5_000;

export function getHookPreviewRenewalDelay(
  expiresAt: string,
  now = Date.now(),
) {
  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    return HOOK_PREVIEW_RENEW_FALLBACK_MS;
  }

  return Math.max(
    HOOK_PREVIEW_RENEW_MINIMUM_MS,
    expiresAtMs - now - HOOK_PREVIEW_RENEW_EARLY_MS,
  );
}
