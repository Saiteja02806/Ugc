export const FREE_TRIAL_CONTENT_DAYS = 3;
export const FREE_TRIAL_DAILY_CONTENT_PIECES = 20;
/** A null limit means scheduling is unlimited while the trial is active. */
export const FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT: number | null = null;

export type FreeTrialStatus = "active" | "expired" | "unavailable";

export function resolveFreeTrialStatus(params: {
  expiresAt: string | null | undefined;
  now?: Date;
  startedAt: string | null | undefined;
}): FreeTrialStatus {
  if (!params.startedAt || !params.expiresAt) {
    return "unavailable";
  }

  const expiresAt = Date.parse(params.expiresAt);

  if (!Number.isFinite(expiresAt)) {
    return "unavailable";
  }

  return expiresAt > (params.now ?? new Date()).getTime()
    ? "active"
    : "expired";
}

export function getFreeTrialDaysRemaining(params: {
  expiresAt: string | null | undefined;
  now?: Date;
}) {
  const expiresAt = params.expiresAt ? Date.parse(params.expiresAt) : Number.NaN;

  if (!Number.isFinite(expiresAt)) {
    return 0;
  }

  const remainingMilliseconds = Math.max(
    0,
    expiresAt - (params.now ?? new Date()).getTime(),
  );

  return Math.ceil(remainingMilliseconds / (24 * 60 * 60 * 1_000));
}
